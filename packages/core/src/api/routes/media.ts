import { Hono } from 'hono'
import sharp from 'sharp'
import { v4 as uuidv4 } from 'uuid'
import { mkdir, writeFile, unlink } from 'node:fs/promises'
import { join, extname } from 'node:path'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'

function getMediaPath(): string {
  return process.env.MEDIA_PATH || './media'
}

function getMediaUrl(): string {
  const siteUrl = process.env.SITE_URL || 'http://localhost:3000'
  return `${siteUrl}/media`
}

export const mediaRoutes = new Hono<AuthEnv>()

// POST /api/media/upload
mediaRoutes.post('/media/upload', requireAuth, async (c) => {
  const formData = await c.req.formData()
  const file = formData.get('file') as File | null

  if (!file) {
    return c.json({ error: { code: 'VALIDATION', message: 'No file provided' } }, 400)
  }

  const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml', 'application/pdf']
  if (!allowedTypes.includes(file.type)) {
    return c.json({ error: { code: 'VALIDATION', message: `File type ${file.type} is not allowed` } }, 400)
  }

  const buffer = Buffer.from(await file.arrayBuffer())
  const id = uuidv4()
  const ext = extname(file.name) || '.bin'
  const filename = `${id}${ext}`
  const webpFilename = `${id}.webp`
  const thumbFilename = `${id}_thumb.webp`

  const mediaPath = getMediaPath()
  await mkdir(mediaPath, { recursive: true })

  // Save original
  await writeFile(join(mediaPath, filename), buffer)

  let width: number | null = null
  let height: number | null = null
  let webpSaved = false

  // Process images with Sharp (skip SVG and PDF)
  if (file.type.startsWith('image/') && file.type !== 'image/svg+xml') {
    try {
      const metadata = await sharp(buffer).metadata()
      width = metadata.width || null
      height = metadata.height || null

      // Convert to WebP
      await sharp(buffer)
        .webp({ quality: 85 })
        .toFile(join(mediaPath, webpFilename))
      webpSaved = true

      // Generate thumbnail (400px wide)
      await sharp(buffer)
        .resize(400, null, { withoutEnlargement: true })
        .webp({ quality: 80 })
        .toFile(join(mediaPath, thumbFilename))
    } catch (err) {
      console.error('Sharp processing error:', err)
    }
  }

  const baseUrl = getMediaUrl()
  const url = webpSaved ? `${baseUrl}/${webpFilename}` : `${baseUrl}/${filename}`
  const thumbnailUrl = webpSaved ? `${baseUrl}/${thumbFilename}` : null

  const sql = getClient()
  const rows = await sql`
    INSERT INTO media (id, filename, original_filename, mime_type, size, width, height, alt, url, thumbnail_url)
    VALUES (${id}, ${filename}, ${file.name}, ${file.type}, ${file.size}, ${width}, ${height}, ${null}, ${url}, ${thumbnailUrl})
    RETURNING *
  `

  return c.json({ media: rows[0] }, 201)
})

// GET /api/media — List all media (with optional folder filter)
mediaRoutes.get('/media', requireAuth, async (c) => {
  const sql = getClient()
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
  const offset = (page - 1) * limit
  const folderId = c.req.query('folderId')

  let countResult
  let rows
  if (folderId === 'null') {
    // Root level — no folder
    countResult = await sql`SELECT COUNT(*)::int as total FROM media WHERE folder_id IS NULL`
    rows = await sql`SELECT * FROM media WHERE folder_id IS NULL ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  } else if (folderId) {
    countResult = await sql`SELECT COUNT(*)::int as total FROM media WHERE folder_id = ${folderId}`
    rows = await sql`SELECT * FROM media WHERE folder_id = ${folderId} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  } else {
    // All media
    countResult = await sql`SELECT COUNT(*)::int as total FROM media`
    rows = await sql`SELECT * FROM media ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`
  }
  const total = parseInt((countResult[0] as Record<string, unknown>).total as string, 10)

  return c.json({
    data: rows,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  })
})

// PATCH /api/media/:id — Update alt text
mediaRoutes.patch('/media/:id', requireAuth, async (c) => {
  const sql = getClient()
  const id = c.req.param('id')
  const body = await c.req.json<{ alt?: string }>()

  const rows = await sql`
    UPDATE media SET alt = ${body.alt || null}, updated_at = now() WHERE id = ${id} RETURNING *
  `

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Media not found' } }, 404)
  }

  return c.json({ data: rows[0] })
})

// DELETE /api/media/:id
mediaRoutes.delete('/media/:id', requireAuth, async (c) => {
  const sql = getClient()
  const id = c.req.param('id')

  const rows = await sql`SELECT * FROM media WHERE id = ${id} LIMIT 1`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Media not found' } }, 404)
  }

  const media = rows[0] as Record<string, unknown>
  const mediaPath = getMediaPath()

  // Delete files
  try {
    await unlink(join(mediaPath, media.filename as string))
  } catch { /* file may not exist */ }

  // Delete WebP and thumbnail variants
  const baseName = (media.filename as string).replace(/\.[^.]+$/, '')
  try { await unlink(join(mediaPath, `${baseName}.webp`)) } catch { /* ok */ }
  try { await unlink(join(mediaPath, `${baseName}_thumb.webp`)) } catch { /* ok */ }

  await sql`DELETE FROM media WHERE id = ${id}`

  return c.json({ ok: true })
})
