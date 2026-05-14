import { getClient } from '../db/client'
import { writeDeletionLog } from './audit'
import { hashEmailForAudit, normaliseEmail } from './normalise'
import { getRegisteredSources } from './registry'
import type {
  DeletionMethod,
  DeletionRequester,
  DeletionResult,
  GdprSource,
  PerSourceDeletionResult,
} from './types'

export interface RunDeleteOptions {
  /** ID of the admin user issuing the delete (from auth middleware). */
  deletedByUserId?: string | null
  /** Free-text rationale — written verbatim into gdpr_deletion_log.rationale. */
  rationale?: string
  /** Who requested the deletion. Defaults to 'admin' (admin discretion). */
  requestedBy?: DeletionRequester
  /** Optional subset of sources to act on. Default: all registered. */
  sources?: string[]
  /** Deletion method. v1 only supports 'hard_delete'. */
  method?: DeletionMethod
  /**
   * Test hook. Skip writing the gdpr_deletion_log row. Production callers
   * never set this.
   */
  skipAuditLog?: boolean
}

export class GdprUnsupportedMethodError extends Error {
  constructor(method: string) {
    super(`Deletion method '${method}' is not supported in v1. Only 'hard_delete' is available.`)
    this.name = 'GdprUnsupportedMethodError'
  }
}

/**
 * Erase all records for `email` across registered sources. Per-record audit
 * log entry written for every attempt (success or failed). Per-source
 * try/catch isolation — a source whose searchFn throws is logged as a
 * source-level failure and the other sources still run.
 *
 * v1 is hard-delete only. The anonymised path arrives in v2 with
 * `onAnonymise` on GdprSource.
 *
 * Throws GdprNotConfiguredError if GDPR_AUDIT_SECRET is unset.
 */
export async function runDelete(
  email: string,
  opts: RunDeleteOptions = {},
): Promise<DeletionResult> {
  const method: DeletionMethod = opts.method ?? 'hard_delete'
  if (method !== 'hard_delete') throw new GdprUnsupportedMethodError(method)

  const normalised = normaliseEmail(email)
  const emailHash = hashEmailForAudit(normalised)
  const requestedBy: DeletionRequester = opts.requestedBy ?? 'admin'

  const registered = getRegisteredSources()
  const sources = opts.sources
    ? registered.filter((s) => opts.sources!.includes(s.name))
    : registered

  const results: PerSourceDeletionResult[] = []
  let totalAttempted = 0
  let totalDeleted = 0
  let totalFailed = 0

  for (const source of sources) {
    let rows: Record<string, unknown>[]
    try {
      rows = (await findRowsForDelete(source, normalised)) as Record<string, unknown>[]
    } catch (err) {
      // Source-level failure (e.g. searchFn threw). Record one failed log
      // entry with no source_record_id and move on.
      const message = (err as Error).message
      const logId = opts.skipAuditLog
        ? null
        : await writeDeletionLog({
            emailHash,
            source: source.name,
            sourceDisplayName: source.displayName,
            deletedByUserId: opts.deletedByUserId ?? null,
            requestedBy,
            deletionMethod: method,
            status: 'failed',
            failureReason: `source search failed: ${message}`,
            rationale: opts.rationale,
          })
      results.push({
        source: source.name,
        displayName: source.displayName ?? source.name,
        status: 'failed',
        recordsAttempted: 0,
        recordsDeleted: 0,
        recordsFailed: 1,
        failureReason: message,
        deletionLogIds: logId ? [logId] : [],
      })
      totalFailed += 1
      continue
    }

    if (rows.length === 0) {
      // Nothing to do — still write a skipped row so the audit trail shows
      // we checked this source. Helpful for proving SAR-then-erasure
      // coverage even when a source had no records.
      const logId = opts.skipAuditLog
        ? null
        : await writeDeletionLog({
            emailHash,
            source: source.name,
            sourceDisplayName: source.displayName,
            deletedByUserId: opts.deletedByUserId ?? null,
            requestedBy,
            deletionMethod: method,
            status: 'skipped',
            failureReason: 'no records matched',
            rationale: opts.rationale,
          })
      results.push({
        source: source.name,
        displayName: source.displayName ?? source.name,
        status: 'success',
        recordsAttempted: 0,
        recordsDeleted: 0,
        recordsFailed: 0,
        deletionLogIds: logId ? [logId] : [],
      })
      continue
    }

    const perSource = await deleteRowsForSource(source, rows, {
      emailHash,
      requestedBy,
      method,
      rationale: opts.rationale,
      deletedByUserId: opts.deletedByUserId ?? null,
      skipAuditLog: opts.skipAuditLog ?? false,
    })

    results.push(perSource)
    totalAttempted += perSource.recordsAttempted
    totalDeleted += perSource.recordsDeleted
    totalFailed += perSource.recordsFailed
  }

  return {
    results,
    summary: {
      totalAttempted,
      totalDeleted,
      totalFailed,
      totalSkipped: 0, // skipped rows don't increment the per-record counters
    },
  }
}

