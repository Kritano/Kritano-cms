import { Hono } from 'hono'
import jwt from 'jsonwebtoken'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { collectionToTableName } from '../../db/schema-generator'

export const previewRoutes = new Hono<AuthEnv>()

const PREVIEW_TOKEN_EXPIRY = '2h'

interface PreviewTokenPayload {
  documentId: string
  collection: string
  type: 'preview'
}

function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET
  if (!secret) throw new Error('JWT_SECRET environment variable is required')
  return secret
}

function signPreviewToken(payload: PreviewTokenPayload): string {
  return jwt.sign(payload, getJwtSecret(), { expiresIn: PREVIEW_TOKEN_EXPIRY } as jwt.SignOptions)
}

function verifyPreviewToken(token: string): PreviewTokenPayload {
  const payload = jwt.verify(token, getJwtSecret()) as PreviewTokenPayload & { type?: string }
  if (payload.type !== 'preview') {
    throw new Error('Invalid token type')
  }
  return payload
}

// POST /api/preview/token — generate a preview token
previewRoutes.post('/preview/token', requireAuth, async (c) => {
  const body = await c.req.json<{ documentId: string; collection: string }>()

  if (!body.documentId || !body.collection) {
    return c.json({ error: { code: 'VALIDATION', message: 'documentId and collection are required' } }, 400)
  }

  // Verify document exists
  const sql = getClient()
  const tableName = collectionToTableName(body.collection)

  try {
    const rows = await sql.unsafe(
      `SELECT id FROM "${tableName}" WHERE id = $1 LIMIT 1`,
      [body.documentId],
    )
    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }
  } catch {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, 404)
  }

  const token = signPreviewToken({
    documentId: body.documentId,
    collection: body.collection,
    type: 'preview',
  })

  return c.json({ token })
})

// GET /api/preview/validate — validate a preview token (used by frontends)
previewRoutes.get('/preview/validate', async (c) => {
  const token = c.req.query('token')

  if (!token) {
    return c.json({ valid: false, error: 'Token is required' }, 400)
  }

  try {
    const payload = verifyPreviewToken(token)
    return c.json({
      valid: true,
      documentId: payload.documentId,
      collection: payload.collection,
    })
  } catch (err) {
    const message = err instanceof Error && err.name === 'TokenExpiredError'
      ? 'Preview token has expired'
      : 'Invalid preview token'
    return c.json({ valid: false, error: message }, 401)
  }
})

// GET /api/:collection/:id/preview — get draft content using preview token
previewRoutes.get('/:collection/:id/preview', async (c) => {
  const collection = c.req.param('collection')
  const id = c.req.param('id')
  const token = c.req.query('cms_preview')

  if (!token) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Preview token is required' } }, 401)
  }

  let payload: PreviewTokenPayload
  try {
    payload = verifyPreviewToken(token)
  } catch (err) {
    const message = err instanceof Error && err.name === 'TokenExpiredError'
      ? 'Preview token has expired'
      : 'Invalid preview token'
    return c.json({ error: { code: 'UNAUTHORIZED', message } }, 401)
  }

  // Token must match the requested document
  if (payload.collection !== collection || payload.documentId !== id) {
    return c.json({ error: { code: 'UNAUTHORIZED', message: 'Token does not match this document' } }, 401)
  }

  const sql = getClient()
  const tableName = collectionToTableName(collection)

  try {
    const rows = await sql.unsafe(
      `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`,
      [id],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    return c.json({ data: rows[0], preview: true })
  } catch {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Collection not found' } }, 404)
  }
})
