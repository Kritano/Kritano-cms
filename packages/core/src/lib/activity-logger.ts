import { getClient } from '../db/client'

export interface ActivityLogEntry {
  userId: string | null
  action: string
  resource: string
  resourceId?: string | null
  metadata?: Record<string, unknown> | null
}

export async function logActivity(entry: ActivityLogEntry): Promise<void> {
  const sql = getClient()
  try {
    await sql`
      INSERT INTO activity_log (user_id, action, resource, resource_id, metadata)
      VALUES (
        ${entry.userId},
        ${entry.action},
        ${entry.resource},
        ${entry.resourceId ?? null},
        ${entry.metadata ? JSON.stringify(entry.metadata) : null}::jsonb
      )
    `
  } catch (err) {
    // Activity logging should never break the request
    console.error('[ActivityLog] Failed to log activity:', err)
  }
}
