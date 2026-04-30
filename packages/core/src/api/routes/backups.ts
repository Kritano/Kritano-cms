import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { readdir, stat } from 'node:fs/promises'
import { join } from 'node:path'
import { $ } from 'bun'

const BACKUP_DIR = process.env.BACKUP_DIR || '/var/backups/cms'

export const backupRoutes = new Hono<AuthEnv>()

// List backups
backupRoutes.get('/admin/backups', requireAuth, requirePermission('deployment'), async (c) => {
  try {
    const files = await readdir(BACKUP_DIR)
    const backups = []

    for (const file of files.filter((f) => f.endsWith('.sql.gz') || f.endsWith('.dump'))) {
      try {
        const info = await stat(join(BACKUP_DIR, file))
        backups.push({
          filename: file,
          size: info.size,
          createdAt: info.mtime.toISOString(),
        })
      } catch {
        // Skip files we can't stat
      }
    }

    backups.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return c.json({ data: backups })
  } catch {
    // Backup directory doesn't exist (likely dev environment)
    return c.json({ data: [] })
  }
})

// Trigger manual backup
backupRoutes.post('/admin/backups', requireAuth, requirePermission('deployment'), async (c) => {
  const dbUrl = process.env.DATABASE_URL
  if (!dbUrl) {
    return c.json({ error: { code: 'INTERNAL_ERROR', message: 'DATABASE_URL not configured' } }, 500)
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = `cms-${timestamp}.sql.gz`
  const filepath = join(BACKUP_DIR, filename)

  try {
    // Ensure backup directory exists
    await $`mkdir -p ${BACKUP_DIR}`.quiet()

    // Run pg_dump and gzip
    await $`pg_dump ${dbUrl} | gzip > ${filepath}`.quiet()

    const info = await stat(filepath)

    return c.json({
      data: {
        filename,
        size: info.size,
        createdAt: info.mtime.toISOString(),
      },
    }, 201)
  } catch (err) {
    return c.json({
      error: {
        code: 'BACKUP_FAILED',
        message: err instanceof Error ? err.message : 'Backup failed',
      },
    }, 500)
  }
})

// Download backup file
backupRoutes.get('/admin/backups/:filename', requireAuth, requirePermission('deployment'), async (c) => {
  const filename = c.req.param('filename')

  // Sanitise filename to prevent path traversal
  if (filename.includes('/') || filename.includes('..')) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid filename' } }, 400)
  }

  const filepath = join(BACKUP_DIR, filename)

  try {
    const file = Bun.file(filepath)
    if (!await file.exists()) {
      return c.json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }, 404)
    }

    return new Response(file.stream(), {
      headers: {
        'Content-Type': 'application/gzip',
        'Content-Disposition': `attachment; filename="${filename}"`,
      },
    })
  } catch {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Backup not found' } }, 404)
  }
})
