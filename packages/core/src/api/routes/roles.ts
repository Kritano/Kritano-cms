import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { logActivity } from '../../lib/activity-logger'

export const roleRoutes = new Hono<AuthEnv>()

// List all roles
roleRoutes.get('/admin/roles', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const rows = await sql`
    SELECT r.*,
      (SELECT COUNT(*)::int FROM user_roles ur WHERE ur.role_id = r.id) as user_count
    FROM roles r
    ORDER BY r.is_system DESC, r.name ASC
  `
  return c.json({ data: rows })
})

// Get single role
roleRoutes.get('/admin/roles/:id', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const id = c.req.param('id')
  const rows = await sql`SELECT * FROM roles WHERE id = ${id} LIMIT 1`

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404)
  }

  return c.json({ data: rows[0] })
})

// Create custom role
roleRoutes.post('/admin/roles', requireAuth, requirePermission('users'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ name: string; description?: string; permissions: Record<string, unknown> }>()

  if (!body.name || !body.permissions) {
    return c.json({ error: { code: 'VALIDATION', message: 'Name and permissions are required' } }, 400)
  }

  const sql = getClient()

  // Check for duplicate name
  const existing = await sql`SELECT id FROM roles WHERE name = ${body.name} LIMIT 1`
  if (existing.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'A role with this name already exists' } }, 400)
  }

  const rows = await sql`
    INSERT INTO roles (name, description, permissions, is_system)
    VALUES (${body.name}, ${body.description || null}, ${JSON.stringify(body.permissions)}::jsonb, false)
    RETURNING *
  `

  await logActivity({
    userId: user.sub,
    action: 'role.created',
    resource: 'role',
    resourceId: (rows[0] as Record<string, unknown>).id as string,
    metadata: { name: body.name },
  })

  return c.json({ data: rows[0] }, 201)
})

// Update role permissions
roleRoutes.put('/admin/roles/:id', requireAuth, requirePermission('users'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const body = await c.req.json<{ name?: string; description?: string; permissions?: Record<string, unknown> }>()

  const sql = getClient()
  const existing = await sql`SELECT * FROM roles WHERE id = ${id} LIMIT 1`
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404)
  }

  const setClauses: string[] = []
  const values: any[] = []
  let idx = 1

  if (body.name !== undefined) {
    setClauses.push(`"name" = $${idx}`)
    values.push(body.name)
    idx++
  }
  if (body.description !== undefined) {
    setClauses.push(`"description" = $${idx}`)
    values.push(body.description)
    idx++
  }
  if (body.permissions !== undefined) {
    setClauses.push(`"permissions" = $${idx}::jsonb`)
    values.push(JSON.stringify(body.permissions))
    idx++
  }

  if (setClauses.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
  }

  values.push(id)
  const rows = await sql.unsafe(
    `UPDATE "roles" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
    values,
  )

  await logActivity({
    userId: user.sub,
    action: 'role.updated',
    resource: 'role',
    resourceId: id,
    metadata: { name: (rows[0] as Record<string, unknown>).name },
  })

  return c.json({ data: rows[0] })
})

// Delete role (system roles cannot be deleted)
roleRoutes.delete('/admin/roles/:id', requireAuth, requirePermission('users'), async (c) => {
  const user = c.get('user')
  const id = c.req.param('id')
  const sql = getClient()

  const existing = await sql`SELECT * FROM roles WHERE id = ${id} LIMIT 1`
  if (existing.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404)
  }

  const role = existing[0] as Record<string, unknown>
  if (role.is_system) {
    return c.json({ error: { code: 'FORBIDDEN', message: 'System roles cannot be deleted' } }, 403)
  }

  await sql`DELETE FROM roles WHERE id = ${id}`

  await logActivity({
    userId: user.sub,
    action: 'role.deleted',
    resource: 'role',
    resourceId: id,
    metadata: { name: role.name },
  })

  return c.json({ ok: true })
})
