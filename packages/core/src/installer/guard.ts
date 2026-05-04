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
 * Middleware — no-op. Installer guard disabled.
 */
export const installerGuard = createMiddleware(async (_c, next) => {
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
