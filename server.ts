#!/usr/bin/env bun

import config from './cms.config'
import { createServer } from '@cms/core'
import { join } from 'node:path'

const app = createServer(config)
const port = parseInt(process.env.PORT || '3000', 10)

// Serve admin static files in production
// In dev, admin is served by Vite on port 3001

console.log(`CMS API server running on http://localhost:${port}`)
console.log(`  Health: http://localhost:${port}/api/health`)
console.log(`  GraphQL: http://localhost:${port}/api/graphql`)

Bun.serve({
  fetch: app.fetch,
  port,
})
