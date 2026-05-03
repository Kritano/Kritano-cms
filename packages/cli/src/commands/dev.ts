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

async function ensureDefaultRoles() {
  const sql = getClient()
  try {
    const defaultRoles = [
      { name: 'super_admin', permissions: { '*': true } },
      { name: 'admin', permissions: { content: true, media: true, users: true, settings: true, forms: true, redirects: true, webhooks: true, deployment: true } },
      { name: 'editor', permissions: { content: { read: true, create: true, update: true, publish: true }, media: { read: true, upload: true }, forms: true } },
      { name: 'author', permissions: { content: { read: true, create: true, update_own: true }, media: { read: true, upload: true } } },
      { name: 'contributor', permissions: { content: { read: true, create: true }, media: { read: true } } },
      { name: 'viewer', permissions: { content: { read: true }, media: { read: true } } },
    ]

    for (const role of defaultRoles) {
      await sql`
        INSERT INTO roles (name, permissions)
        VALUES (${role.name}, ${JSON.stringify(role.permissions)}::jsonb)
        ON CONFLICT (name) DO NOTHING
      `
    }
  } catch {
    // roles table may not exist yet
  }
}

async function ensureAdminUser() {
  const sql = getClient()
  try {
    // Check if ANY user exists — if so, don't create another admin
    const anyUser = await sql`SELECT id FROM users LIMIT 1`
    if (anyUser.length > 0) {
      // Still ensure they have a role
      await ensureAdminHasRole(sql)
      return
    }

    const hash = await bcrypt.hash('admin', 10)
    const userRows = await sql`INSERT INTO users (email, password_hash, name) VALUES ('cms-admin@kritano.com', ${hash}, 'Admin') RETURNING id`
    const userId = (userRows[0] as Record<string, unknown>).id as string

    // Assign super_admin role
    const roleRows = await sql`SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`
    if (roleRows.length > 0) {
      const roleId = (roleRows[0] as Record<string, unknown>).id as string
      await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${userId}, ${roleId}) ON CONFLICT DO NOTHING`
    }

    log.success('Admin user created → cms-admin@kritano.com / admin')
  } catch {
    // Table may not exist yet on very first run — that's ok, migration will create it
  }
}

async function ensureAdminHasRole(sql: ReturnType<typeof getClient>) {
  try {
    // Find users with no roles and assign super_admin
    const usersWithoutRoles = await sql`
      SELECT u.id FROM users u
      LEFT JOIN user_roles ur ON ur.user_id = u.id
      WHERE ur.role_id IS NULL
    `
    if (usersWithoutRoles.length === 0) return

    const roleRows = await sql`SELECT id FROM roles WHERE name = 'super_admin' LIMIT 1`
    if (roleRows.length === 0) return

    const roleId = (roleRows[0] as Record<string, unknown>).id as string
    for (const user of usersWithoutRoles) {
      const userId = (user as Record<string, unknown>).id as string
      await sql`INSERT INTO user_roles (user_id, role_id) VALUES (${userId}, ${roleId}) ON CONFLICT DO NOTHING`
    }
  } catch {}
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

  // 5. Seed default roles
  await ensureDefaultRoles()

  // 6. Seed admin user if needed
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

  // Ensure admin is built and up to date
  const adminDir = resolve(cmsRoot, 'packages/admin')
  const adminIndexPath = resolve(adminDistPath, 'index.html')
  let needsBuild = !existsSync(adminIndexPath)

  // Check if source is newer than dist (CMS was updated)
  if (!needsBuild) {
    try {
      const { statSync } = await import('node:fs')
      const distTime = statSync(adminIndexPath).mtimeMs
      const routerTime = statSync(resolve(adminDir, 'src/router.tsx')).mtimeMs
      if (routerTime > distTime) needsBuild = true
    } catch {}
  }

  if (needsBuild) {
    log.step('Building admin UI…')
    try {
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
  log.info('Login: cms-admin@kritano.com / admin')
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
