import { Hono } from 'hono'
import { installerOnlyGuard } from './guard'
import { runSetup, type InstallerSetupData } from './setup'

export const installerRoutes = new Hono()

// Rate limiting — simple in-memory tracker
const requestCounts = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = requestCounts.get(ip)

  if (!entry || entry.resetAt < now) {
    requestCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 })
    return true
  }

  entry.count++
  return entry.count <= 10
}

// GET /api/install/status — check if CMS is configured
installerRoutes.get('/install/status', async (c) => {
  const { isConfigured } = await import('./guard')
  const configured = await isConfigured()
  return c.json({ configured })
})

// POST /api/install/setup — run the full setup
installerRoutes.post('/install/setup', installerOnlyGuard, async (c) => {
  const ip = c.req.header('x-forwarded-for') || c.req.header('x-real-ip') || 'unknown'

  if (!checkRateLimit(ip)) {
    return c.json({ error: { code: 'RATE_LIMITED', message: 'Too many attempts. Try again in an hour.' } }, 429)
  }

  const body = await c.req.json<InstallerSetupData>()

  // Validate
  if (!body.email || !body.password || !body.name) {
    return c.json({ error: { code: 'VALIDATION', message: 'Name, email, and password are required' } }, 400)
  }

  if (body.password.length < 12) {
    return c.json({ error: { code: 'VALIDATION', message: 'Password must be at least 12 characters' } }, 400)
  }

  if (!body.siteName) {
    return c.json({ error: { code: 'VALIDATION', message: 'Site name is required' } }, 400)
  }

  try {
    const result = await runSetup(body)
    return c.json({ success: true, ...result })
  } catch (err) {
    return c.json({
      error: { code: 'SETUP_FAILED', message: err instanceof Error ? err.message : 'Setup failed' },
    }, 500)
  }
})
