import { Hono } from 'hono'
import type { CollectionDefinition, FieldDefinition } from '@kritano/cms/types'
import { getClient } from '../../db/client'
import { collectionToTableName, fieldToColumnName } from '../../db/schema-generator'
import { requireAuth, optionalAuth, requireScope } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { createRevision } from '../../lib/revisions'
import { getScheduleQueue, type ScheduleJobData } from '../../lib/scheduler'
import { fromZonedTime } from 'date-fns-tz'
import { dispatchWebhookEvent } from '../../lib/webhooks'
import { upsertDocument, deleteDocument } from '../../search/indexer'

const JSONB_TYPES = new Set(['richText', 'seoBlock', 'blocks', 'multiSelect', 'array'])

function isJsonbField(field: FieldDefinition): boolean {
  return JSONB_TYPES.has(field.type)
}

function serializeValue(val: unknown, field: FieldDefinition, sql?: any): unknown {
  if (val === null || val === undefined) return null

  // For JSONB fields: use sql.json() to avoid double-encoding from the postgres driver
  if (isJsonbField(field) && sql) {
    let obj = val
    // If value is a string, parse it to get the actual object
    if (typeof obj === 'string') {
      try {
        obj = JSON.parse(obj)
        // Handle triple-encoding: if parsed result is still a string, parse again
        while (typeof obj === 'string') {
          try { obj = JSON.parse(obj) } catch { break }
        }
      } catch {
        return sql.json({})
      }
    }
    return sql.json(obj)
  }

  if (typeof val === 'object') return JSON.stringify(val)
  return val
}

