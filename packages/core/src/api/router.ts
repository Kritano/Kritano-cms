import { Hono } from 'hono'
import type { CmsConfig } from '@kritano/cms/types'
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
import { webhookRoutes } from './routes/webhooks'
import { redirectRoutes } from './routes/redirects'
import { apiKeyRoutes } from './routes/api-keys'
import { formRoutes } from './routes/forms'
import { createMediaFolderRoutes } from './routes/media-folders'
import { backupRoutes } from './routes/backups'
import { pluginRoutes } from './routes/plugins'
import { searchRoutes } from './routes/search'
import { oauthRoutes } from './routes/oauth'
import { previewRoutes } from './routes/preview'
import { updateRoutes } from './routes/updates'

export function createApiRouter(config: CmsConfig): Hono {
  const api = new Hono()

  // System routes
  api.route('/api', healthRoutes)
  api.route('/api', authRoutes)
  api.route('/api', oauthRoutes)
  api.route('/api', mediaRoutes)
  api.route('/api', createSitemapRoutes(config))
  api.route('/api', kritanoRoutes)

  // Phase 0.2 — Users, roles, invitations, activity
  api.route('/api', roleRoutes)
  api.route('/api', userRoutes)
  api.route('/api', invitationRoutes)
  api.route('/api', activityRoutes)
  api.route('/api', webhookRoutes)
  api.route('/api', redirectRoutes)
  api.route('/api', apiKeyRoutes)
  api.route('/api', formRoutes)
  api.route('/api', createMediaFolderRoutes(config))
  api.route('/api', backupRoutes)
  api.route('/api', pluginRoutes)
  api.route('/api', searchRoutes)
  api.route('/api', previewRoutes)
  api.route('/api', updateRoutes)

  // Config/schema endpoint — admin fetches this to know what collections exist
  api.get('/api/admin/schema', (c) => {
    return c.json({
      site: config.site,
      collections: config.collections.map((col) => ({
        name: col.name,
        fields: col.fields,
      })),
    })
  })

  // Auto-generated collection routes
  for (const collection of config.collections) {
    api.route('/api', createCollectionRoutes(collection))
  }

  return api
}
