import { Queue, Worker } from 'bullmq'
import { getClient } from '../db/client'

const QUEUE_NAME = 'scheduled-publish'

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

export function getScheduleQueue(): Queue {
  if (!_queue) {
    _queue = new Queue(QUEUE_NAME, {
      connection: getRedisConnection(),
    })
  }
  return _queue
}

export interface ScheduleJobData {
  scheduleId: string
  documentId: string
  collection: string
  tableName: string
}

let _worker: Worker | null = null

export function startScheduleWorker(): Worker {
  if (_worker) return _worker

  _worker = new Worker<ScheduleJobData>(
    QUEUE_NAME,
    async (job) => {
      const { scheduleId, documentId, collection, tableName } = job.data
      const sql = getClient()

      // Verify the schedule is still pending
      const scheduleRows = await sql`
        SELECT id FROM scheduled_publishes
        WHERE id = ${scheduleId} AND status = 'pending'
        LIMIT 1
      `
      if (scheduleRows.length === 0) return // cancelled or already completed

      try {
        // Publish the document
        await sql.unsafe(
          `UPDATE "${tableName}" SET status = 'published', published_at = now(), updated_at = now() WHERE id = $1`,
          [documentId],
        )

        // Mark schedule as completed
        await sql`
          UPDATE scheduled_publishes
          SET status = 'completed', completed_at = now()
          WHERE id = ${scheduleId}
        `

        console.log(`[Scheduler] Published ${collection}/${documentId} (schedule ${scheduleId})`)
      } catch (err) {
        // Mark as failed
        await sql`
          UPDATE scheduled_publishes
          SET status = 'failed', completed_at = now()
          WHERE id = ${scheduleId}
        `
        console.error(`[Scheduler] Failed to publish ${collection}/${documentId}:`, err)
        throw err
      }
    },
    {
      connection: getRedisConnection(),
    },
  )

  _worker.on('failed', (job, err) => {
    console.error(`[Scheduler] Job ${job?.id} failed:`, err.message)
  })

  return _worker
}

export async function closeScheduler(): Promise<void> {
  if (_worker) {
    await _worker.close()
    _worker = null
  }
  if (_queue) {
    await _queue.close()
    _queue = null
  }
}
