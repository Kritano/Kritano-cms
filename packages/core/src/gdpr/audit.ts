import { getClient } from '../db/client'
import type { DeletionLogEntry, SearchLogEntry } from './types'

/**
 * Write a row to gdpr_deletion_log. Called once per source per delete attempt
 * (including failures — status carries the outcome). Returns the new row id.
 *
 * The audit log is permanent — never truncated, never purged.
 */
export async function writeDeletionLog(entry: DeletionLogEntry): Promise<string> {
  const sql = getClient()
  const rows = await sql.unsafe(
    `INSERT INTO gdpr_deletion_log (
       email_hash, source, source_record_id, source_display_name,
       deleted_by_user_id, requested_by, deletion_method, status,
       failure_reason, fields_deleted, rationale, retention_snapshot
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
     RETURNING id`,
    [
      entry.emailHash,
      entry.source,
      entry.sourceRecordId ?? null,
      entry.sourceDisplayName ?? null,
      entry.deletedByUserId ?? null,
      entry.requestedBy,
      entry.deletionMethod,
      entry.status,
      entry.failureReason ?? null,
      entry.fieldsDeleted ?? null,
      entry.rationale ?? null,
      entry.retentionSnapshot ? JSON.stringify(entry.retentionSnapshot) : null,
    ],
  )
  return (rows[0] as unknown as { id: string }).id
}

/**
 * Write a row to gdpr_search_log. Returns the new row id so the API can
 * surface it to the admin (useful when toggling `exported` later).
 */
export async function writeSearchLog(entry: SearchLogEntry): Promise<string> {
  const sql = getClient()
  const rows = await sql.unsafe(
    `INSERT INTO gdpr_search_log (
       email_hash, searched_by_user_id, result_count, exported, reason
     ) VALUES ($1,$2,$3,$4,$5)
     RETURNING id`,
    [
      entry.emailHash,
      entry.searchedByUserId ?? null,
      entry.resultCount,
      entry.exported ?? false,
      entry.reason ?? null,
    ],
  )
  return (rows[0] as unknown as { id: string }).id
}

/** Flip exported=true after the admin downloads the export. */
export async function markSearchExported(searchLogId: string): Promise<void> {
  const sql = getClient()
  await sql.unsafe(
    `UPDATE gdpr_search_log SET exported = true WHERE id = $1`,
    [searchLogId],
  )
}
