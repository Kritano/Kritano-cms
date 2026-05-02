import bcrypt from 'bcryptjs'
import { getClient } from '../db/client'
import { markConfigured } from './guard'
import { signToken, signRefreshToken } from '../api/middleware/auth'

export interface InstallerSetupData {
  // Account
  name: string
  email: string
  password: string
  // Site
  siteName: string
  domain: string
  language: string
  // Starter
  starter: string
}

export async function runSetup(data: InstallerSetupData): Promise<{
  accessToken: string
  refreshToken: string
}> {
  const sql = getClient()

  // 1. Create admin user
  const passwordHash = await bcrypt.hash(data.password, 10)
  const userRows = await sql`
    INSERT INTO users (email, password_hash, name)
    VALUES (${data.email}, ${passwordHash}, ${data.name})
    RETURNING id, email
  `
  const user = userRows[0] as { id: string; email: string }

  // 2. Update site settings
  try {
    await sql`
      INSERT INTO site_settings (key, value)
      VALUES
        ('site_name', ${JSON.stringify(data.siteName)}::jsonb),
        ('site_domain', ${JSON.stringify(data.domain)}::jsonb),
        ('site_language', ${JSON.stringify(data.language)}::jsonb),
        ('cms_configured', 'true'::jsonb)
      ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
    `
  } catch {
    // site_settings table may not exist yet — that's ok
  }

  // 3. Mark as configured
  markConfigured()

  // 4. Generate session tokens
  const payload = { sub: user.id, email: user.email }
  const accessToken = signToken(payload)
  const refreshToken = signRefreshToken(payload)

  return { accessToken, refreshToken }
}
