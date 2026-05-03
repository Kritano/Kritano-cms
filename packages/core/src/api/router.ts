import { Hono } from 'hono'
import type { CmsConfig } from '@kritano/cms/types'
import { healthRoutes } from './routes/health'
import { robotsRoutes } from './routes/robots'
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

function buildFieldNotes(field: Record<string, unknown>): string {
  const notes: string[] = []
  if (field.min !== undefined) notes.push(`min: ${field.min}`)
  if (field.max !== undefined) notes.push(`max: ${field.max}`)
  if (field.maxLength !== undefined) notes.push(`max ${field.maxLength} chars`)
  if (field.integer) notes.push('integer')
  if (Array.isArray(field.options)) notes.push(`options: ${(field.options as string[]).join(', ')}`)
  if (field.default !== undefined) notes.push(`default: ${field.default}`)
  if (field.from) notes.push(`from: ${field.from}`)
  if (field.target) notes.push(`→ ${field.target}`)
  return notes.join('. ')
}

export function createApiRouter(config: CmsConfig): Hono {
  const api = new Hono()

  // System routes
  api.route('/', robotsRoutes)
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

  // Block types endpoint — aggregates all block definitions across collections
  api.get('/api/admin/blocks', (c) => {
    const blocks: Record<string, {
      name: string
      description: string | null
      fields: Array<{ name: string; type: string; required: boolean; nullable: boolean; notes: string }>
      usedIn: Array<{ collection: string; fieldName: string }>
    }> = {}

    for (const col of config.collections) {
      for (const [fieldName, field] of Object.entries(col.fields)) {
        if (field.type === 'blocks' && Array.isArray(field.blocks)) {
          for (const blockDef of field.blocks) {
            if (!blocks[blockDef.name]) {
              blocks[blockDef.name] = {
                name: blockDef.name,
                description: (blockDef as any).description ?? null,
                fields: Object.entries(blockDef.fields).map(([fname, fdef]: [string, any]) => ({
                  name: fname,
                  type: fdef.type,
                  required: !!fdef.required,
                  nullable: !!fdef.nullable,
                  notes: buildFieldNotes(fdef),
                })),
                usedIn: [],
              }
            }
            blocks[blockDef.name].usedIn.push({ collection: col.name, fieldName })
          }
        }
      }
    }

    const collectionsWithBlocks = new Set(
      Object.values(blocks).flatMap((b) => b.usedIn.map((u) => u.collection)),
    ).size

    return c.json({
      blocks,
      stats: {
        totalBlocks: Object.keys(blocks).length,
        collectionsWithBlocks,
      },
    })
  })

  // Auto-generated collection routes
  for (const collection of config.collections) {
    api.route('/api', createCollectionRoutes(collection))
  }

  return api
}