export function createCollectionRoutes(collection: CollectionDefinition): Hono<AuthEnv> {
  const app = new Hono<AuthEnv>()
  const tableName = collectionToTableName(collection.name)

  // GET /api/:collection — List (paginated, filterable, sortable)
  app.get(`/${collection.name}`, optionalAuth, async (c) => {
    const sql = getClient()
    const page = parseInt(c.req.query('page') || '1', 10)
    const limit = Math.min(parseInt(c.req.query('limit') || '20', 10), 100)
    const offset = (page - 1) * limit
    const status = c.req.query('status')
    const sort = c.req.query('sort')
    const order = c.req.query('order') === 'asc' ? 'ASC' : 'DESC'
    const search = c.req.query('search')
    const user = c.get('user')

    // Build WHERE conditions
    const conditions: string[] = []
    const params: any[] = []

    // Non-authenticated users can only see published content
    if (!user) {
      conditions.push(`status = 'published'`)
    } else if (status) {
      conditions.push(`status = $${params.length + 1}`)
      params.push(status)
    }

    if (search) {
      conditions.push(`title ILIKE $${params.length + 1}`)
      params.push(`%${search}%`)
    }

    const whereClause = conditions.length > 0
      ? `WHERE ${conditions.join(' AND ')}`
      : ''

    // Sort column
    const sortCol = sort ? fieldToColumnName(sort) : 'created_at'
    const orderClause = `ORDER BY "${sortCol}" ${order}`

    // Count total
    const countResult = await sql.unsafe(
      `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`,
      params,
    )
    const total = parseInt((countResult[0] as Record<string, unknown>).total as string, 10)

    // Fetch rows with author info
    const rows = await sql.unsafe(
      `SELECT t.*, u.name as author_name, u.email as author_email
       FROM "${tableName}" t
       LEFT JOIN users u ON u.id = t.created_by
       ${whereClause ? whereClause.replace(/\b(status|title)\b/g, 't.$1') : ''}
       ORDER BY t."${sortCol}" ${order}
       LIMIT ${limit} OFFSET ${offset}`,
      params,
    )

    return c.json({
      data: rows,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    })
  })

  // GET /api/:collection/:id — Single by ID
  app.get(`/${collection.name}/:id`, optionalAuth, async (c) => {
    const sql = getClient()
    const id = c.req.param('id')
    const user = c.get('user')

    const rows = await sql.unsafe(
      `SELECT t.*, u.name as author_name, u.email as author_email
       FROM "${tableName}" t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.id = $1 LIMIT 1`,
      [id],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    const doc = rows[0] as Record<string, unknown>
    if (doc.status !== 'published' && !user) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    return c.json({ data: doc })
  })

  // GET /api/:collection/slug/:slug — Single by slug
  app.get(`/${collection.name}/slug/:slug`, optionalAuth, async (c) => {
    const sql = getClient()
    const slug = c.req.param('slug')
    const user = c.get('user')

    const rows = await sql.unsafe(
      `SELECT t.*, u.name as author_name, u.email as author_email
       FROM "${tableName}" t
       LEFT JOIN users u ON u.id = t.created_by
       WHERE t.slug = $1 LIMIT 1`,
      [slug],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    const doc = rows[0] as Record<string, unknown>
    if (doc.status !== 'published' && !user) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    return c.json({ data: doc })
  })

  // POST /api/:collection — Create
  app.post(`/${collection.name}`, requireAuth, requireScope('content:write'), async (c) => {
    const sql = getClient()
    const body = await c.req.json()
    const user = c.get('user')

    const columns: string[] = []
    const placeholders: string[] = []
    const values: any[] = []
    let idx = 1

    for (const [fieldName, field] of Object.entries(collection.fields)) {
      if (fieldName === 'status') continue // Handled by system column
      const colName = fieldToColumnName(fieldName)
      if (body[fieldName] !== undefined) {
        columns.push(`"${colName}"`)
        const jsonb = isJsonbField(field as FieldDefinition)
        placeholders.push(`$${idx}`)
        values.push(serializeValue(body[fieldName], field as FieldDefinition, sql))
        idx++
      }
    }

    // Add created_by and updated_by from authenticated user
    if (user?.sub) {
      columns.push('"created_by"')
      placeholders.push(`$${idx}`)
      values.push(user.sub)
      idx++
      columns.push('"updated_by"')
      placeholders.push(`$${idx}`)
      values.push(user.sub)
      idx++
    }

    const colList = columns.length > 0 ? `, ${columns.join(', ')}` : ''
    const phList = placeholders.length > 0 ? `, ${placeholders.join(', ')}` : ''

    const rows = await sql.unsafe(
      `INSERT INTO "${tableName}" (status${colList}) VALUES ('draft'${phList}) RETURNING *`,
      values,
    )

    dispatchWebhookEvent('content.created', { id: (rows[0] as Record<string, unknown>).id, collection: collection.name, document: rows[0] }).catch(() => {})

    return c.json({ data: rows[0] }, 201)
  })

  // PUT /api/:collection/:id — Full update (sets omitted fields to null)
  app.put(`/${collection.name}/:id`, requireAuth, requireScope('content:write'), async (c) => {
    const sql = getClient()
    const id = c.req.param('id')
    const body = await c.req.json()
    const user = c.get('user')

    // Snapshot current state before updating
    await createRevision(id, collection.name, tableName, user?.sub ?? null)

    const setClauses: string[] = []
    const values: any[] = []
    let idx = 1

    for (const [fieldName, field] of Object.entries(collection.fields)) {
      if (fieldName === 'status') continue
      if (body[fieldName] === undefined) continue
      const colName = fieldToColumnName(fieldName)
      const jsonb = isJsonbField(field as FieldDefinition)
      setClauses.push(`"${colName}" = ${`$${idx}`}`)
      values.push(serializeValue(body[fieldName], field as FieldDefinition, sql))
      idx++
    }

    if (setClauses.length === 0) {
      return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
    }

    setClauses.push(`"updated_at" = now()`)
    if (user?.sub) {
      setClauses.push(`"updated_by" = $${idx}`)
      values.push(user.sub)
      idx++
    }
    values.push(id)

    const rows = await sql.unsafe(
      `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    dispatchWebhookEvent('content.updated', { id, collection: collection.name, document: rows[0] }).catch(() => {})

    return c.json({ data: rows[0] })
  })

  // PATCH /api/:collection/:id — Partial update
  app.patch(`/${collection.name}/:id`, requireAuth, requireScope('content:write'), async (c) => {
    const sql = getClient()
    const id = c.req.param('id')
    const body = await c.req.json()
    const user = c.get('user')

    // Capture current slug before update (for redirect suggestion)
    let oldSlug: string | null = null
    if (body.slug !== undefined && collection.fields.slug) {
      const currentDoc = await sql.unsafe(
        `SELECT slug FROM "${tableName}" WHERE id = $1 LIMIT 1`,
        [id],
      )
      if (currentDoc.length > 0) {
        oldSlug = (currentDoc[0] as Record<string, unknown>).slug as string | null
      }
    }

    // Snapshot current state before updating
    await createRevision(id, collection.name, tableName, user?.sub ?? null)

    const setClauses: string[] = []
    const values: any[] = []
    let idx = 1

    for (const [fieldName, field] of Object.entries(collection.fields)) {
      if (fieldName === 'status') continue
      if (body[fieldName] === undefined) continue
      const colName = fieldToColumnName(fieldName)
      const jsonb = isJsonbField(field as FieldDefinition)
      setClauses.push(`"${colName}" = ${`$${idx}`}`)
      values.push(serializeValue(body[fieldName], field as FieldDefinition, sql))
      idx++
    }

    if (setClauses.length === 0) {
      return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
    }

    setClauses.push(`"updated_at" = now()`)
    values.push(id)

    const rows = await sql.unsafe(
      `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    dispatchWebhookEvent('content.updated', { id, collection: collection.name, document: rows[0] }).catch(() => {})

    // Slug change detection — suggest a redirect
    const newSlug = (rows[0] as Record<string, unknown>).slug as string | null
    let redirectSuggestion: { from: string; to: string; type: number } | undefined
    if (oldSlug && newSlug && oldSlug !== newSlug) {
      redirectSuggestion = {
        from: `/${collection.name}/${oldSlug}`,
        to: `/${collection.name}/${newSlug}`,
        type: 301,
      }
    }

    return c.json({ data: rows[0], ...(redirectSuggestion ? { redirectSuggestion } : {}) })
  })

  // DELETE /api/:collection/:id
  app.delete(`/${collection.name}/:id`, requireAuth, requireScope('content:write'), async (c) => {
    const sql = getClient()
    const id = c.req.param('id')

    const rows = await sql.unsafe(
      `DELETE FROM "${tableName}" WHERE id = $1 RETURNING id`,
      [id],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    dispatchWebhookEvent('content.deleted', { id, collection: collection.name }).catch(() => {})
    deleteDocument(collection.name, id).catch(() => {})

    return c.json({ ok: true })
  })

  // POST /api/:collection/:id/publish
  app.post(`/${collection.name}/:id/publish`, requireAuth, requireScope('content:publish'), async (c) => {
    const sql = getClient()
    const id = c.req.param('id')
    const user = c.get('user')

    // Snapshot before status change
    await createRevision(id, collection.name, tableName, user?.sub ?? null)

    const rows = await sql.unsafe(
      `UPDATE "${tableName}" SET status = 'published', published_at = now(), updated_at = now(), updated_by = $2 WHERE id = $1 RETURNING *`,
      [id, user?.sub ?? null],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    dispatchWebhookEvent('content.published', { id, collection: collection.name, document: rows[0] }).catch(() => {})
    upsertDocument(collection.name, rows[0] as Record<string, unknown>, collection.fields).catch(() => {})

    return c.json({ data: rows[0] })
  })

  // POST /api/:collection/:id/unpublish
  app.post(`/${collection.name}/:id/unpublish`, requireAuth, requireScope('content:publish'), async (c) => {
    const sql = getClient()
    const id = c.req.param('id')
    const user = c.get('user')

    // Snapshot before status change
    await createRevision(id, collection.name, tableName, user?.sub ?? null)

    const rows = await sql.unsafe(
      `UPDATE "${tableName}" SET status = 'draft', published_at = NULL, updated_at = now(), updated_by = $2 WHERE id = $1 RETURNING *`,
      [id, user?.sub ?? null],
    )

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    dispatchWebhookEvent('content.unpublished', { id, collection: collection.name, document: rows[0] }).catch(() => {})
    deleteDocument(collection.name, id).catch(() => {})

    return c.json({ data: rows[0] })
  })

  // ============================================================
  // Revision history routes
  // ============================================================

  // GET /api/:collection/:id/revisions — List revisions (newest first, max 50)
  app.get(`/${collection.name}/:id/revisions`, requireAuth, async (c) => {
    const sql = getClient()
    const documentId = c.req.param('id')

    // Verify document exists
    const docRows = await sql.unsafe(
      `SELECT id FROM "${tableName}" WHERE id = $1 LIMIT 1`,
      [documentId],
    )
    if (docRows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    const rows = await sql`
      SELECT
        r.id,
        r.created_at,
        r.created_by,
        u.name as created_by_name,
        u.email as created_by_email
      FROM revisions r
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.document_id = ${documentId} AND r.collection = ${collection.name}
      ORDER BY r.created_at DESC
      LIMIT 50
    `

    // Generate labels based on revision data
    const data = rows.map((row: Record<string, unknown>, index: number) => ({
      id: row.id,
      createdAt: row.created_at,
      createdBy: row.created_by ? {
        id: row.created_by,
        name: row.created_by_name || row.created_by_email,
      } : null,
      label: index === 0 ? 'Latest revision' : 'Saved',
    }))

    return c.json({ data })
  })

  // GET /api/:collection/:id/revisions/:revId — Get specific revision data
  app.get(`/${collection.name}/:id/revisions/:revId`, requireAuth, async (c) => {
    const documentId = c.req.param('id')
    const revId = c.req.param('revId')
    const sql = getClient()

    const rows = await sql`
      SELECT r.*, u.name as created_by_name, u.email as created_by_email
      FROM revisions r
      LEFT JOIN users u ON u.id = r.created_by
      WHERE r.id = ${revId} AND r.document_id = ${documentId} AND r.collection = ${collection.name}
      LIMIT 1
    `

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Revision not found' } }, 404)
    }

    const rev = rows[0] as Record<string, unknown>
    return c.json({
      data: {
        id: rev.id,
        documentId: rev.document_id,
        collection: rev.collection,
        data: rev.data,
        createdAt: rev.created_at,
        createdBy: rev.created_by ? {
          id: rev.created_by,
          name: rev.created_by_name || rev.created_by_email,
        } : null,
      },
    })
  })

  // POST /api/:collection/:id/revisions/:revId/restore — Restore document to this revision
  app.post(`/${collection.name}/:id/revisions/:revId/restore`, requireAuth, async (c) => {
    const documentId = c.req.param('id')
    const revId = c.req.param('revId')
    const user = c.get('user')
    const sql = getClient()

    // Verify document exists
    const docRows = await sql.unsafe(
      `SELECT id FROM "${tableName}" WHERE id = $1 LIMIT 1`,
      [documentId],
    )
    if (docRows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    // Get the revision to restore
    const revRows = await sql`
      SELECT * FROM revisions
      WHERE id = ${revId} AND document_id = ${documentId} AND collection = ${collection.name}
      LIMIT 1
    `
    if (revRows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Revision not found' } }, 404)
    }

    // Snapshot current state before restoring (so restore is never destructive)
    await createRevision(documentId, collection.name, tableName, user?.sub ?? null)

    // Apply revision data as an update
    const revisionData = (revRows[0] as Record<string, unknown>).data as Record<string, unknown>

    // Build SET clause from the revision data, excluding system fields we don't want to revert
    const excludeFields = new Set(['id', 'created_at'])
    const setClauses: string[] = []
    const values: any[] = []
    let idx = 1

    for (const [colName, value] of Object.entries(revisionData)) {
      if (excludeFields.has(colName)) continue
      if (typeof value === 'object' && value !== null) {
        setClauses.push(`"${colName}" = $${idx}`)
        values.push(sql.json(value as any))
      } else {
        setClauses.push(`"${colName}" = $${idx}`)
        values.push(value)
      }
      idx++
    }

    // Always update updated_at to now
    setClauses.push(`"updated_at" = now()`)
    values.push(documentId)

    const updatedRows = await sql.unsafe(
      `UPDATE "${tableName}" SET ${setClauses.join(', ')} WHERE id = $${idx} RETURNING *`,
      values,
    )

    return c.json({ data: updatedRows[0] })
  })

  // ============================================================
  // Scheduled publishing routes
  // ============================================================

  // POST /api/:collection/:id/schedule — Schedule a publish
  app.post(`/${collection.name}/:id/schedule`, requireAuth, async (c) => {
    const sql = getClient()
    const documentId = c.req.param('id')
    const user = c.get('user')
    const body = await c.req.json<{ scheduledFor: string; timezone?: string }>()

    if (!body.scheduledFor) {
      return c.json({ error: { code: 'VALIDATION', message: 'scheduledFor is required' } }, 400)
    }

    // Verify document exists
    const docRows = await sql.unsafe(
      `SELECT id, status FROM "${tableName}" WHERE id = $1 LIMIT 1`,
      [documentId],
    )
    if (docRows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Document not found' } }, 404)
    }

    const doc = docRows[0] as Record<string, unknown>
    if (doc.status === 'published') {
      return c.json({ error: { code: 'VALIDATION', message: 'Document is already published' } }, 400)
    }

    // Cancel any existing pending schedule for this document
    await sql`
      UPDATE scheduled_publishes
      SET status = 'cancelled'
      WHERE document_id = ${documentId} AND collection = ${collection.name} AND status = 'pending'
    `

    // Convert to UTC using timezone
    const timezone = body.timezone || 'UTC'
    const utcDate = fromZonedTime(new Date(body.scheduledFor), timezone)
    const delayMs = utcDate.getTime() - Date.now()

    if (delayMs <= 0) {
      return c.json({ error: { code: 'VALIDATION', message: 'Scheduled time must be in the future' } }, 400)
    }

    // Create schedule record
    const scheduleRows = await sql`
      INSERT INTO scheduled_publishes (document_id, collection, scheduled_for, timezone, created_by)
      VALUES (${documentId}, ${collection.name}, ${utcDate.toISOString()}, ${timezone}, ${user.sub})
      RETURNING *
    `

    const schedule = scheduleRows[0] as Record<string, unknown>

    // Enqueue BullMQ delayed job
    const queue = getScheduleQueue()
    const job = await queue.add(
      'publish',
      {
        scheduleId: schedule.id as string,
        documentId,
        collection: collection.name,
        tableName,
      } satisfies ScheduleJobData,
      { delay: delayMs, jobId: `schedule-${schedule.id}` },
    )

    // Update document status to 'scheduled'
    await sql.unsafe(
      `UPDATE "${tableName}" SET status = 'scheduled', updated_at = now() WHERE id = $1`,
      [documentId],
    )

    return c.json({ data: schedule }, 201)
  })

  // GET /api/:collection/:id/schedule — Get current schedule
  app.get(`/${collection.name}/:id/schedule`, requireAuth, async (c) => {
    const sql = getClient()
    const documentId = c.req.param('id')

    const rows = await sql`
      SELECT * FROM scheduled_publishes
      WHERE document_id = ${documentId} AND collection = ${collection.name} AND status = 'pending'
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (rows.length === 0) {
      return c.json({ data: null })
    }

    return c.json({ data: rows[0] })
  })

  // DELETE /api/:collection/:id/schedule — Cancel scheduled publish
  app.delete(`/${collection.name}/:id/schedule`, requireAuth, async (c) => {
    const sql = getClient()
    const documentId = c.req.param('id')

    const rows = await sql`
      UPDATE scheduled_publishes
      SET status = 'cancelled'
      WHERE document_id = ${documentId} AND collection = ${collection.name} AND status = 'pending'
      RETURNING *
    `

    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'No pending schedule found' } }, 404)
    }

    // Remove the BullMQ job
    const schedule = rows[0] as Record<string, unknown>
    try {
      const queue = getScheduleQueue()
      const job = await queue.getJob(`schedule-${schedule.id}`)
      if (job) await job.remove()
    } catch {
      // Job may have already been processed
    }

    // Revert document status to draft
    await sql.unsafe(
      `UPDATE "${tableName}" SET status = 'draft', updated_at = now() WHERE id = $1`,
      [documentId],
    )

    return c.json({ ok: true })
  })

  return app
}
