import { Hono } from 'hono'
import type { CmsConfig } from '@cms/types'
import { healthRoutes } from './routes/health'
import { authRoutes } from './routes/auth'
import { createCollectionRoutes } from './routes/collection'
import { mediaRoutes } from './routes/media'
import { createSitemapRoutes } from './routes/sitemap'
import { kritanoRoutes } from './routes/kritano'
import { roleRoutes } from './routes/roles'
import { userRoutes } from './routes/users'
import { invitationRoutes } from './routes/invitations'
import { activityRoutes } from './routes/activity'

export function createApiRouter(config: CmsConfig): Hono {
  const api = new Hono()

  // System routes
  api.route('/api', healthRoutes)
  api.route('/api', authRoutes)
  api.route('/api', mediaRoutes)
  api.route('/api', createSitemapRoutes(config))
  api.route('/api', kritanoRoutes)

  // Phase 0.2 — Users, roles, invitations, activity
  api.route('/api', roleRoutes)
  api.route('/api', userRoutes)
  api.route('/api', invitationRoutes)
  api.route('/api', activityRoutes)

  // Auto-generated collection routes
  for (const collection of config.collections) {
    api.route('/api', createCollectionRoutes(collection))
  }

  return api
}
