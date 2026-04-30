import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'

export const redirectRoutes = new Hono<AuthEnv>()

// List redirects (paginated, searchable)
redirectRoutes.get('/admin/redirects', requireAuth, requirePermission('redirects'), async (c) => {
  const sql = getClient()
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100)
  const offset = (page - 1) * limit
  const search = c.req.query('search')

  const conditions: string[] = []
  const params: any[] = []

  if (search) {
    conditions.push(`(from_path ILIKE $${params.length + 1} OR to_path ILIKE $${params.length + 1})`)
    params.push(`%${search}%`)
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await sql.unsafe(
    `SELECT COUNT(*)::int as total FROM redirects ${whereClause}`,
    params,
  )
  const total = (countResult[0] as Record<string, unknown>).total as number

  const rows = await sql.unsafe(
    `SELECT * FROM redirects ${whereClause} ORDER BY created_at DESC LIMIT ${limit} OFFSET ${offset}`,
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

// Create redirect
redirectRoutes.post('/admin/redirects', requireAuth, requirePermission('redirects'), async (c) => {
  const body = await c.req.json<{ fromPath: string; toPath: string; type?: number }>()

  if (!body.fromPath || !body.toPath) {
    return c.json({ error: { code: 'VALIDATION', message: 'fromPath and toPath are required' } }, 400)
  }

  const redirectType = body.type === 302 ? 302 : 301

  const sql = getClient()

  // Check for duplicate from_path
  const existing = await sql`SELECT id FROM redirects WHERE from_path = ${body.fromPath} LIMIT 1`
  if (existing.length > 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'A redirect from this path already exists' } }, 400)
  }

  const rows = await sql`
    INSERT INTO redirects (from_path, to_path, type)
    VALUES (${body.fromPath}, ${body.toPath}, ${redirectType})
    RETURNING *
  `

  return c.json({ data: rows[0] }, 201)
})

// Update redirect
redirectRoutes.put('/admin/redirects/:id', requireAuth, requirePermission('redirects'), async (c) => {
  const id = c.req.param('id')
  const body = await c.req.json<{ fromPath?: string; toPath?: string; type?: number }>()

  const sql = getClient()
  const setClauses: string[] = []
  const values: any[] = []
  let idx = 1

  if (body.fromPath !== undefined) {
    setClauses.push(`"from_path" = $${idx}`)
    values.push(body.fromPath)
    idx++
  }
  if (body.toPath !== undefined) {
    setClauses.push(`"to_path" = $${idx}`)
    values.push(body.toPath)
    idx++
  }
  if (body.type !== undefined) {
    setClauses.push(`"type" = $${idx}`)
    values.push(body.type === 302 ? 302 : 301)
    idx++
  }

  if (setClauses.length === 0) {
    return c.json({ error: { code: 'VALIDATION', message: 'No fields to update' } }, 400)
  }

  values.push(id)
  const rows = await sql.unsafe(
    `UPDATE redirects SET ${setClauses.join(', ')}, updated_at = now() WHERE id = $${idx} RETURNING *`,
    values,
  )

  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Redirect not found' } }, 404)
  }

  return c.json({ data: rows[0] })
})

// Delete redirect
redirectRoutes.delete('/admin/redirects/:id', requireAuth, requirePermission('redirects'), async (c) => {
  const id = c.req.param('id')
  const sql = getClient()

  const rows = await sql`DELETE FROM redirects WHERE id = ${id} RETURNING id`
  if (rows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Redirect not found' } }, 404)
  }

  return c.json({ ok: true })
})

// Bulk import from CSV
redirectRoutes.post('/admin/redirects/import', requireAuth, requirePermission('redirects'), async (c) => {
  const body = await c.req.json<{ csv: string }>()

  if (!body.csv) {
    return c.json({ error: { code: 'VALIDATION', message: 'csv field is required' } }, 400)
  }

  const lines = body.csv.trim().split('\n')
  const sql = getClient()
  let imported = 0
  let skipped = 0
  const errors: string[] = []

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim()
    if (!line || (i === 0 && line.toLowerCase().startsWith('from_path'))) continue // skip header

    const parts = line.split(',').map((p) => p.trim())
    if (parts.length < 2) {
      errors.push(`Line ${i + 1}: insufficient columns`)
      continue
    }

    const [fromPath, toPath, typeStr] = parts
    const type = typeStr === '302' ? 302 : 301

    try {
      await sql`
        INSERT INTO redirects (from_path, to_path, type)
        VALUES (${fromPath}, ${toPath}, ${type})
        ON CONFLICT (from_path) DO NOTHING
      `
      imported++
    } catch {
      skipped++
    }
  }

  return c.json({ data: { imported, skipped, errors } })
})

// Export as CSV
redirectRoutes.get('/admin/redirects/export', requireAuth, requirePermission('redirects'), async (c) => {
  const sql = getClient()
  const rows = await sql`SELECT from_path, to_path, type FROM redirects ORDER BY created_at DESC`

  let csv = 'from_path,to_path,type\n'
  for (const row of rows) {
    const r = row as Record<string, unknown>
    csv += `${r.from_path},${r.to_path},${r.type}\n`
  }

  return c.text(csv, 200, {
    'Content-Type': 'text/csv',
    'Content-Disposition': 'attachment; filename="redirects.csv"',
  })
})

// Check for redirect chains
redirectRoutes.post('/admin/redirects/check-chains', requireAuth, requirePermission('redirects'), async (c) => {
  const sql = getClient()
  const allRedirects = await sql`SELECT id, from_path, to_path, type FROM redirects`

  // Build a lookup from from_path → redirect
  const fromMap = new Map<string, Record<string, unknown>>()
  for (const r of allRedirects) {
    const redirect = r as Record<string, unknown>
    fromMap.set(redirect.from_path as string, redirect)
  }

  // Find chains: where a to_path is also a from_path
  const chains: { chain: Record<string, unknown>[]; suggestion: { fromId: string; newToPath: string } }[] = []

  for (const r of allRedirects) {
    const redirect = r as Record<string, unknown>
    const toPath = redirect.to_path as string

    if (fromMap.has(toPath)) {
      // Walk the chain
      const chain: Record<string, unknown>[] = [redirect]
      let current = toPath
      const visited = new Set<string>([redirect.from_path as string])

      while (fromMap.has(current) && !visited.has(current)) {
        visited.add(current)
        const next = fromMap.get(current)!
        chain.push(next)
        current = next.to_path as string
      }

      // Only report if chain length > 1 (i.e., A→B→C)
      if (chain.length > 1) {
        const finalDestination = chain[chain.length - 1].to_path as string
        chains.push({
          chain: chain.map((c) => ({ id: c.id, fromPath: c.from_path, toPath: c.to_path })),
          suggestion: {
            fromId: redirect.id as string,
            newToPath: finalDestination,
          },
        })
      }
    }
  }

  return c.json({ data: chains })
})
