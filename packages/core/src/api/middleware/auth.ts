import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import type { JwtPayload } from '@kritano/cms/types'
import { getClient } from '../../db/client'

export type AuthEnv = {
  Variables: {
    user: JwtPayload
    apiKeyScopes: string[] | null // null = JWT user (full access via roles), string[] = API key scopes
  }
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, getJwtSecret()) as JwtPayload
}

export function signToken(payload: { sub: string; email: string }, expiresIn: string = '1h'): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn } as jwt.SignOptions)
}

export function signRefreshToken(payload: { sub: string; email: string }): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: '30d' } as jwt.SignOptions)
}

async function tryApiKeyAuth(token: string): Promise<{ payload: JwtPayload; scopes: string[] } | null> {
  if (!token.startsWith('cms_live_')) return null

  const prefix = token.substring(0, 16)
  const sql = getClient()

  const rows = await sql`
    SELECT id, key_hash, permissions, expires_at
    FROM api_keys
    WHERE key_prefix = ${prefix}
    LIMIT 1
  `

  if (rows.length === 0) return null

  const keyRecord = rows[0] as Record<string, unknown>

  // Check expiry
  if (keyRecord.expires_at) {
    const expiresAt = new Date(keyRecord.expires_at as string)
    if (expiresAt < new Date()) return null
  }

  // Verify hash
  const valid = await bcrypt.compare(token, keyRecord.key_hash as string)
  if (!valid) return null

  // Update last_used (non-blocking)
  sql`UPDATE api_keys SET last_used = now() WHERE id = ${keyRecord.id as string}`.catch(() => {})

  // Return synthetic JWT payload for API key
  const scopes = keyRecord.permissions as string[]

  return {
    payload: {
      sub: `apikey:${keyRecord.id}`,
      email: 'api-key@system',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    },
    scopes,
  }
}

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } }, 401)
  }

  const token = header.slice(7)

  // Try API key auth first if it looks like one
  if (token.startsWith('cms_live_')) {
    const result = await tryApiKeyAuth(token)
    if (result) {
      c.set('user', result.payload)
      c.set('apiKeyScopes', result.scopes)
      return next()
    }
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid API key' } }, 401)
  }

  // JWT auth
  try {
    const payload = verifyToken(token)
    c.set('user', payload)
    c.set('apiKeyScopes', null)
    await next()
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401)
  }
})

export const optionalAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    const token = header.slice(7)

    if (token.startsWith('cms_live_')) {
      const result = await tryApiKeyAuth(token)
      if (result) {
        c.set('user', result.payload)
        c.set('apiKeyScopes', result.scopes)
      }
    } else {
      try {
        const payload = verifyToken(token)
        c.set('user', payload)
        c.set('apiKeyScopes', null)
      } catch {
        // Invalid token — continue without auth
      }
    }
  }
  await next()
})

// Scope checking helper for API key requests
export function requireScope(scope: string) {
  return createMiddleware<AuthEnv>(async (c, next) => {
    const scopes = c.get('apiKeyScopes')

    // null means JWT user — defer to role-based permission middleware
    if (scopes === null || scopes === undefined) {
      return next()
    }

    // API key — check scopes
    if (!scopes.includes(scope)) {
      return c.json({ error: { code: 'FORBIDDEN', message: `API key missing required scope: ${scope}` } }, 403)
    }

    return next()
  })
}
