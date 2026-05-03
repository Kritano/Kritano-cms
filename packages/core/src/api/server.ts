import { Hono } from 'hono'
import { createYoga, createSchema } from 'graphql-yoga'
import type { CmsConfig } from '@kritano/cms/types'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/error'
import { createApiRouter } from './router'
import { buildGraphQLSchema } from './graphql/schema-builder'
import { buildResolvers } from './graphql/resolvers'
import { startScheduleWorker } from '../lib/scheduler'
import { startWebhookWorker } from '../lib/webhooks'
import { redirectMiddleware } from './middleware/redirects'
import { loadPlugins, fireReadyHook } from '../plugins/loader'
import { getPluginRegistry } from '../plugins/registry'
import { isSearchAvailable, syncSchemas } from '../search'
import { installerGuard, installerRoutes } from '../installer'

let _serverApp: Hono | null = null

export function getServerApp(): Hono | null {
  return _serverApp
}

export function createServer(config: CmsConfig): Hono {
  const app = new Hono()
  _serverApp = app

  // Global middleware
  app.use('*', corsMiddleware)
  app.use('*', redirectMiddleware)
  app.use('*', installerGuard)
  app.onError(errorHandler)

  // Installer routes (only active before first setup)
  app.route('/api', installerRoutes)

  // REST API routes
  const apiRouter = createApiRouter(config)
  app.route('/', apiRouter)

  // GraphQL endpoint
  const yoga = createYoga({
    schema: createSchema({
      typeDefs: buildGraphQLSchema(config),
      resolvers: buildResolvers(config) as any,
    }),
    graphqlEndpoint: '/api/graphql',
    landingPage: false,
  })

  app.on(['GET', 'POST'], '/api/graphql', async (c) => {
    const response = await yoga.handle(c.req.raw)
    return response
  })

  return app
}

export async function startServer(config: CmsConfig, port = 3000): Promise<void> {
  const app = createServer(config)

  // Load plugins — this registers routes, hooks, and extensions
  if (config.plugins && config.plugins.length > 0) {
    const result = await loadPlugins(config, app)
    if (!result.success) {
      console.error('[CMS] Server cannot start due to plugin conflicts.')
      process.exit(1)
    }
  }

  // Start background workers
  startScheduleWorker()
  startWebhookWorker()

  console.log(`CMS API server starting on http://localhost:${port}`)
  console.log(`  REST API: http://localhost:${port}/api`)
  console.log(`  GraphQL:  http://localhost:${port}/api/graphql`)
  console.log(`  Health:   http://localhost:${port}/api/health`)

  // Sync search schemas if Typesense is available
  if (isSearchAvailable()) {
    syncSchemas(config).then((result) => {
      if (result.synced.length > 0) {
        console.log(`[Search] Schemas synced: ${result.synced.join(', ')}`)
      }
      for (const err of result.errors) {
        console.warn(`[Search] ${err}`)
      }
    }).catch((err) => {
      console.warn(`[Search] Schema sync failed: ${err.message}`)
    })
  }

  Bun.serve({
    fetch: app.fetch,
    port,
  })

  // Fire cms.ready hook after server is listening
  await fireReadyHook()
}
