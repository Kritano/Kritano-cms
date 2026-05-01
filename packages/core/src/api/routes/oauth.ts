import { Hono } from 'hono'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { getClient } from '../../db/client'
import { signToken, signRefreshToken, requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { logActivity } from '../../lib/activity-logger'

export const oauthRoutes = new Hono<AuthEnv>()

// In-memory state store for CSRF protection (short-lived)
const oauthStates = new Map<string, { provider: string; expiresAt: number }>()

setInterval(() => {
  const now = Date.now()
  for (const [key, value] of oauthStates) {
    if (value.expiresAt < now) oauthStates.delete(key)
  }
}, 60_000)

// ── Provider configs ────────────────────────────────────────────────────────

interface OAuthProviderConfig {
  clientId: string
  clientSecret: string
  authorizeUrl: string
  tokenUrl: string
  userInfoUrl: string
  scopes: string[]
  extractProfile: (data: Record<string, unknown>) => { id: string; email: string; name: string }
}

function getGoogleConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GOOGLE_CLIENT_ID
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
    tokenUrl: 'https://oauth2.googleapis.com/token',
    userInfoUrl: 'https://www.googleapis.com/oauth2/v2/userinfo',
    scopes: ['openid', 'email', 'profile'],
    extractProfile: (data) => ({
      id: String(data.id),
      email: String(data.email),
      name: String(data.name || data.email),
    }),
  }
}

function getGithubConfig(): OAuthProviderConfig | null {
  const clientId = process.env.GITHUB_CLIENT_ID
  const clientSecret = process.env.GITHUB_CLIENT_SECRET
  if (!clientId || !clientSecret) return null

  return {
    clientId,
    clientSecret,
    authorizeUrl: 'https://github.com/login/oauth/authorize',
    tokenUrl: 'https://github.com/login/oauth/access_token',
    userInfoUrl: 'https://api.github.com/user',
    scopes: ['user:email'],
    extractProfile: (data) => ({
      id: String(data.id),
      email: String(data.email || ''),
      name: String(data.name || data.login || ''),
    }),
  }
}

function getProviderConfig(provider: string): OAuthProviderConfig | null {
  switch (provider) {
    case 'google': return getGoogleConfig()
    case 'github': return getGithubConfig()
    default: return null
  }
}

function getCallbackUrl(provider: string): string {
  const base = process.env.SITE_URL || process.env.ADMIN_URL || 'http://localhost:3005'
  return `${base}/api/auth/oauth/${provider}/callback`
}

// ── Available providers endpoint ────────────────────────────────────────────

oauthRoutes.get('/auth/oauth/providers', async (c) => {
  const providers: string[] = []
  if (getGoogleConfig()) providers.push('google')
  if (getGithubConfig()) providers.push('github')
  return c.json({ providers })
})

// ── Initiate OAuth flow ─────────────────────────────────────────────────────

oauthRoutes.get('/auth/oauth/:provider', async (c) => {
  const provider = c.req.param('provider')
  const config = getProviderConfig(provider)

  if (!config) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: `${provider} OAuth not configured` } }, 400)
  }

  const state = crypto.randomBytes(32).toString('hex')
  oauthStates.set(state, { provider, expiresAt: Date.now() + 10 * 60 * 1000 })

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getCallbackUrl(provider),
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  })

  return c.redirect(`${config.authorizeUrl}?${params}`)
})

// ── OAuth callback ──────────────────────────────────────────────────────────

