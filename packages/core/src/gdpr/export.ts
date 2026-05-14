import { normaliseEmail } from './normalise'
import { runSearch, type RunSearchOptions } from './search'
import type { SearchResult } from './types'

export interface RunExportOptions extends Omit<RunSearchOptions, 'logAsSar'> {
  /**
   * Override the recorded actor email shown in the export envelope. Defaults
   * to the normalised search email — that's the data subject themselves.
   */
  subjectEmail?: string
}

export interface ExportPayload {
  /** Schema version. Bump on breaking shape changes; consumers can switch on this. */
  schema: 'kritano-gdpr-export-v1'
  /** The normalised email the export was generated for. Plaintext (subject's own data). */
  subject: string
  /** HMAC of the normalised email — matches gdpr_search_log/gdpr_deletion_log.email_hash. */
  emailHash: string
  /** ISO timestamp of when this envelope was built. */
  exportedAt: string
  /** ID of the admin user who triggered the export, or null. */
  exportedBy: string | null
  /** ID of the gdpr_search_log row recording this export. */
  searchLogId: string | null
  /** Total record count across all sources. */
  totalRecords: number
  /** Source-by-source result set, same shape as the search API. */
  sources: SearchResult[]
}

export interface RunExportResult {
  payload: ExportPayload
  /** Suggested download filename — never contains the plaintext email. */
  filename: string
  /** ID of the gdpr_search_log row (also inside the payload for convenience). */
  searchLogId: string | null
}

/**
 * Build a downloadable SAR-response envelope for `email`. Internally runs
 * `runSearch` with logAsSar:true so the underlying search-log row records
 * the export — no second log call is needed.
 *
 * Throws GdprNotConfiguredError if GDPR_AUDIT_SECRET is unset.
 */
export async function runExport(
  email: string,
  opts: RunExportOptions = {},
): Promise<RunExportResult> {
  const normalised = normaliseEmail(email)
  const search = await runSearch(email, {
    ...opts,
    logAsSar: true,
  })

  const exportedAt = new Date()
  const payload: ExportPayload = {
    schema: 'kritano-gdpr-export-v1',
    subject: opts.subjectEmail ?? normalised,
    emailHash: search.emailHash,
    exportedAt: exportedAt.toISOString(),
    exportedBy: opts.searchedByUserId ?? null,
    searchLogId: search.searchLogId,
    totalRecords: search.totalRecords,
    sources: search.results,
  }

  return {
    payload,
    filename: buildFilename(search.emailHash, exportedAt),
    searchLogId: search.searchLogId,
  }
}

/**
 * `gdpr-export-YYYY-MM-DD-<hash8>.json`. The hash prefix is sufficient for
 * the admin to distinguish exports without leaking the subject's email
 * into the filesystem / Downloads folder / a screen recording.
 */
function buildFilename(emailHash: string, at: Date): string {
  const date = at.toISOString().slice(0, 10)
  const hashPrefix = emailHash.slice(0, 8)
  return `gdpr-export-${date}-${hashPrefix}.json`
}
