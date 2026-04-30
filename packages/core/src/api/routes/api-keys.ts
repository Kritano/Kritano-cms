import { Hono } from 'hono'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'

export const apiKeyRoutes = new Hono<AuthEnv>()

// List API keys (never show full key or hash)
apiKeyRoutes.get('/admin/api-keys', requireAuth, requirePermission('settings'), async (c) => {
  const sql = getClient()
  const rows = await sql`
    SELECT id, name, key_prefix, permissions, last_used, expires_at, created_by, created_at
    FROM api_keys
    ORDER BY created_at DESC
  `
  return c.json({ data: rows })
})

// Create new API key
apiKeyRoutes.post('/admin/api-keys', requireAuth, requirePermission('settings'), async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{
    name: string
    permissions: string[]
    expiresAt?: string | null
  }>()

  if (!body.name || !body.permissions?.length) {
    return c.json({ error: { code: 'VALIDATION', message: 'Name and permissions are required' } }, 400)
  }

  // Validate scopes
  const validScopes = ['content:read', 'content:write', 'content:publish', 'media:read', 'media:write', 'schema:read']
  const invalidScopes = body.permissions.filter((s) => !validScopes.includes(s))
  if (invalidScopes.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: `Invalid scopes: ${invalidScopes.join(', ')}` } }, 400)
  }

  // Generate key
  const rawKey = `cms_live_${crypto.randomBytes(32).toString('hex')}`
  const keyPrefix = rawKey.substring(0, 16) // 'cms_live_xxxxxxx'
  const keyHash = await bcrypt.hash(rawKey, 10)

  const sql = getClient()
  const rows = await sql`
    INSERT INTO api_keys (name, key_hash, key_prefix, permissions, expires_at, created_by)
    VALUES (
      ${body.name},
      ${keyHash},
      ${keyPrefix},
      ${JSON.stringify(body.permissions)}::jsonb,
      ${body.expiresAt || null},
      ${user.sub}
    )
    RETURNING id, name, key_prefix, permissions, expires_at, created_by, created_at
  `

  // Return the full key ONCE — never stored, never retrievable again
  return c.json({
    data: {
      ...(rows[0] as Record<string, unknown>),
      key: rawKey,
    },
  }, 201)
})

// Revoke API key
apiKeyRoutes.delete('/admin/api-keys/:id', requireAuth, requirePermission('settings'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()

  const rows = await sql`DELETE FROM api_keys WHERE id = ${id} RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'API key not found' } }, 404)
  }

  return c.json({ ok: true })
})
