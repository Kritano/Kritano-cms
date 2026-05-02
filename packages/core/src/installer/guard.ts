import { createMiddleware } from 'hono/factory'
import { getClient } from '../db/client'

let _configured: boolean | null = null

/** Check if the CMS has been configured (admin user exists) */
export async function isConfigured(): Promise<boolean> {
  if (_configured === true) return true

  try {
    const sql = getClient()
    const rows = await sql`SELECT id FROM users LIMIT 1`
    _configured = rows.length > 0
    return _configured
  } catch {
    return false
  }
}

/** Reset cached state — used after installer completes */
export function markConfigured(): void {
  _configured = true
}

/**
 * Middleware that redirects to /install if the CMS is not configured.
 * Only applies to / and /admin routes. API routes are unaffected.
 */
export const installerGuard = createMiddleware(async (c, next) => {
  const path = c.req.path

  // Don't guard API routes, static assets, or the installer itself
  if (
    path.startsWith('/api') ||
    path.startsWith('/install') ||
    path.startsWith('/@') ||
    path.startsWith('/__vite') ||
    path.includes('.')
  ) {
    return next()
  }

  const configured = await isConfigured()

  if (!configured && (path === '/' || path.startsWith('/admin'))) {
    return c.redirect('/install')
  }

  return next()
})

/**
 * Middleware that blocks /install if already configured.
 */
export const installerOnlyGuard = createMiddleware(async (c, next) => {
  const configured = await isConfigured()
  if (configured) {
    return c.redirect('/admin')
  }
  return next()
})
