import { getClient } from '../db/client'
import { writeSearchLog } from './audit'
import { hashEmailForAudit, normaliseEmail } from './normalise'
import { getRegisteredSources } from './registry'
import type { GdprSource, SearchRecord, SearchResult } from './types'

export interface RunSearchOptions {
  /** ID of the admin user issuing the search (from auth middleware). */
  searchedByUserId?: string | null
  /** Free-text reason (e.g. "SAR received via privacy@x.com, ticket #043"). */
  reason?: string
  /** Mark the search log row as a SAR response immediately (admin pre-flagged). */
  logAsSar?: boolean
  /** Optional subset of source names to query. Default: all registered sources. */
  sources?: string[]
  /**
   * Test hook. Skip writing the gdpr_search_log row. Production callers
   * never set this; tests use it to avoid the DB dependency.
   */
  skipAuditLog?: boolean
}

export interface RunSearchResult {
  emailHash: string
  results: SearchResult[]
  searchLogId: string | null
  totalRecords: number
}

/**
 * Subject lookup. Iterates registered sources, runs each search, and
 * aggregates the results. Writes one row to `gdpr_search_log` per call —
 * the audit log gets a row whether or not anything was found.
 *
 * Throws GdprNotConfiguredError if GDPR_AUDIT_SECRET is unset (via
 * hashEmailForAudit). Callers should gate on isGdprConfigured() first.
 */
export async function runSearch(
  email: string,
  opts: RunSearchOptions = {},
): Promise<RunSearchResult> {
  const normalised = normaliseEmail(email)
  const emailHash = hashEmailForAudit(normalised)

  const registered = getRegisteredSources()
  const sources = opts.sources
    ? registered.filter((s) => opts.sources!.includes(s.name))
    : registered

  const results: SearchResult[] = []
  let totalRecords = 0

  for (const source of sources) {
    let rows: unknown[] = []
    try {
      rows = await runSourceSearch(source, normalised)
    } catch (err) {
      // Per-source isolation: a broken source must not break the whole search.
      // Surface as an empty result; the API layer can flag this if needed.
      console.warn(
        `[GDPR] search failed for source "${source.name}": ${(err as Error).message}`,
      )
      continue
    }

    if (rows.length === 0) continue
    totalRecords += rows.length

    results.push({
      source: source.name,
      displayName: source.displayName ?? source.name,
      records: rows.map((row) => buildSearchRecord(row as Record<string, unknown>, source)),
    })
  }

  let searchLogId: string | null = null
  if (!opts.skipAuditLog) {
    searchLogId = await writeSearchLog({
      emailHash,
      searchedByUserId: opts.searchedByUserId ?? null,
      resultCount: totalRecords,
      exported: opts.logAsSar ?? false,
      reason: opts.reason,
    })
  }

  return { emailHash, results, searchLogId, totalRecords }
}

/** Default query used when a source doesn't supply its own searchFn. */
async function runSourceSearch(source: GdprSource, normalisedEmail: string): Promise<unknown[]> {
  if (source.searchFn) {
    return (await source.searchFn(normalisedEmail)) ?? []
  }
  // Quote both table and column with double quotes to handle case-sensitive
  // identifiers. lower() on the column matches against the already-normalised
  // input. Source is trusted developer config — not user-supplied.
  const sql = getClient()
  const rows = await sql.unsafe(
    `SELECT * FROM "${source.table}" WHERE lower("${source.emailColumn}") = $1`,
    [normalisedEmail],
  )
  return rows as unknown[]
}

/**
 * Map a raw row to a SearchRecord. Applies `fields` whitelist and
 * `excludeFields` blacklist (excludeFields wins on collision).
 */
function buildSearchRecord(row: Record<string, unknown>, source: GdprSource): SearchRecord {
  const filtered = filterRow(row, source)

  const idValue = row.id ?? row[source.emailColumn] ?? ''
  const identifierValue = source.identifierColumn
    ? row[source.identifierColumn]
    : undefined
  const createdAtRaw = row[source.createdAtColumn ?? 'created_at']

  return {
    id: String(idValue),
    identifier: identifierValue != null ? String(identifierValue) : undefined,
    summary: buildSummary(filtered, source),
    createdAt: createdAtRaw instanceof Date
      ? createdAtRaw.toISOString()
      : typeof createdAtRaw === 'string'
        ? createdAtRaw
        : undefined,
    data: filtered,
  }
}

function filterRow(row: Record<string, unknown>, source: GdprSource): Record<string, unknown> {
  let entries = Object.entries(row)
  if (source.fields && source.fields.length > 0) {
    const keep = new Set(source.fields)
    entries = entries.filter(([k]) => keep.has(k))
  }
  if (source.excludeFields && source.excludeFields.length > 0) {
    const drop = new Set(source.excludeFields)
    entries = entries.filter(([k]) => !drop.has(k))
  }
  return Object.fromEntries(entries)
}

/**
 * Build a short display string for the record. Prefers obvious human-readable
 * fields if present; falls back to the first non-empty string value.
 */
function buildSummary(row: Record<string, unknown>, source: GdprSource): string {
  const candidates = ['name', 'full_name', 'fullName', 'companyName', 'company_name', 'subject', 'title']
  const picked: string[] = []

  if (source.identifierColumn && row[source.identifierColumn] != null) {
    picked.push(String(row[source.identifierColumn]))
  }

  for (const key of candidates) {
    if (picked.length >= 3) break
    const v = row[key]
    if (typeof v === 'string' && v.trim().length > 0) {
      picked.push(v)
    }
  }

  // form_submissions stores the form fields inside row.data (jsonb) — peek there too
  if (picked.length < 2 && row.data && typeof row.data === 'object') {
    const data = row.data as Record<string, unknown>
    for (const key of candidates) {
      if (picked.length >= 3) break
      const v = data[key]
      if (typeof v === 'string' && v.trim().length > 0) {
        picked.push(v)
      }
    }
  }

  if (picked.length === 0) {
    const emailValue = row[source.emailColumn]
    if (typeof emailValue === 'string') picked.push(emailValue)
  }

  return picked.join(' · ') || '(no display fields)'
}
