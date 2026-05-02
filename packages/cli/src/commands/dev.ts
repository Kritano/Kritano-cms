import { $ } from 'bun'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { log } from '../utils/logger'
import { loadConfig, getProjectRoot, getCmsRoot } from '../utils/config'
import { ensureDockerRunning } from '../utils/docker'
import { createMigration, runMigrations, getClient } from '@kritano/cms/core'
import bcrypt from 'bcryptjs'
import { generate } from './generate'

async function ensureInitialMigration() {
  const root = getProjectRoot()
  const migrationsDir = resolve(root, 'migrations')
  const hasExisting = existsSync(migrationsDir) &&
    (await import('node:fs/promises')).readdir(migrationsDir)
      .then((f) => f.filter((n) => n.endsWith('.sql')).length > 0)
      .catch(() => false)

  if (await hasExisting) return

  log.step('No migrations found — creating initial migration from schema…')
  const config = await loadConfig()
  const result = await createMigration(config, root)
  if (result) {
    log.success(`Initial migration created: ${result.filename}`)
  }
}

async function ensureAdminUser() {
  const sql = getClient()
  try {
    const existing = await sql`SELECT id FROM users WHERE email = 'admin@cms.local' LIMIT 1`
    if (existing.length > 0) return

    const hash = await bcrypt.hash('admin', 10)
    await sql`INSERT INTO users (email, password_hash, name) VALUES ('admin@cms.local', ${hash}, 'Admin')`
    log.success('Admin user created → admin@cms.local / admin')
  } catch {
    // Table may not exist yet on very first run — that's ok, migration will create it
  }
}

export async function dev() {
  log.header('CMS Dev Server')

  // 1. Validate config
  log.step('Validating cms.config.ts…')
  try {
    await loadConfig()
    log.success('Config valid')
  } catch (err: any) {
    log.error(`Config error: ${err.message}`)
    process.exit(1)
  }

  // 2. Start Docker Compose
  await ensureDockerRunning()

  // 3. Create initial migration if needed
  await ensureInitialMigration()

  // 4. Run pending migrations
  log.step('Running migrations…')
  try {
    const applied = await runMigrations(getProjectRoot())
    if (applied.length > 0) {
      log.success(`${applied.length} migration(s) applied`)
    } else {
      log.success('Migrations up to date')
    }
  } catch (err: any) {
    log.warn(`Migration failed: ${err.message}`)
  }

  // 5. Seed admin user if needed
  await ensureAdminUser()

  // 6. Generate types
  log.step('Generating types…')
  try {
    await generate()
  } catch {
    log.warn('Type generation skipped')
  }

  const apiPort = process.env.PORT || '3005'
  const proxyPort = process.env.DEV_PORT || '3006'
  const astroInternalPort = '4321'
  const projectRoot = getProjectRoot()
  const cmsRoot = getCmsRoot()
  const adminDistPath = resolve(cmsRoot, 'packages/admin/dist')

  // Ensure admin is built
  if (!existsSync(resolve(adminDistPath, 'index.html'))) {
    log.step('Building admin UI (first run)…')
    try {
      const adminDir = resolve(cmsRoot, 'packages/admin')
      await $`bun run --cwd ${adminDir} build`.quiet()
      log.success('Admin built')
    } catch (err: any) {
      log.warn(`Admin build failed: ${err.message}. Admin UI may not be available.`)
    }
  }

  log.header('Starting servers')
  log.url('API', `http://localhost:${apiPort}`)
  log.url('Admin', `http://localhost:${proxyPort}/admin`)
  log.url('Frontend', `http://localhost:${proxyPort}`)
  log.url('GraphQL', `http://localhost:${apiPort}/api/graphql`)
  log.url('Health', `http://localhost:${apiPort}/api/health`)
  console.log('')
  log.info('Login: admin@cms.local / admin')
  console.log('')

  // 7. Start API server with --watch (server.ts is in the CMS package)
  const apiProc = Bun.spawn(['bun', '--watch', 'run', resolve(cmsRoot, 'server.ts')], {
    cwd: projectRoot,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, PORT: apiPort },
  })

  // 8. Start Astro frontend dev server — use project root if it has its own Astro setup, otherwise default theme
  const hasCustomTheme = existsSync(resolve(projectRoot, 'astro.config.mjs')) ||
                         existsSync(resolve(projectRoot, 'astro.config.ts')) ||
                         existsSync(resolve(projectRoot, 'src/pages'))
  const themeDir = hasCustomTheme ? projectRoot : resolve(cmsRoot, 'themes/default')
  const frontendProc = Bun.spawn(['bunx', 'astro', 'dev', '--port', astroInternalPort], {
    cwd: themeDir,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, CMS_API_URL: `http://localhost:${apiPort}/api`, ASTRO_INTERNAL_PORT: astroInternalPort },
  })

  // 9. Start reverse proxy — serves pre-built admin + proxies API and frontend
  const { join } = await import('node:path')

  const proxy = Bun.serve({
    port: parseInt(proxyPort),
    async fetch(req) {
      const url = new URL(req.url)

      // API routes → API server
      if (url.pathname.startsWith('/api')) {
        try {
          return await fetch(`http://localhost:${apiPort}${url.pathname}${url.search}`, {
            method: req.method,
            headers: req.headers,
            body: req.body,
            // @ts-ignore
            duplex: 'half',
          })
        } catch {
          return new Response('API not ready', { status: 502 })
        }
      }

      // Admin routes → serve pre-built static files
      if (url.pathname === '/admin') {
        return Response.redirect(`${url.origin}/admin/`, 301)
      }
      if (url.pathname.startsWith('/admin/')) {
        const reqPath = url.pathname.replace(/^\/admin/, '')
        const filePath = join(adminDistPath, reqPath)
        const file = Bun.file(filePath)

        if (await file.exists()) {
          return new Response(file)
        }

        // SPA fallback
        return new Response(Bun.file(join(adminDistPath, 'index.html')), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Install route → also serve admin SPA (installer is a route within the SPA)
      if (url.pathname === '/install' || url.pathname.startsWith('/install/')) {
        return new Response(Bun.file(join(adminDistPath, 'index.html')), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Everything else → Astro frontend
      try {
        return await fetch(`http://localhost:${astroInternalPort}${url.pathname}${url.search}`, {
          method: req.method,
          headers: req.headers,
          body: req.body,
          // @ts-ignore
          duplex: 'half',
        })
      } catch {
        return new Response('Frontend not ready', { status: 502 })
      }
    },
  })

  log.success(`Dev proxy running on http://localhost:${proxyPort}`)

  // Handle shutdown
  const cleanup = () => {
    apiProc.kill()
    frontendProc.kill()
    proxy.stop()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Keep alive
  await apiProc.exited
}