async function findRowsForDelete(
  source: GdprSource,
  normalisedEmail: string,
): Promise<unknown[]> {
  if (source.searchFn) return (await source.searchFn(normalisedEmail)) ?? []
  const sql = getClient()
  const rows = await sql.unsafe(
    `SELECT * FROM "${source.table}" WHERE lower("${source.emailColumn}") = $1`,
    [normalisedEmail],
  )
  return rows as unknown[]
}

interface RowDeleteContext {
  emailHash: string
  requestedBy: DeletionRequester
  method: DeletionMethod
  rationale?: string
  deletedByUserId: string | null
  skipAuditLog: boolean
}

async function deleteRowsForSource(
  source: GdprSource,
  rows: Record<string, unknown>[],
  ctx: RowDeleteContext,
): Promise<PerSourceDeletionResult> {
  const deletionLogIds: string[] = []
  let deleted = 0
  let failed = 0

  for (const row of rows) {
    const rowId = row.id != null ? String(row.id) : undefined
    try {
      if (source.deleteFn) {
        await source.deleteFn(row)
      } else {
        if (!rowId) {
          throw new Error('row has no id column — set source.deleteFn for tables without an id PK')
        }
        const sql = getClient()
        await sql.unsafe(`DELETE FROM "${source.table}" WHERE id = $1`, [rowId])
      }
      // Best-effort filesystem/external cleanup. Failures here are logged
      // but don't roll back the row delete (which can't be undone anyway).
      if (source.onDelete) {
        try {
          await source.onDelete(row)
        } catch (err) {
          console.warn(
            `[GDPR] onDelete for ${source.name} row ${rowId} failed: ${(err as Error).message}`,
          )
        }
      }

      const logId = ctx.skipAuditLog
        ? null
        : await writeDeletionLog({
            emailHash: ctx.emailHash,
            source: source.name,
            sourceRecordId: rowId,
            sourceDisplayName: source.displayName,
            deletedByUserId: ctx.deletedByUserId,
            requestedBy: ctx.requestedBy,
            deletionMethod: ctx.method,
            status: 'success',
            fieldsDeleted: Object.keys(row),
            rationale: ctx.rationale,
          })
      if (logId) deletionLogIds.push(logId)
      deleted += 1
    } catch (err) {
      const message = (err as Error).message
      const logId = ctx.skipAuditLog
        ? null
        : await writeDeletionLog({
            emailHash: ctx.emailHash,
            source: source.name,
            sourceRecordId: rowId,
            sourceDisplayName: source.displayName,
            deletedByUserId: ctx.deletedByUserId,
            requestedBy: ctx.requestedBy,
            deletionMethod: ctx.method,
            status: 'failed',
            failureReason: message,
            rationale: ctx.rationale,
          })
      if (logId) deletionLogIds.push(logId)
      failed += 1
    }
  }

  return {
    source: source.name,
    displayName: source.displayName ?? source.name,
    status: failed === 0 ? 'success' : 'failed',
    recordsAttempted: rows.length,
    recordsDeleted: deleted,
    recordsFailed: failed,
    failureReason: failed > 0 ? `${failed} of ${rows.length} record(s) failed to delete` : undefined,
    deletionLogIds,
  }
}
