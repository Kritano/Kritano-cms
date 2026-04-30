import { Queue, Worker } from 'bullmq'
import crypto from 'node:crypto'
import { getClient } from '../db/client'

const QUEUE_NAME = 'webhook-delivery'

// Retry delays in ms: 1min, 5min, 30min, 2hr, 8hr
const RETRY_DELAYS = [60_000, 300_000, 1_800_000, 7_200_000, 28_800_000]
const MAX_ATTEMPTS = 5
const MAX_CONSECUTIVE_FAILURES = 10

function getRedisConnection() {
  const url = process.env.REDIS_URL || 'redis://localhost:6379'
  const parsed = new URL(url)
  return {
    host: parsed.hostname,
    port: parseInt(parsed.port || '6379', 10),
    password: parsed.password || undefined,
  }
}

let _queue: Queue | null = null

export function getWebhookQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, { connection: getRedisConnection() })
  }
  return _queue
}

export interface WebhookDeliveryJob {
  webhookId: string
  deliveryId: string
  url: string
  secret: string | null
  payload: WebhookPayload
  attempt: number
}

export type WebhookEvent =
  | 'content.created'
  | 'content.updated'
  | 'content.published'
  | 'content.unpublished'
  | 'content.deleted'
  | 'media.uploaded'
  | 'media.deleted'
  | 'form.submitted'
  | 'user.created'

export interface WebhookPayload {
  event: WebhookEvent
  timestamp: string
  site: string
  data: Record<string, unknown>
}

function signPayload(payload: string, secret: string): string {
  return `sha256=${crypto.createHmac('sha256', secret).update(payload).digest('hex')}`
}

export async function dispatchWebhookEvent(
  event: WebhookEvent,
  data: Record<string, unknown>,
): Promise<void> {
  const sql = getClient()

  // Find all active webhooks subscribed to this event
  const webhooks = await sql`
    SELECT id, url, secret, events
    FROM webhooks
    WHERE active = true
  `

  const siteUrl = process.env.SITE_URL || 'http://localhost:3000'
  const now = new Date().toISOString()

  for (const webhook of webhooks) {
    const wh = webhook as Record<string, unknown>
    const events = wh.events as string[]

    if (!events.includes(event)) continue

    const payload: WebhookPayload = {
      event,
      timestamp: now,
      site: siteUrl,
      data,
    }

    // Create delivery record
    const deliveryRows = await sql`
      INSERT INTO webhook_deliveries (webhook_id, event, payload, attempt)
      VALUES (${wh.id as string}, ${event}, ${JSON.stringify(payload)}::jsonb, 1)
      RETURNING id
    `
    const deliveryId = (deliveryRows[0] as Record<string, unknown>).id as string

    // Enqueue delivery job
    const queue = getWebhookQueue()
    await queue.add('deliver', {
      webhookId: wh.id as string,
      deliveryId,
      url: wh.url as string,
      secret: wh.secret as string | null,
      payload,
      attempt: 1,
    } satisfies WebhookDeliveryJob)
  }
}

export async function sendWebhookDelivery(
  url: string,
  payload: Record<string, unknown> | WebhookPayload,
  secret: string | null,
): Promise<{ success: boolean; responseCode: number | null; responseBody: string; durationMs: number }> {
  const body = JSON.stringify(payload)
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    'User-Agent': 'CMS-Webhook/0.2',
  }

  if (secret) {
    headers['X-CMS-Signature'] = signPayload(body, secret)
  }

  const start = Date.now()
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body,
      signal: AbortSignal.timeout(30_000), // 30s timeout
    })

    const durationMs = Date.now() - start
    const responseBody = await response.text().catch(() => '')
    const truncatedBody = responseBody.slice(0, 1000)

    return {
      success: response.ok,
      responseCode: response.status,
      responseBody: truncatedBody,
      durationMs,
    }
  } catch (err) {
    const durationMs = Date.now() - start
    return {
      success: false,
      responseCode: null,
      responseBody: err instanceof Error ? err.message : 'Unknown error',
      durationMs,
    }
  }
}

let _worker: Worker | null = null

export function startWebhookWorker(): Worker {
  if (_worker) return _worker

  _worker = new Worker<WebhookDeliveryJob>(
    QUEUE_NAME,
    async (job) => {
      const { webhookId, deliveryId, url, secret, payload, attempt } = job.data
      const sql = getClient()

      const result = await sendWebhookDelivery(url, payload, secret)

      // Update delivery record
      await sql`
        UPDATE webhook_deliveries
        SET response_code = ${result.responseCode},
            response_body = ${result.responseBody},
            duration_ms = ${result.durationMs},
            success = ${result.success},
            attempt = ${attempt}
        WHERE id = ${deliveryId}
      `

      if (result.success) {
        console.log(`[Webhook] Delivered to ${url} (${result.responseCode}) in ${result.durationMs}ms`)
        return
      }

      console.warn(`[Webhook] Delivery failed to ${url}: ${result.responseCode ?? 'network error'} (attempt ${attempt}/${MAX_ATTEMPTS})`)

      // Retry if under max attempts
      if (attempt < MAX_ATTEMPTS) {
        const nextAttempt = attempt + 1
        const delay = RETRY_DELAYS[attempt - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1]

        // Create a new delivery record for the retry
        const retryRows = await sql`
          INSERT INTO webhook_deliveries (webhook_id, event, payload, attempt)
          VALUES (${webhookId}, ${payload.event}, ${JSON.stringify(payload)}::jsonb, ${nextAttempt})
          RETURNING id
        `
        const retryDeliveryId = (retryRows[0] as Record<string, unknown>).id as string

        const queue = getWebhookQueue()
        await queue.add('deliver', {
          webhookId,
          deliveryId: retryDeliveryId,
          url,
          secret,
          payload,
          attempt: nextAttempt,
        } satisfies WebhookDeliveryJob, { delay })
      } else {
        // Permanently failed — check if we should auto-disable
        const failedCount = await sql`
          SELECT COUNT(*)::int as count
          FROM webhook_deliveries
          WHERE webhook_id = ${webhookId} AND success = false AND attempt = ${MAX_ATTEMPTS}
          ORDER BY created_at DESC
          LIMIT ${MAX_CONSECUTIVE_FAILURES}
        `
        const count = (failedCount[0] as Record<string, unknown>).count as number

        if (count >= MAX_CONSECUTIVE_FAILURES) {
          await sql`UPDATE webhooks SET active = false WHERE id = ${webhookId}`
          console.warn(`[Webhook] Auto-disabled webhook ${webhookId} after ${MAX_CONSECUTIVE_FAILURES} consecutive failures`)
        }
      }
    },
    { connection: getRedisConnection() },
  )

  _worker.on('failed', (job, err) => {
    console.error(`[Webhook] Worker job ${job?.id} failed:`, err.message)
  })

  return _worker
}

export async function closeWebhookWorker(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
  if (_queue) {
    await _queue.close()
    _queue = null
  }
}
