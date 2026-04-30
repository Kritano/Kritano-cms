import { $ } from 'bun'
import { existsSync } from 'node:fs'
import { resolve } from 'node:path'
import { log } from '../utils/logger'
import { loadConfig, getProjectRoot } from '../utils/config'
import { ensureDockerRunning } from '../utils/docker'
import { createMigration, runMigrations, getClient } from '@cms/core'
import bcrypt from 'bcryptjs'

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
    await $`bun run packages/cli/src/commands/generate.ts`.quiet()
    log.success('Types generated')
  } catch {
    log.warn('Type generation skipped')
  }

  const apiPort = process.env.PORT || '3005'
  const adminPort = process.env.ADMIN_PORT || '3006'
  const frontendPort = '4321'

  log.header('Starting servers')
  log.url('API', `http://localhost:${apiPort}`)
  log.url('Admin', `http://localhost:${adminPort}/admin`)
  log.url('Frontend', `http://localhost:${frontendPort}`)
  log.url('GraphQL', `http://localhost:${apiPort}/api/graphql`)
  log.url('Health', `http://localhost:${apiPort}/api/health`)
  console.log('')
  log.info('Login: admin@cms.local / admin')
  console.log('')

  // 7. Start API server with --watch
  const apiProc = Bun.spawn(['bun', '--watch', 'run', 'server.ts'], {
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, PORT: apiPort },
  })

  // 8. Start admin UI dev server (Vite, proxies /api to API port)
  const adminProc = Bun.spawn(['bun', 'run', '--cwd', 'packages/admin', 'dev', '--', '--port', adminPort], {
    stdio: ['inherit', 'inherit', 'inherit'],
  })

  // 9. Start Astro frontend dev server
  const frontendProc = Bun.spawn(['bunx', 'astro', 'dev', '--port', frontendPort], {
    cwd: resolve(getProjectRoot(), 'themes/default'),
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, CMS_API_URL: `http://localhost:${apiPort}/api` },
  })

  // Handle shutdown
  const cleanup = () => {
    apiProc.kill()
    adminProc.kill()
    frontendProc.kill()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  // Keep alive
  await apiProc.exited
}
