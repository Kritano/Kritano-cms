import { Hono } from 'hono'
import bcrypt from 'bcryptjs'
import crypto from 'node:crypto'
import { TOTP } from 'otpauth'
import QRCode from 'qrcode'
import { getClient } from '../../db/client'
import { signToken, signRefreshToken, requireAuth, verifyToken } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { logActivity } from '../../lib/activity-logger'

export const authRoutes = new Hono<AuthEnv>()

// Temporary tokens for 2FA challenge (in-memory, short-lived)
const twoFactorTokens = new Map<string, { userId: string; email: string; expiresAt: number }>()

// Clean expired tokens periodically
setInterval(() => {
  const now = Date.now()
  for (const [key, value] of twoFactorTokens) {
    if (value.expiresAt < now) twoFactorTokens.delete(key)
  }
}, 60_000)

authRoutes.post('/auth/login', async (c) => {
  const body = await c.req.json<{ email: string; password: string }>()

  if (!body.email || !body.password) {
    return c.json({ error: { code: 'VALIDATION', message: 'Email and password are required' } }, 400)
  }

  const sql = getClient()
  const rows = await sql`SELECT * FROM users WHERE email = ${body.email} LIMIT 1`

  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401)
  }

  const user = rows[0] as Record<string, unknown>
  const valid = await bcrypt.compare(body.password, user.password_hash as string)

  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid email or password' } }, 401)
  }

  // Check if 2FA is enabled
  if (user.two_factor_enabled) {
    const tempToken = crypto.randomBytes(32).toString('hex')
    twoFactorTokens.set(tempToken, {
      userId: user.id as string,
      email: user.email as string,
      expiresAt: Date.now() + 5 * 60 * 1000, // 5 minutes
    })

    return c.json({
      requires2fa: true,
      tempToken,
    })
  }

  const tokenPayload = { sub: user.id as string, email: user.email as string }
  const accessToken = signToken(tokenPayload)
  const refreshToken = signRefreshToken(tokenPayload)

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
  })
})

// 2FA challenge — verify TOTP code after password auth
authRoutes.post('/auth/2fa/challenge', async (c) => {
  const body = await c.req.json<{ tempToken: string; code: string }>()

  if (!body.tempToken || !body.code) {
    return c.json({ error: { code: 'VALIDATION', message: 'tempToken and code are required' } }, 400)
  }

  const pending = twoFactorTokens.get(body.tempToken)
  if (!pending || pending.expiresAt < Date.now()) {
    twoFactorTokens.delete(body.tempToken)
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired 2FA token' } }, 401)
  }

  const sql = getClient()
  const rows = await sql`SELECT * FROM users WHERE id = ${pending.userId} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'User not found' } }, 401)
  }

  const user = rows[0] as Record<string, unknown>
  const totp = new TOTP({ secret: user.two_factor_secret as string })
  const valid = totp.validate({ token: body.code, window: 1 }) !== null

  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid 2FA code' } }, 401)
  }

  // Clean up temp token
  twoFactorTokens.delete(body.tempToken)

  const tokenPayload = { sub: user.id as string, email: user.email as string }
  const accessToken = signToken(tokenPayload)
  const refreshToken = signRefreshToken(tokenPayload)

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
  })
})

authRoutes.post('/auth/refresh', async (c) => {
  const body = await c.req.json<{ refreshToken: string }>()

  if (!body.refreshToken) {
    return c.json({ error: { code: 'VALIDATION', message: 'Refresh token is required' } }, 400)
  }

  try {
    const payload = verifyToken(body.refreshToken)
    const accessToken = signToken({ sub: payload.sub, email: payload.email })
    const refreshToken = signRefreshToken({ sub: payload.sub, email: payload.email })
    return c.json({ accessToken, refreshToken })
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid refresh token' } }, 401)
  }
})

authRoutes.post('/auth/logout', requireAuth, async (c) => {
  return c.json({ ok: true })
})

authRoutes.get('/auth/me', requireAuth, async (c) => {
  const user = c.get('user')
  const sql = getClient()
  const rows = await sql`
    SELECT u.id, u.email, u.name, u.two_factor_enabled, u.created_at, u.updated_at,
      COALESCE(
        json_agg(json_build_object('id', r.id, 'name', r.name)) FILTER (WHERE r.id IS NOT NULL),
        '[]'
      ) as roles
    FROM users u
    LEFT JOIN user_roles ur ON ur.user_id = u.id
    LEFT JOIN roles r ON r.id = ur.role_id
    WHERE u.id = ${user.sub}
    GROUP BY u.id
    LIMIT 1
  `

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const row = rows[0] as Record<string, unknown>
  return c.json({
    data: {
      id: row.id,
      email: row.email,
      name: row.name,
      twoFactorEnabled: row.two_factor_enabled,
      roles: row.roles,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    },
  })
})

// Change password
authRoutes.post('/auth/change-password', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ currentPassword: string; newPassword: string }>()

  if (!body.currentPassword || !body.newPassword) {
    return c.json({ error: { code: 'VALIDATION', message: 'Current password and new password are required' } }, 400)
  }

  if (body.newPassword.length < 8) {
    return c.json({ error: { code: 'VALIDATION', message: 'New password must be at least 8 characters' } }, 400)
  }

  const sql = getClient()
  const rows = await sql`SELECT password_hash FROM users WHERE id = ${user.sub} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const valid = await bcrypt.compare(body.currentPassword, (rows[0] as Record<string, unknown>).password_hash as string)
  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Current password is incorrect' } }, 401)
  }

  const newHash = await bcrypt.hash(body.newPassword, 10)
  await sql`UPDATE users SET password_hash = ${newHash}, updated_at = now() WHERE id = ${user.sub}`

  return c.json({ ok: true })
})

