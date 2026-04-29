import { createMiddleware } from 'hono/factory'
import type { AuthEnv } from './auth'
import { getUserRoles, checkPermission } from '../../lib/permissions'

export function requirePermission(permission: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const user = c.get('user')
    if (!user) {
      return c.json({ error: { code: 'UNAUTHORIZED', message: 'Authentication required' } }, 401)
    }

    const roles = await getUserRoles(user.sub)

    // No roles assigned — deny access
    if (roles.length === 0) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
    }

    const collection = c.req.param('collection') || undefined
    const hasPermission = checkPermission(roles, permission, {
      collection,
      userId: user.sub,
    })

    if (!hasPermission) {
      return c.json({ error: { code: 'FORBIDDEN', message: 'Insufficient permissions' } }, 403)
    }

    await next()
  })
}
