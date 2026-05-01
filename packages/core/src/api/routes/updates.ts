import { Hono } from 'hono'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import {
  checkForUpdates,
  getCachedUpdateCheck,
  dismissUpdate,
  isUpdateDismissed,
} from '../../lib/update-checker'

export const updateRoutes = new Hono<AuthEnv>()

// GET /api/admin/updates/check — get update status (from cache, or live check)
updateRoutes.get('/admin/updates/check', requireAuth, async (c) => {
  const user = c.get('user')

  // Try cached result first
  let result = await getCachedUpdateCheck()

  // If no cache, do a live check
  if (!result) {
    result = await checkForUpdates()
  }

  // Check if user has dismissed
  const dismissed = await isUpdateDismissed(user.sub)

  return c.json({ ...result, dismissed })
})

// POST /api/admin/updates/refresh — force a fresh check
updateRoutes.post('/admin/updates/refresh', requireAuth, async (c) => {
  const result = await checkForUpdates()
  return c.json(result)
})

// POST /api/admin/updates/dismiss — dismiss for 7 days
updateRoutes.post('/admin/updates/dismiss', requireAuth, async (c) => {
  const user = c.get('user')
  await dismissUpdate(user.sub)
  return c.json({ ok: true })
})