// 2FA setup — generate TOTP secret and QR code
authRoutes.post('/auth/2fa/setup', requireAuth, async (c) => {
  const user = c.get('user')
  const sql = getClient()

  const rows = await sql`SELECT email, two_factor_enabled FROM users WHERE id = ${user.sub} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const userRow = rows[0] as Record<string, unknown>
  if (userRow.two_factor_enabled) {
    return c.json({ error: { code: 'VALIDATION', message: '2FA is already enabled' } }, 400)
  }

  const siteName = process.env.SITE_NAME || 'CMS'
  const totp = new TOTP({
    issuer: siteName,
    label: userRow.email as string,
  })

  const secret = totp.secret.base32
  const otpauthUrl = totp.toString()

  // Store secret temporarily (not yet enabled)
  await sql`UPDATE users SET two_factor_secret = ${secret} WHERE id = ${user.sub}`

  // Generate QR code as data URL
  const qrCodeDataUrl = await QRCode.toDataURL(otpauthUrl)

  return c.json({
    data: {
      secret,
      qrCode: qrCodeDataUrl,
      otpauthUrl,
    },
  })
})

// 2FA verify — confirm TOTP code and enable 2FA
authRoutes.post('/auth/2fa/verify', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ code: string }>()

  if (!body.code) {
    return c.json({ error: { code: 'VALIDATION', message: 'Code is required' } }, 400)
  }

  const sql = getClient()
  const rows = await sql`SELECT two_factor_secret, two_factor_enabled FROM users WHERE id = ${user.sub} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const userRow = rows[0] as Record<string, unknown>
  if (userRow.two_factor_enabled) {
    return c.json({ error: { code: 'VALIDATION', message: '2FA is already enabled' } }, 400)
  }

  if (!userRow.two_factor_secret) {
    return c.json({ error: { code: 'VALIDATION', message: 'Run 2FA setup first' } }, 400)
  }

  const totp = new TOTP({ secret: userRow.two_factor_secret as string })
  const valid = totp.validate({ token: body.code, window: 1 }) !== null

  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid 2FA code' } }, 401)
  }

  await sql`UPDATE users SET two_factor_enabled = true WHERE id = ${user.sub}`

  await logActivity({
    userId: user.sub,
    action: 'user.2fa_enabled',
    resource: 'user',
    resourceId: user.sub,
  })

  return c.json({ ok: true })
})

// 2FA disable — requires password
authRoutes.post('/auth/2fa/disable', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ password: string }>()

  if (!body.password) {
    return c.json({ error: { code: 'VALIDATION', message: 'Password is required' } }, 400)
  }

  const sql = getClient()
  const rows = await sql`SELECT password_hash, two_factor_enabled FROM users WHERE id = ${user.sub} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  const userRow = rows[0] as Record<string, unknown>
  if (!userRow.two_factor_enabled) {
    return c.json({ error: { code: 'VALIDATION', message: '2FA is not enabled' } }, 400)
  }

  const valid = await bcrypt.compare(body.password, userRow.password_hash as string)
  if (!valid) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid password' } }, 401)
  }

  await sql`UPDATE users SET two_factor_enabled = false, two_factor_secret = null WHERE id = ${user.sub}`

  await logActivity({
    userId: user.sub,
    action: 'user.2fa_disabled',
    resource: 'user',
    resourceId: user.sub,
  })

  return c.json({ ok: true })
})
