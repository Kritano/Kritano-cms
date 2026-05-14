import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { getRegisteredSources } from '../../gdpr/registry'
import { isGdprConfigured } from '../../gdpr/normalise'
import { runSearch } from '../../gdpr/search'
import { runDelete, GdprUnsupportedMethodError } from '../../gdpr/delete'
import { runExport } from '../../gdpr/export'
import type { DeletionMethod, DeletionRequester } from '../../gdpr/types'

const MIN_RATIONALE_LENGTH = 10
const VALID_REQUESTED_BY: DeletionRequester[] = ['subject', 'admin']
const VALID_METHODS: DeletionMethod[] = ['hard_delete'] // 'anonymised' arrives in v2

export const gdprRoutes = new Hono<AuthEnv>()

/** Extract a UUID user id from the JWT payload, ignoring api-key principals. */
function getJwtUserId(user: { sub?: string } | undefined): string | null {
  const sub = user?.sub
  if (!sub || sub.startsWith('apikey:')) return null
  return sub
}

/**
 * Returns 503 with a setup hint when GDPR_AUDIT_SECRET is missing. Lets
 * the admin UI tell the operator what to do instead of erroring opaquely.
 */
function ensureConfigured(): Response | null {
  if (isGdprConfigured()) return null
  return Response.json(
    {
      error: 'gdpr_not_configured',
      message:
        'GDPR_AUDIT_SECRET is not set. Add a long random string (e.g. `openssl rand -hex 32`) ' +
        'to your .env to enable the GDPR module. Never rotate it once set — see docs/gdpr.md.',
    },
    { status: 503 },
  )
}

// GET /api/admin/gdpr/sources — list all registered sources (auto-discovered + custom)
gdprRoutes.get(
  '/admin/gdpr/sources',
  requireAuth,
  requirePermission('settings'),
  async (c) => {
    const notReady = ensureConfigured()
    if (notReady) return notReady

    const sources = getRegisteredSources().map((s) => ({
      name: s.name,
      displayName: s.displayName ?? s.name,
      table: s.table,
      emailColumn: s.emailColumn,
      identifierColumn: s.identifierColumn,
      createdAtColumn: s.createdAtColumn ?? 'created_at',
      retentionPolicyDays: s.retentionPolicyDays,
      autoDiscovered: s.autoDiscovered ?? false,
    }))

    return c.json({ sources })
  },
)

// POST /api/admin/gdpr/search — subject lookup across all registered sources
gdprRoutes.post(
  '/admin/gdpr/search',
  requireAuth,
  requirePermission('settings'),
  async (c) => {
    const notReady = ensureConfigured()
    if (notReady) return notReady

    const body = await c.req.json<{
      email?: string
      reason?: string
      logAsSar?: boolean
      sources?: string[]
    }>()

    if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
      return c.json({ error: 'email is required' }, 400)
    }

    const result = await runSearch(body.email, {
      searchedByUserId: getJwtUserId(c.get('user')),
      reason: body.reason,
      logAsSar: body.logAsSar,
      sources: body.sources,
    })

    return c.json(result)
  },
)

// POST /api/admin/gdpr/export — produce a SAR-response JSON file for a subject
gdprRoutes.post(
  '/admin/gdpr/export',
  requireAuth,
  requirePermission('settings'),
  async (c) => {
    const notReady = ensureConfigured()
    if (notReady) return notReady

    const body = await c.req.json<{
      email?: string
      sources?: string[]
      reason?: string
    }>()

    if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
      return c.json({ error: 'email is required' }, 400)
    }

    const result = await runExport(body.email, {
      searchedByUserId: getJwtUserId(c.get('user')),
      reason: body.reason,
      sources: body.sources,
    })

    return new Response(JSON.stringify(result.payload, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${result.filename}"`,
        // Surfaced so the admin SPA can read it without parsing the disposition header
        'X-Gdpr-Search-Log-Id': result.searchLogId ?? '',
      },
    })
  },
)

// POST /api/admin/gdpr/delete — erase records for a subject across registered sources
gdprRoutes.post(
  '/admin/gdpr/delete',
  requireAuth,
  requirePermission('settings'),
  async (c) => {
    const notReady = ensureConfigured()
    if (notReady) return notReady

    const body = await c.req.json<{
      email?: string
      sources?: string[]
      method?: string
      rationale?: string
      requestedBy?: string
    }>()

    if (!body.email || typeof body.email !== 'string' || body.email.trim().length === 0) {
      return c.json({ error: 'email is required' }, 400)
    }
    if (!body.rationale || body.rationale.trim().length < MIN_RATIONALE_LENGTH) {
      return c.json(
        { error: `rationale is required and must be at least ${MIN_RATIONALE_LENGTH} characters` },
        400,
      )
    }
    const method = (body.method ?? 'hard_delete') as DeletionMethod
    if (!VALID_METHODS.includes(method)) {
      return c.json(
        {
          error: `method '${body.method}' is not supported in v1. Only 'hard_delete' is available.`,
        },
        400,
      )
    }
    const requestedBy = (body.requestedBy ?? 'admin') as DeletionRequester
    if (!VALID_REQUESTED_BY.includes(requestedBy)) {
      return c.json(
        { error: `requestedBy must be one of: ${VALID_REQUESTED_BY.join(', ')}` },
        400,
      )
    }

    try {
      const result = await runDelete(body.email, {
        deletedByUserId: getJwtUserId(c.get('user')),
        rationale: body.rationale,
        requestedBy,
        sources: body.sources,
        method,
      })
      return c.json(result)
    } catch (err) {
      if (err instanceof GdprUnsupportedMethodError) {
        return c.json({ error: err.message }, 400)
      }
      throw err
    }
  },
)

// GET /api/admin/gdpr/log/recent?limit=50 — interleaved search + deletion log
gdprRoutes.get(
  '/admin/gdpr/log/recent',
  requireAuth,
  requirePermission('settings'),
  async (c) => {
    const notReady = ensureConfigured()
    if (notReady) return notReady

    const rawLimit = parseInt(c.req.query('limit') ?? '50', 10)
    const limit = Math.min(Math.max(isNaN(rawLimit) ? 50 : rawLimit, 1), 200)
    const sql = getClient()

    // UNION the two log tables, sort by their timestamp column.
    const rows = await sql.unsafe(
      `SELECT
         'search' AS kind, id, email_hash, searched_at AS at,
         searched_by_user_id AS user_id, NULL::text AS source,
         NULL::text AS status, NULL::text AS rationale,
         reason, result_count, exported
       FROM gdpr_search_log
       UNION ALL
       SELECT
         'deletion' AS kind, id, email_hash, deleted_at AS at,
         deleted_by_user_id AS user_id, source,
         status, rationale,
         NULL::text AS reason, NULL::integer AS result_count, NULL::boolean AS exported
       FROM gdpr_deletion_log
       ORDER BY at DESC
       LIMIT $1`,
      [limit],
    )

    const entries = (rows as Array<Record<string, unknown>>).map((r) => ({
      kind: r.kind,
      id: r.id,
      emailHash: r.email_hash,
      at: r.at instanceof Date ? r.at.toISOString() : r.at,
      userId: r.user_id,
      source: r.source,
      status: r.status,
      rationale: r.rationale,
      reason: r.reason,
      resultCount: r.result_count,
      exported: r.exported,
    }))

    return c.json({ entries })
  },
)
