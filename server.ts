#!/usr/bin/env bun

import { resolve } from 'node:path'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createServer } from '@kritano/cms/core'

// Load config from the project root (process.cwd), not the CMS package
const configPath = resolve(process.cwd(), 'cms.config')
const { default: config } = await import(configPath)

const app = createServer(config)
const port = parseInt(process.env.PORT || '3000', 10)

// Serve admin static files in production
// In dev, admin is served by Vite with HMR on a separate port
const adminDistPath = join(import.meta.dir, 'packages/admin/dist')
const adminBuilt = existsSync(adminDistPath)

if (adminBuilt) {
  // Redirect /admin to /admin/
  app.get('/admin', (c) => c.redirect('/admin/'))

  // Serve built admin assets, with SPA fallback to index.html
  app.get('/admin/*', async (c) => {
    const reqPath = c.req.path.replace(/^\/admin/, '')
    const filePath = join(adminDistPath, reqPath)
    const file = Bun.file(filePath)

    if (await file.exists()) {
      return new Response(file)
    }

    // SPA fallback — serve index.html for any unmatched route
    return new Response(Bun.file(join(adminDistPath, 'index.html')), {
      headers: { 'Content-Type': 'text/html' },
    })
  })
}

console.log(`CMS API server running on http://localhost:${port}`)
console.log(`  Health: http://localhost:${port}/api/health`)
console.log(`  GraphQL: http://localhost:${port}/api/graphql`)
if (adminBuilt) {
  console.log(`  Admin: http://localhost:${port}/admin`)
}

Bun.serve({
  fetch: app.fetch,
  port,
})
