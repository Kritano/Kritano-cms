import { existsSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { log } from '../utils/logger'
import { loadConfig, getProjectRoot, getCmsRoot } from '../utils/config'
import { runMigrations } from '@kritano/cms/core'

export async function start() {
  log.header('CMS Production Server')

  // 1. Validate config
  log.step('Validating cms.config.ts…')
  try {
    await loadConfig()
    log.success('Config valid')
  } catch (err: any) {
    log.error(`Config error: ${err.message}`)
    process.exit(1)
  }

  // 2. Run pending migrations
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

  const publicPort = process.env.PORT || '3005'
  const apiPort = '3010'
  const astroPort = '3011'
  const projectRoot = getProjectRoot()
  const cmsRoot = getCmsRoot()
  const adminDistPath = resolve(cmsRoot, 'packages/admin/dist')

  // 3. Start API server (no --watch in production)
  log.step('Starting API server…')
  const apiProc = Bun.spawn(['bun', 'run', resolve(cmsRoot, 'server.ts')], {
    cwd: projectRoot,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, PORT: apiPort },
  })

  // 4. Start Astro in production mode
  const hasCustomTheme = existsSync(resolve(projectRoot, 'astro.config.mjs')) ||
                         existsSync(resolve(projectRoot, 'astro.config.ts')) ||
                         existsSync(resolve(projectRoot, 'src/pages'))
  const themeDir = hasCustomTheme ? projectRoot : resolve(cmsRoot, 'themes/default')

  const astroDistPath = resolve(themeDir, 'dist')
  if (!existsSync(astroDistPath)) {
    log.error('Astro not built. Run "bun run build" first.')
    apiProc.kill()
    process.exit(1)
  }

  log.step('Starting frontend…')
  const frontendProc = Bun.spawn(['bunx', 'astro', 'preview', '--port', astroPort, '--host', '127.0.0.1'], {
    cwd: themeDir,
    stdio: ['inherit', 'inherit', 'inherit'],
    env: { ...process.env, CMS_API_URL: `http://localhost:${apiPort}/api`, HOST: '127.0.0.1' },
  })

  // 5. Start reverse proxy — single port serving everything
  const proxy = Bun.serve({
    port: parseInt(publicPort),
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

        return new Response(Bun.file(join(adminDistPath, 'index.html')), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Install route
      if (url.pathname === '/install' || url.pathname.startsWith('/install/')) {
        return new Response(Bun.file(join(adminDistPath, 'index.html')), {
          headers: { 'Content-Type': 'text/html' },
        })
      }

      // Everything else → Astro frontend
      try {
        return await fetch(`http://localhost:${astroPort}${url.pathname}${url.search}`, {
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

  log.success(`Production server running on port ${publicPort}`)
  log.url('Site', `http://localhost:${publicPort}`)
  log.url('Admin', `http://localhost:${publicPort}/admin`)
  log.url('API', `http://localhost:${publicPort}/api/health`)
  console.log('')

  const cleanup = () => {
    apiProc.kill()
    frontendProc.kill()
    proxy.stop()
    process.exit(0)
  }
  process.on('SIGINT', cleanup)
  process.on('SIGTERM', cleanup)

  await apiProc.exited
}

if (import.meta.main) {
  await start()
}
