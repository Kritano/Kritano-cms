import { createMiddleware } from 'hono/factory'
import { getClient } from '../../db/client'

export const redirectMiddleware = createMiddleware(async (c, next) => {
  // Only check redirects for non-API paths (don't redirect API requests)
  const url = new URL(c.req.url)
  if (url.pathname.startsWith('/api/')) {
    return next()
  }

  const sql = getClient()
  try {
    const rows = await sql`
      SELECT id, to_path, type FROM redirects
      WHERE from_path = ${url.pathname}
      LIMIT 1
    `

    if (rows.length > 0) {
      const redirect = rows[0] as Record<string, unknown>

      // Increment hit counter (non-blocking)
      sql`UPDATE redirects SET hits = hits + 1 WHERE id = ${redirect.id as string}`.catch(() => {})

      return c.redirect(redirect.to_path as string, redirect.type as 301 | 302)
    }
  } catch {
    // Redirect lookup failure should never break the request
  }

  return next()
})
