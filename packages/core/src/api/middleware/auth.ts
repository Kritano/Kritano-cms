import { createMiddleware } from 'hono/factory'
import jwt from 'jsonwebtoken'
import type { JwtPayload } from '@cms/types'

export type AuthEnv = {
  Variables: {
    user: JwtPayload
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

export const requireAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (!header?.startsWith('Bearer ')) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Missing or invalid authorization header' } }, 401)
  }

  const token = header.slice(7)
  try {
    const payload = verifyToken(token)
    c.set('user', payload)
    await next()
  } catch {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } }, 401)
  }
})

export const optionalAuth = createMiddleware<AuthEnv>(async (c, next) => {
  const header = c.req.header('Authorization')
  if (header?.startsWith('Bearer ')) {
    try {
      const payload = verifyToken(header.slice(7))
      c.set('user', payload)
    } catch {
      // Invalid token — continue without auth
    }
  }
  await next()
})
