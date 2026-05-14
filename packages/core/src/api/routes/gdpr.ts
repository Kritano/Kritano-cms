import { Hono } from 'hono'
import { requireAuth, type AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { getRegisteredSources } from '../../gdpr/registry'
import { isGdprConfigured } from '../../gdpr/normalise'

export const gdprRoutes = new Hono<AuthEnv>()

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
