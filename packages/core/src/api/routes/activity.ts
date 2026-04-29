import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'

export const activityRoutes = new Hono<AuthEnv>()

// List activity log (paginated, filterable)
activityRoutes.get('/admin/activity', requireAuth, requirePermission('users'), async (c) => {
  const sql = getClient()
  const page = parseInt(c.req.query('page') || '1', 10)
  const limit = Math.min(parseInt(c.req.query('limit') || '50', 10), 100)
  const offset = (page - 1) * limit

  const userId = c.req.query('userId')
  const action = c.req.query('action')
  const from = c.req.query('from')
  const to = c.req.query('to')

  const conditions: string[] = []
  const params: any[] = []
  let idx = 1

  if (userId) {
    conditions.push(`al.user_id = $${idx}`)
    params.push(userId)
    idx++
  }

  if (action) {
    conditions.push(`al.action = $${idx}`)
    params.push(action)
    idx++
  }

  if (from) {
    conditions.push(`al.created_at >= $${idx}`)
    params.push(from)
    idx++
  }

  if (to) {
    conditions.push(`al.created_at <= $${idx}`)
    params.push(to)
    idx++
  }

  const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : ''

  const countResult = await sql.unsafe(
    `SELECT COUNT(*)::int as total FROM activity_log al ${whereClause}`,
    params,
  )
  const total = (countResult[0] as Record<string, unknown>).total as number

  const rows = await sql.unsafe(
    `SELECT al.*, u.name as user_name, u.email as user_email
     FROM activity_log al
     LEFT JOIN users u ON u.id = al.user_id
     ${whereClause}
     ORDER BY al.created_at DESC
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
