/**
 * Public types for the GDPR module.
 * See gdpr.md for the full feature specification.
 */

export type DeletionMethod = 'hard_delete' | 'anonymised'
export type DeletionRequester = 'subject' | 'retention' | 'admin'
export type DeletionStatus = 'success' | 'failed' | 'skipped'

export interface GdprSource {
  /** Unique identifier — used in the audit log and the admin UI. Use a 'custom:' prefix for clarity. */
  name: string
  /** Human-readable label for the admin UI. */
  displayName?: string
  /** Database table name to query. */
  table: string
  /** Column holding the email (for the WHERE clause). */
  emailColumn: string
  /** Optional human-friendly identifier column. Shown in the admin UI alongside results. */
  identifierColumn?: string
  /** Column used by the retention sweep (v2). Default 'created_at'. */
  createdAtColumn?: string
  /** Optional override for the search query. Receives a normalised (lower, trim) email. */
  searchFn?: (email: string) => Promise<unknown[]>
  /** Optional callback after row deletion (e.g. delete an associated file). */
  onDelete?: (row: Record<string, unknown>) => Promise<void>
  /** Columns to include in SAR exports. Default: all. */
  fields?: string[]
  /** Columns to exclude from SAR exports (overrides `fields`). Use for operational metadata. */
  excludeFields?: string[]
  /** Days to retain. Honoured by the v2 retention sweep. */
  retentionPolicyDays?: number
  /** Optional WHERE clause additions for retention. Trusted developer input — not user-supplied. */
  retentionFilter?: string
  /** True when discovered automatically from forms/collections (not manually registered). */
  autoDiscovered?: boolean
}

export interface SearchRecord {
  /** Primary key of the row in the source table. */
  id: string
  /** Optional human-friendly reference (e.g. an audit_ref). */
  identifier?: string
  /** 2–3 most relevant field values joined for display. */
  summary: string
  /** ISO timestamp from the source's createdAtColumn if available. */
  createdAt?: string
  /** Full record after excludeFields applied. */
  data: Record<string, unknown>
}

export interface SearchResult {
  source: string
  displayName: string
  records: SearchRecord[]
}

export interface PerSourceDeletionResult {
  source: string
  displayName: string
  status: DeletionStatus
  recordsDeleted: number
  failureReason?: string
  deletionLogIds: string[]
}

export interface DeletionSummary {
  totalAttempted: number
  totalDeleted: number
  totalFailed: number
  totalSkipped: number
}

export interface DeletionResult {
  results: PerSourceDeletionResult[]
  summary: DeletionSummary
}

export interface DeletionLogEntry {
  emailHash: string
  source: string
  sourceRecordId?: string
  sourceDisplayName?: string
  deletedByUserId?: string | null
  requestedBy: DeletionRequester
  deletionMethod: DeletionMethod
  status: DeletionStatus
  failureReason?: string
  fieldsDeleted?: string[]
  rationale?: string
  retentionSnapshot?: Record<string, unknown>
}

export interface SearchLogEntry {
  emailHash: string
  searchedByUserId?: string | null
  resultCount: number
  exported?: boolean
  reason?: string
}

export interface AuditLogEntry {
  kind: 'search' | 'deletion'
  id: string
  emailHash: string
  at: string
  userId: string | null
  source?: string
  status?: DeletionStatus
  rationale?: string
  reason?: string
  resultCount?: number
  exported?: boolean
}
