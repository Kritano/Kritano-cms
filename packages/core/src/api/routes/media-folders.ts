import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import type { CmsConfig } from '@kritano/cms/types'
import { collectionToTableName } from '../../db/schema-generator'

export function createMediaFolderRoutes(config: CmsConfig): Hono<AuthEnv> {
  const routes = new Hono<AuthEnv>()

  // List folders
  routes.get('/admin/media/folders', requireAuth, async (c) => {
    const sql = getClient()
    const rows = await sql`
      SELECT mf.*,
        (SELECT COUNT(*)::int FROM media m WHERE m.folder_id = mf.id) as file_count
      FROM media_folders mf
      ORDER BY mf.name ASC
    `
    return c.json({ data: rows })
  })

  // Create folder
  routes.post('/admin/media/folders', requireAuth, async (c) => {
    const body = await c.req.json<{ name: string; parentId?: string | null }>()
    if (!body.name) {
      return c.json({ error: { code: 'VALIDATION', message: 'Name is required' } }, 400)
    }

    const sql = getClient()
    const rows = await sql`
      INSERT INTO media_folders (name, parent_id)
      VALUES (${body.name}, ${body.parentId || null})
      RETURNING *
    `
    return c.json({ data: rows[0] }, 201)
  })

  // Rename folder
  routes.patch('/admin/media/folders/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ name: string }>()
    const sql = getClient()

    const rows = await sql`UPDATE media_folders SET name = ${body.name} WHERE id = ${id} RETURNING *`
    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Folder not found' } }, 404)
    }
    return c.json({ data: rows[0] })
  })

  // Delete folder (must be empty)
  routes.delete('/admin/media/folders/:id', requireAuth, async (c) => {
    const id = c.req.param('id')
    const sql = getClient()

    const fileCount = await sql`SELECT COUNT(*)::int as count FROM media WHERE folder_id = ${id}`
    if ((fileCount[0] as Record<string, unknown>).count as number > 0) {
      return c.json({ error: { code: 'VALIDATION', message: 'Folder is not empty. Move or delete files first.' } }, 400)
    }

    const childCount = await sql`SELECT COUNT(*)::int as count FROM media_folders WHERE parent_id = ${id}`
    if ((childCount[0] as Record<string, unknown>).count as number > 0) {
      return c.json({ error: { code: 'VALIDATION', message: 'Folder has subfolders. Delete them first.' } }, 400)
    }

    const rows = await sql`DELETE FROM media_folders WHERE id = ${id} RETURNING id`
    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Folder not found' } }, 404)
    }
    return c.json({ ok: true })
  })

  // Move media to folder
  routes.patch('/media/:id/folder', requireAuth, async (c) => {
    const id = c.req.param('id')
    const body = await c.req.json<{ folderId: string | null }>()
    const sql = getClient()

    const rows = await sql`
      UPDATE media SET folder_id = ${body.folderId}, updated_at = now() WHERE id = ${id} RETURNING *
    `
    if (rows.length === 0) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Media not found' } }, 404)
    }
    return c.json({ data: rows[0] })
  })

  // Get media usage — which documents reference this file
  routes.get('/media/:id/usage', requireAuth, async (c) => {
    const mediaId = c.req.param('id')
    const sql = getClient()
    const documents: { id: string; title: string; collection: string }[] = []

    // Search each collection table for references to this media ID
    for (const collection of config.collections) {
      const tableName = collectionToTableName(collection.name)

      // Check direct media fields (uuid columns referencing media)
      for (const [fieldName, field] of Object.entries(collection.fields)) {
        if (field.type === 'media') {
          const colName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()
          try {
            const rows = await sql.unsafe(
              `SELECT id, title FROM "${tableName}" WHERE "${colName}" = $1`,
              [mediaId],
            )
            for (const row of rows) {
              const r = row as Record<string, unknown>
              documents.push({
                id: r.id as string,
                title: (r.title as string) || 'Untitled',
                collection: collection.name,
              })
            }
          } catch {
            // Column may not exist or query may fail — skip
          }
        }

        // Check array/blocks/jsonb fields that might contain the media ID as a string
        if (['array', 'blocks', 'richText'].includes(field.type)) {
          const colName = fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()
          try {
            const rows = await sql.unsafe(
              `SELECT id, title FROM "${tableName}" WHERE "${colName}"::text LIKE $1`,
              [`%${mediaId}%`],
            )
            for (const row of rows) {
              const r = row as Record<string, unknown>
              if (!documents.some((d) => d.id === r.id && d.collection === collection.name)) {
                documents.push({
                  id: r.id as string,
                  title: (r.title as string) || 'Untitled',
                  collection: collection.name,
                })
              }
            }
          } catch {
            // Skip
          }
        }
      }
    }

    return c.json({ data: documents })
  })

  return routes
}