oauthRoutes.get('/auth/oauth/:provider/callback', async (c) => {
  const provider = c.req.param('provider')
  const code = c.req.query('code')
  const state = c.req.query('state')
  const error = c.req.query('error')

  const adminUrl = process.env.ADMIN_URL || 'http://localhost:3006/admin'

  if (error) {
    return c.redirect(`${adminUrl}/login?error=oauth_denied`)
  }

  if (!code || !state) {
    return c.redirect(`${adminUrl}/login?error=oauth_invalid`)
  }

  // Validate state
  const storedState = oauthStates.get(state)
  if (!storedState || storedState.provider !== provider || storedState.expiresAt < Date.now()) {
    oauthStates.delete(state)
    return c.redirect(`${adminUrl}/login?error=oauth_expired`)
  }
  oauthStates.delete(state)

  const config = getProviderConfig(provider)
  if (!config) {
    return c.redirect(`${adminUrl}/login?error=oauth_not_configured`)
  }

  try {
    // Exchange code for access token
    const tokenRes = await fetch(config.tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        code,
        redirect_uri: getCallbackUrl(provider),
        grant_type: 'authorization_code',
      }),
    })

    const tokenData = await tokenRes.json() as Record<string, unknown>
    const accessToken = tokenData.access_token as string

    if (!accessToken) {
      return c.redirect(`${adminUrl}/login?error=oauth_token_failed`)
    }

    // Fetch user profile
    const userRes = await fetch(config.userInfoUrl, {
      headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
    })
    const userData = await userRes.json() as Record<string, unknown>

    // For GitHub, email might not be in the main profile — fetch from emails API
    if (provider === 'github' && !userData.email) {
      try {
        const emailsRes = await fetch('https://api.github.com/user/emails', {
          headers: { Authorization: `Bearer ${accessToken}`, Accept: 'application/json' },
        })
        const emails = await emailsRes.json() as Array<{ email: string; primary: boolean }>
        const primary = emails.find((e) => e.primary)
        if (primary) userData.email = primary.email
      } catch {}
    }

    const profile = config.extractProfile(userData)

    if (!profile.id) {
      return c.redirect(`${adminUrl}/login?error=oauth_profile_failed`)
    }

    const sql = getClient()

    // Look up existing OAuth account
    const existingOAuth = await sql`
      SELECT * FROM oauth_accounts WHERE provider = ${provider} AND provider_id = ${profile.id} LIMIT 1
    `

    let userId: string

    if (existingOAuth.length > 0) {
      // Existing OAuth link — log in
      userId = (existingOAuth[0] as Record<string, unknown>).user_id as string
    } else if (profile.email) {
      // Check if email matches existing user
      const existingUser = await sql`SELECT id FROM users WHERE email = ${profile.email} LIMIT 1`

      if (existingUser.length > 0) {
        // Link OAuth to existing user
        userId = (existingUser[0] as Record<string, unknown>).id as string
        await sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_id, email)
          VALUES (${userId}, ${provider}, ${profile.id}, ${profile.email})
        `
      } else {
        // Create new user + OAuth link
        const randomPassword = crypto.randomBytes(32).toString('hex')
        const passwordHash = await bcrypt.hash(randomPassword, 10)

        const newUser = await sql`
          INSERT INTO users (email, password_hash, name)
          VALUES (${profile.email}, ${passwordHash}, ${profile.name})
          RETURNING id
        `
        userId = (newUser[0] as Record<string, unknown>).id as string

        await sql`
          INSERT INTO oauth_accounts (user_id, provider, provider_id, email)
          VALUES (${userId}, ${provider}, ${profile.id}, ${profile.email})
        `

        await logActivity({
          userId,
          action: 'user.created_via_oauth',
          resource: 'user',
          resourceId: userId,
          metadata: { provider },
        })
      }
    } else {
      return c.redirect(`${adminUrl}/login?error=oauth_no_email`)
    }

    // Generate JWT tokens
    const userRows = await sql`SELECT id, email FROM users WHERE id = ${userId} LIMIT 1`
    const user = userRows[0] as Record<string, unknown>

    const jwtPayload = { sub: user.id as string, email: user.email as string }
    const jwt = signToken(jwtPayload)
    const refresh = signRefreshToken(jwtPayload)

    // Redirect to admin with tokens in URL fragment (client reads and stores)
    return c.redirect(`${adminUrl}/login?oauth_access=${jwt}&oauth_refresh=${refresh}`)
  } catch (err) {
    console.error(`[OAuth] ${provider} callback error:`, err)
    return c.redirect(`${adminUrl}/login?error=oauth_failed`)
  }
})

// ── Link OAuth to existing account ──────────────────────────────────────────

oauthRoutes.post('/auth/oauth/link', requireAuth, async (c) => {
  const user = c.get('user')
  const body = await c.req.json<{ provider: string }>()

  if (!body.provider || !['google', 'github'].includes(body.provider)) {
    return c.json({ error: { code: 'VALIDATION', message: 'Invalid provider' } }, 400)
  }

  const config = getProviderConfig(body.provider)
  if (!config) {
    return c.json({ error: { code: 'NOT_CONFIGURED', message: `${body.provider} OAuth not configured` } }, 400)
  }

  // Return the OAuth URL — the frontend will redirect to it
  const state = crypto.randomBytes(32).toString('hex')
  oauthStates.set(state, { provider: body.provider, expiresAt: Date.now() + 10 * 60 * 1000 })

  const params = new URLSearchParams({
    client_id: config.clientId,
    redirect_uri: getCallbackUrl(body.provider),
    response_type: 'code',
    scope: config.scopes.join(' '),
    state,
  })

  return c.json({ url: `${config.authorizeUrl}?${params}` })
})

// ── Unlink OAuth from account ───────────────────────────────────────────────

oauthRoutes.delete('/auth/oauth/:provider/unlink', requireAuth, async (c) => {
  const user = c.get('user')
  const provider = c.req.param('provider')
  const sql = getClient()

  // Check if user has a password set (non-random hash)
  const userRows = await sql`SELECT password_hash FROM users WHERE id = ${user.sub} LIMIT 1`
  if (userRows.length === 0) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'User not found' } }, 404)
  }

  // Count remaining OAuth providers
  const oauthCount = await sql`SELECT COUNT(*)::int as count FROM oauth_accounts WHERE user_id = ${user.sub}`
  const count = (oauthCount[0] as Record<string, unknown>).count as number

  // Must have at least one other login method
  if (count <= 1) {
    return c.json({
      error: { code: 'VALIDATION', message: 'Cannot unlink the only login method. Set a password first.' },
    }, 400)
  }

  await sql`DELETE FROM oauth_accounts WHERE user_id = ${user.sub} AND provider = ${provider}`

  return c.json({ ok: true })
})

// ── List linked accounts for current user ───────────────────────────────────

oauthRoutes.get('/auth/oauth/accounts', requireAuth, async (c) => {
  const user = c.get('user')
  const sql = getClient()

  const rows = await sql`
    SELECT provider, provider_id, email, created_at
    FROM oauth_accounts
    WHERE user_id = ${user.sub}
    ORDER BY created_at
  `

  return c.json({ data: rows })
})
