import { Hono } from 'hono'
import { authMiddleware } from '../middleware/auth'

export const rebuildRoutes = new Hono()

let building = false
let lastBuild: { status: string; at: string; duration?: number } | null = null

// POST /api/admin/rebuild — trigger a site rebuild (Astro static build)
rebuildRoutes.post('/admin/rebuild', authMiddleware, async (c) => {
  if (building) {
    return c.json({ status: 'already_building', lastBuild }, 409)
  }

  building = true
  const startedAt = Date.now()
  console.log(`[Rebuild] Started at ${new Date().toISOString()}`)

  try {
    const proc = Bun.spawn(['bun', 'run', 'astro', 'build'], {
      cwd: process.cwd(),
      stdout: 'pipe',
      stderr: 'pipe',
    })

    const exitCode = await proc.exited
    const stderr = await new Response(proc.stderr).text()
    const duration = Date.now() - startedAt

    if (exitCode === 0) {
      lastBuild = { status: 'ok', at: new Date().toISOString(), duration }
      console.log(`[Rebuild] Success in ${duration}ms`)
      return c.json({ status: 'ok', message: 'Site rebuilt successfully', duration })
    } else {
      lastBuild = { status: 'error', at: new Date().toISOString(), duration }
      console.error(`[Rebuild] Failed:`, stderr.slice(-500))
      return c.json({ status: 'error', message: stderr.slice(-500) }, 500)
    }
  } catch (err: any) {
    lastBuild = { status: 'error', at: new Date().toISOString() }
    console.error(`[Rebuild] Error:`, err.message)
    return c.json({ status: 'error', message: err.message }, 500)
  } finally {
    building = false
  }
})

// GET /api/admin/rebuild — check build status
rebuildRoutes.get('/admin/rebuild', authMiddleware, (c) => {
  return c.json({ building, lastBuild })
})
