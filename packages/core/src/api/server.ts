import { Hono } from 'hono'
import { createYoga, createSchema } from 'graphql-yoga'
import type { CmsConfig } from '@cms/types'
import { corsMiddleware } from './middleware/cors'
import { errorHandler } from './middleware/error'
import { createApiRouter } from './router'
import { buildGraphQLSchema } from './graphql/schema-builder'
import { buildResolvers } from './graphql/resolvers'
import { startScheduleWorker } from '../lib/scheduler'

export function createServer(config: CmsConfig): Hono {
  const app = new Hono()

  // Global middleware
  app.use('*', corsMiddleware)
  app.onError(errorHandler)

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

export function startServer(config: CmsConfig, port = 3000): void {
  const app = createServer(config)

  // Start background workers
  startScheduleWorker()

  console.log(`CMS API server starting on http://localhost:${port}`)
  console.log(`  REST API: http://localhost:${port}/api`)
  console.log(`  GraphQL:  http://localhost:${port}/api/graphql`)
  console.log(`  Health:   http://localhost:${port}/api/health`)

  Bun.serve({
    fetch: app.fetch,
    port,
  })
}
