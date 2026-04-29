import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { logActivity } from '../../lib/activity-logger'

export const userRoutes = new Hono<AuthEnv>()

// List users with their roles
userRoutes.get('/admin/users', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = (page - 1) * limit

  const countResult = await sql`SELECT COUNT(*)::int as total FROM users`
  const total = (countResult[0] as Record<string, unknown>).total as number

  const rows = await sql`
    SELECT
      u.id, u.email, u.name, u.two_factor_enabled, u.created_at, u.updated_at,
      COALESCE(
        json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) as roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    GROUP BY u.id
    ORDER BY u.created_at DESC
    LIMIT ${limit} OFFSET ${offset}
  `

  return c.json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
})

// Get single user
userRoutes.get('/admin/users/:id', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const id = c.req.param('id')

  const rows = await sql`
    SELECT
      u.id, u.email, u.name, u.two_factor_enabled, u.created_at, u.updated_at,
      COALESCE(
        json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) as roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${id}
    GROUP BY u.id
  `

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  return c.json({ data: rows[0] })
})

// Assign role to user
userRoutes.post('/admin/users/:id/roles', requireAuth, requirePermission('users'), async (c) => {
  const currentUser = c.get('user')
  const userId = c.req.param('id')
  const body = await c.req.json<{ roleId: string }>()

  if (!body.roleId) {
    return c.json({ error: { code: 'VALIDATION', message: 'roleId is required' } }, 400)
  }

  const sql = getClient()

  // Verify user exists
  const userRows = await sql`SELECT id, name FROM users WHERE id = ${userId} LIMIT 1`
  if (userRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  // Verify role exists
  const roleRows = await sql`SELECT id, name FROM roles WHERE id = ${body.roleId} LIMIT 1`
  if (roleRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404)
  }

  // Assign (ignore if already assigned)
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${userId}, ${body.roleId})
    ON CONFLICT (user_id, role_id) DO NOTHING
  `

  const role = roleRows[0] as Record<string, unknown>
  await logActivity({
    userId: currentUser.sub,
    action: 'user.role_changed',
    resource: 'user',
    resourceId: userId,
    metadata: { roleName: role.name, action: 'assigned' },
  })

  return c.json({ ok: true })
})

// Remove role from user
userRoutes.delete('/admin/users/:id/roles/:roleId', requireAuth, requirePermission('users'), async (c) => {
  const currentUser = c.get('user')
  const userId = c.req.param('id')
  const roleId = c.req.param('roleId')

  const sql = getClient()

  const result = await sql`
    DELETE FROM user_roles WHERE user_id = ${userId} AND role_id = ${roleId}
  `

  await logActivity({
    userId: currentUser.sub,
    action: 'user.role_changed',
    resource: 'user',
    resourceId: userId,
    metadata: { roleId, action: 'removed' },
  })

  return c.json({ ok: true })
})

// Deactivate user (soft delete — for v0.2 we delete but could add a status column later)
userRoutes.delete('/admin/users/:id', requireAuth, requirePermission('users'), async (c) => {
  const currentUser = c.get('user')
  const userId = c.req.param('id')

  if (currentUser.sub === userId) {
    return c.json({ error: { code: 'VALIDATION', message: 'Cannot deactivate your own account' } }, 400)
  }

  const sql = getClient()
  const rows = await sql`SELECT id, name, email FROM users WHERE id = ${userId} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  // Remove role assignments first, then delete user
  await sql`DELETE FROM user_roles WHERE user_id = ${userId}`
  await sql`DELETE FROM users WHERE id = ${userId}`

  const user = rows[0] as Record<string, unknown>
  await logActivity({
    userId: currentUser.sub,
    action: 'user.deleted',
    resource: 'user',
    resourceId: userId,
    metadata: { email: user.email, name: user.name },
  })

  return c.json({ ok: true })
})
