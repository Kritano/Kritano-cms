import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { sendWebhookDelivery, type WebhookEvent } from '../../lib/webhooks'

const VALID_EVENTS: WebhookEvent[] = [
  'content.created',
  'content.updated',
  'content.published',
  'content.unpublished',
  'content.deleted',
  'media.uploaded',
  'media.deleted',
  'form.submitted',
  'user.created',
]

export const webhookRoutes = new Hono<AuthEnv>()

// List webhooks
webhookRoutes.get('/admin/webhooks', requireAuth, requirePermission('webhooks'), async (c) => {
  const sql = getClient()
  const rows = await sql`
    SELECT w.*,
      (SELECT COUNT(*)::int FROM webhook_deliveries wd WHERE wd.webhook_id = w.id) as delivery_count,
      (SELECT success FROM webhook_deliveries wd WHERE wd.webhook_id = w.id ORDER BY wd.created_at DESC LIMIT 1) as last_delivery_success
    FROM webhooks w
    ORDER BY w.created_at DESC
  `
  return c.json({ data: rows })
})

// Get single webhook
webhookRoutes.get('/admin/webhooks/:id', requireAuth, requirePermission('webhooks'), async (c) => {
  const sql = getClient()
  const id = c.req.param('id')

  const rows = await sql`SELECT * FROM webhooks WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  return c.json({ data: rows[0] })
})

// Create webhook
webhookRoutes.post('/admin/webhooks', requireAuth, requirePermission('webhooks'), async (c) => {
  const body = await c.req.json<{
    name: string
    url: string
    secret?: string
    events: string[]
    active?: boolean
  }>()

  if (!body.name || !body.url || !body.events?.length) {
    return c.json({ error: { code: 'VALIDATION', message: 'Name, URL, and at least one event are required' } }, 400)
  }

  // Validate events
  const invalidEvents = body.events.filter((e) => !VALID_EVENTS.includes(e as WebhookEvent))
  if (invalidEvents.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: `Invalid events: ${invalidEvents.join(', ')}` } }, 400)
  }

  const sql = getClient()
  const rows = await sql`
    INSERT INTO webhooks (name, url, secret, events, active)
    VALUES (
      ${body.name},
      ${body.url},
      ${body.secret || null},
      ${JSON.stringify(body.events)}::jsonb,
      ${body.active !== false}
    )
    RETURNING *
  `

  return c.json({ data: rows[0] }, 201)
})

// Update webhook
webhookRoutes.put('/admin/webhooks/:id', requireAuth, requirePermission('webhooks'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{
    name?: string
    url?: string
    secret?: string | null
    events?: string[]
    active?: boolean
  }>()

  const sql = getClient()
  const existing = await sql`SELECT id FROM webhooks WHERE id = ${id} LIMIT 1`
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  if (body.events) {
    const invalidEvents = body.events.filter((e) => !VALID_EVENTS.includes(e as WebhookEvent))
    if (invalidEvents.length > 0) {
      return c.json({ error: { code: 'VALIDATION', message: `Invalid events: ${invalidEvents.join(', ')}` } }, 400)
    }
  }

  const setClauses: string[] = []
  const values: any[] = []
  let idx = 1

  if (body.name !== undefined) {
    setClauses.push(`"name" = $${idx}`)
    values.push(body.name)
    idx++
  }
  if (body.url !== undefined) {
    setClauses.push(`"url" = $${idx}`)
    values.push(body.url)
    idx++
  }
  if (body.secret !== undefined) {
    setClauses.push(`"secret" = $${idx}`)
    values.push(body.secret)
    idx++
  }
  if (body.events !== undefined) {
    setClauses.push(`"events" = $${idx}::jsonb`)
    values.push(JSON.stringify(body.events))
    idx++
  }
  if (body.active !== undefined) {
    setClauses.push(`"active" = $${idx}`)
    values.push(body.active)
    idx++
  }

  if (setClauses.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
  }

  values.push(id)
  const rows = await sql.unsafe(
    `UPDATE "webhooks" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  )

  return c.json({ data: rows[0] })
})

// Delete webhook
webhookRoutes.delete('/admin/webhooks/:id', requireAuth, requirePermission('webhooks'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()

  const rows = await sql`DELETE FROM webhooks WHERE id = ${id} RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  return c.json({ ok: true })
})

// Delivery log for a webhook (paginated)
webhookRoutes.get('/admin/webhooks/:id/deliveries', requireAuth, requirePermission('webhooks'), async (c) => {
  const sql = getClient()
  const webhookId = c.req.param('id')
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = (page - 1) * limit

  const countResult = await sql`
    SELECT COUNT(*)::int as total FROM webhook_deliveries WHERE webhook_id = ${webhookId}
  `
  const total = (countResult[0] as Record<string, unknown>).total as number

  const rows = await sql`
    SELECT * FROM webhook_deliveries
    WHERE webhook_id = ${webhookId}
    ORDER BY created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
})

// Test delivery — synchronous, bypasses queue
webhookRoutes.post('/admin/webhooks/:id/test', requireAuth, requirePermission('webhooks'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()

  const rows = await sql`SELECT * FROM webhooks WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Webhook not found' } }, 404)
  }

  const webhook = rows[0] as Record<string, unknown>
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000'

  const testPayload = {
    event: 'test',
    timestamp: new Date().toISOString(),
    site: siteUrl,
    data: {
      message: 'This is a test delivery from your CMS',
      webhookId: id,
    },
  }

  const result = await sendWebhookDelivery(
    webhook.url as string,
    testPayload,
    webhook.secret as string | null,
  )

  // Log the test delivery
  await sql`
    INSERT INTO webhook_deliveries (webhook_id, event, payload, response_code, response_body, duration_ms, success, attempt)
    VALUES (
      ${id},
      ${'test'},
      ${JSON.stringify(testPayload)}::jsonb,
      ${result.responseCode},
      ${result.responseBody},
      ${result.durationMs},
      ${result.success},
      1
    )
  `

  return c.json({
    data: {
      success: result.success,
      responseCode: result.responseCode,
      responseBody: result.responseBody,
      durationMs: result.durationMs,
    },
  })
})
