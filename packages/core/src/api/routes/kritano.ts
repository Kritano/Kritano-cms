import { Hono } from 'hono'
import { getClient } from '../../db/client'

export const kritanoRoutes = new Hono()

// POST /api/kritano/webhook — Receives audit completion events from Kritano
kritanoRoutes.post('/kritano/webhook', async (c) => {
  const body = await c.req.json()

  if (body.event !== 'audit.completed') {
    return c.json({ error: { code: 'UNKNOWN_EVENT', message: `Unknown event: ${body.event}` } }, 400)
  }

  const sql = getClient()

  // Store the latest scores
  await sql`
    INSERT INTO site_settings (key, value)
    VALUES ('kritano_scores', ${JSON.stringify(body.scores)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify(body.scores)}::jsonb, updated_at = now()
  `

  // Store audit metadata
  await sql`
    INSERT INTO site_settings (key, value)
    VALUES ('kritano_last_audit', ${JSON.stringify({
      auditId: body.audit_id || body.auditId,
      completedAt: body.completed_at || body.completedAt,
    })}::jsonb)
    ON CONFLICT (key) DO UPDATE SET value = ${JSON.stringify({
      auditId: body.audit_id || body.auditId,
      completedAt: body.completed_at || body.completedAt,
    })}::jsonb, updated_at = now()
  `

  return c.json({ ok: true })
})

// GET /api/kritano/status — Get current Kritano connection state
kritanoRoutes.get('/kritano/status', async (c) => {
  const sql = getClient()

  const tokenRow = await sql`SELECT value FROM site_settings WHERE key = 'kritano_token' LIMIT 1`
  const scoresRow = await sql`SELECT value FROM site_settings WHERE key = 'kritano_scores' LIMIT 1`
  const auditRow = await sql`SELECT value FROM site_settings WHERE key = 'kritano_last_audit' LIMIT 1`

  return c.json({
    connected: tokenRow.length > 0,
    scores: scoresRow.length > 0 ? (scoresRow[0] as Record<string, unknown>).value : null,
    lastAudit: auditRow.length > 0 ? (auditRow[0] as Record<string, unknown>).value : null,
  })
})
