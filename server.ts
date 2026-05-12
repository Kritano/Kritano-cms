#!/usr/bin/env bun

import { resolve } from 'node:path'
import { join } from 'node:path'
import { existsSync } from 'node:fs'
import { createServer, loadPlugins, fireReadyHook, syncDeclaredForms } from '@kritano/cms/core'

// Load config from the project root (process.cwd), not the CMS package
const configPath = resolve(process.cwd(), 'cms.config')
const { default: config } = await import(configPath)

const app = createServer(config)
const port = parseInt(process.env.PORT || '3000', 10)

// Load plugins if configured
if (config.plugins && config.plugins.length > 0) {
  const result = await loadPlugins(config, app)
  if (!result.success) {
    console.error('[CMS] Server cannot start due to plugin conflicts.')
    process.exit(1)
  }
}

// Sync forms declared in cms.config.ts to the database
syncDeclaredForms().catch((err) => console.warn(`[CMS] Form sync: ${err}`))

// Serve admin static files in production
// In dev, admin is served by Vite with HMR on a separate port
const adminDistPath = join(import.meta.dir, 'packages/admin/dist')
const adminSentinelPath = join(adminDistPath, '.build-complete')
const adminBuilt = existsSync(adminSentinelPath)
const adminPartial = !adminBuilt && existsSync(adminDistPath)

if (adminPartial) {
  console.warn(
    '[CMS] packages/admin/dist exists but .build-complete is missing — admin build is partial or corrupted (likely OOM killed during build). Run `bun run build:assets` on a machine with enough RAM (~2 GB free) and redeploy, or rebuild locally and rsync the dist up. Serving an explanatory page at /admin instead of a broken bundle.',
  )
  app.get('/admin', (c) => c.redirect('/admin/'))
  app.get('/admin/*', (c) =>
    c.html(
      '<!doctype html><meta charset="utf-8"><title>Admin unavailable</title>' +
        '<style>body{font-family:system-ui,sans-serif;max-width:42rem;margin:4rem auto;padding:0 1.5rem;color:#222;line-height:1.5}code{background:#f3f3f3;padding:.1rem .35rem;border-radius:.25rem}</style>' +
        '<h1>Admin build incomplete</h1>' +
        '<p>The admin UI bundle in <code>packages/admin/dist</code> is missing its build sentinel, which means the last build did not finish (commonly an out-of-memory kill on small VPS instances).</p>' +
        '<p>To recover, rebuild on a machine with at least ~2 GB of free RAM and redeploy:</p>' +
        '<pre><code>bun run build:assets</code></pre>' +
        '<p>Or build locally and <code>rsync</code> <code>packages/admin/dist/</code> up to the server.</p>',
      503,
    ),
  )
}

if (adminBuilt) {
  // Redirect /admin to /admin/
  app.get('/admin', (c) => c.redirect('/admin/'))

  // MIME type map for static assets
  const mimeTypes: Record<string, string> = {
    '.js': 'application/javascript',
    '.css': 'text/css',
    '.html': 'text/html',
    '.json': 'application/json',
    '.svg': 'image/svg+xml',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
  }

  // Serve built admin assets, with SPA fallback to index.html
  app.get('/admin/*', async (c) => {
    const reqPath = c.req.path.replace(/^\/admin/, '')
    const filePath = join(adminDistPath, reqPath)
    const file = Bun.file(filePath)

    if (await file.exists()) {
      const ext = filePath.substring(filePath.lastIndexOf('.'))
      const contentType = mimeTypes[ext]
      return new Response(file, contentType ? {
        headers: { 'Content-Type': contentType },
      } : undefined)
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
