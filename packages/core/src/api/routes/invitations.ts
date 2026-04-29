import { Hono } from 'hono'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getClient } from '../../db/client'
import { requireAuth, signToken, signRefreshToken } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { logActivity } from '../../lib/activity-logger'
import { sendInvitationEmail } from '../../lib/email'

export const invitationRoutes = new Hono<AuthEnv>()

// Send invitation
invitationRoutes.post('/admin/invitations', requireAuth, requirePermission('users'), async (c) => {
  const currentUser = c.get('user')
  const body = await c.req.json<{ email: string; roleId: string }>()

  if (!body.email || !body.roleId) {
    return c.json({ error: { code: 'VALIDATION', message: 'Email and roleId are required' } }, 400)
  }

  const sql = getClient()

  // Check if user already exists
  const existingUser = await sql`SELECT id FROM users WHERE email = ${body.email} LIMIT 1`
  if (existingUser.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'A user with this email already exists' } }, 400)
  }

  // Check if pending invitation exists
  const existingInvite = await sql`
    SELECT id FROM invitations
    WHERE email = ${body.email} AND accepted_at IS NULL AND expires_at > now()
    LIMIT 1
  `
  if (existingInvite.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'A pending invitation already exists for this email' } }, 400)
  }

  // Verify role exists
  const roleRows = await sql`SELECT id, name FROM roles WHERE id = ${body.roleId} LIMIT 1`
  if (roleRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Role not found' } }, 404)
  }

  const token = crypto.randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  const rows = await sql`
    INSERT INTO invitations (email, role_id, token, invited_by, expires_at)
    VALUES (${body.email}, ${body.roleId}, ${token}, ${currentUser.sub}, ${expiresAt.toISOString()})
    RETURNING *
  `

  // Send invitation email (non-blocking)
  const adminUrl = process.env.ADMIN_URL || 'http://localhost:3001/admin'
  const siteName = process.env.SITE_NAME || 'CMS'
  sendInvitationEmail({
    to: body.email,
    token,
    adminUrl,
    siteName,
    roleName: (roleRows[0] as Record<string, unknown>).name as string,
  }).catch((err) => console.error('[Invitation] Failed to send email:', err))

  await logActivity({
    userId: currentUser.sub,
    action: 'user.invited',
    resource: 'invitation',
    resourceId: (rows[0] as Record<string, unknown>).id as string,
    metadata: { email: body.email },
  })

  return c.json({ data: rows[0] }, 201)
})

// List pending invitations
invitationRoutes.get('/admin/invitations', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const rows = await sql`
    SELECT i.*, r.name as role_name, u.name as invited_by_name, u.email as invited_by_email
    FROM invitations i
    LEFT JOIN roles r ON r.id = i.role_id
    LEFT JOIN users u ON u.id = i.invited_by
    ORDER BY i.created_at DESC
  `
  return c.json({ data: rows })
})

// Revoke invitation
invitationRoutes.delete('/admin/invitations/:id', requireAuth, requirePermission('users'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()

  const rows = await sql`DELETE FROM invitations WHERE id = ${id} AND accepted_at IS NULL RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Invitation not found or already accepted' } }, 404)
  }

  return c.json({ ok: true })
})

// Accept invitation (public route — no auth required)
invitationRoutes.post('/auth/accept-invitation', async (c) => {
  const body = await c.req.json<{ token: string; name: string; password: string }>()

  if (!body.token || !body.name || !body.password) {
    return c.json({ error: { code: 'VALIDATION', message: 'Token, name, and password are required' } }, 400)
  }

  if (body.password.length < 8) {
    return c.json({ error: { code: 'VALIDATION', message: 'Password must be at least 8 characters' } }, 400)
  }

  const sql = getClient()

  // Find valid invitation
  const invRows = await sql`
    SELECT * FROM invitations
    WHERE token = ${body.token} AND accepted_at IS NULL AND expires_at > now()
    LIMIT 1
  `

  if (invRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Invalid or expired invitation' } }, 404)
  }

  const invitation = invRows[0] as Record<string, unknown>
  const passwordHash = await bcrypt.hash(body.password, 10)

  // Create user
  const userRows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${invitation.email as string}, ${passwordHash}, ${body.name})
    RETURNING id, email, name, created_at, updated_at
  `

  const user = userRows[0] as Record<string, unknown>

  // Assign role
  await sql`
    INSERT INTO user_roles (user_id, role_id)
    VALUES (${user.id as string}, ${invitation.role_id as string})
  `

  // Mark invitation as accepted
  await sql`UPDATE invitations SET accepted_at = now() WHERE id = ${invitation.id as string}`

  // Generate tokens
  const tokenPayload = { sub: user.id as string, email: user.email as string }
  const accessToken = signToken(tokenPayload)
  const refreshToken = signRefreshToken(tokenPayload)

  await logActivity({
    userId: user.id as string,
    action: 'user.created',
    resource: 'user',
    resourceId: user.id as string,
    metadata: { email: user.email, invitedBy: invitation.invited_by },
  })

  return c.json({
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      createdAt: user.created_at,
      updatedAt: user.updated_at,
    },
    accessToken,
    refreshToken,
  }, 201)
})
