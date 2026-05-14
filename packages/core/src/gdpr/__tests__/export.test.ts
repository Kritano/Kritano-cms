import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { clearGdprSources, registerGdprSource } from '../registry'
import { runExport } from '../export'

const realSecret = process.env.GDPR_AUDIT_SECRET

beforeEach(() => {
  clearGdprSources()
  process.env.GDPR_AUDIT_SECRET = 'test-secret-do-not-use-in-prod-00000000'
})

afterEach(() => {
  if (realSecret === undefined) delete process.env.GDPR_AUDIT_SECRET
  else process.env.GDPR_AUDIT_SECRET = realSecret
})

describe('runExport', () => {
  test('produces an envelope with the v1 schema marker', async () => {
    const result = await runExport('alice@example.com', { skipAuditLog: true })
    expect(result.payload.schema).toBe('kritano-gdpr-export-v1')
  })

  test('subject is the normalised email', async () => {
    const result = await runExport('  Alice@EXAMPLE.com  ', { skipAuditLog: true })
    expect(result.payload.subject).toBe('alice@example.com')
  })

  test('emailHash matches between envelope and underlying search', async () => {
    const a = await runExport('alice@example.com', { skipAuditLog: true })
    const b = await runExport(' Alice@example.com ', { skipAuditLog: true })
    expect(a.payload.emailHash).toBe(b.payload.emailHash)
    expect(a.payload.emailHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('totalRecords sums across sources', async () => {
    registerGdprSource({
      name: 'form:contact',
      displayName: 'Contact form',
      table: 'form_submissions',
      emailColumn: 'email',
      searchFn: async () => [{ id: '1', email: 'alice@example.com' }],
    })
    registerGdprSource({
      name: 'custom:audit',
      displayName: 'Audit submissions',
      table: 'audit_submissions',
      emailColumn: 'email',
      searchFn: async () => [
        { id: 'a1', email: 'alice@example.com' },
        { id: 'a2', email: 'alice@example.com' },
      ],
    })

    const result = await runExport('alice@example.com', { skipAuditLog: true })
    expect(result.payload.totalRecords).toBe(3)
    expect(result.payload.sources).toHaveLength(2)
  })

  test('filename uses date + 8-char hash prefix, never the plaintext email', async () => {
    const result = await runExport('alice@example.com', { skipAuditLog: true })
    // Format: gdpr-export-YYYY-MM-DD-XXXXXXXX.json
    expect(result.filename).toMatch(/^gdpr-export-\d{4}-\d{2}-\d{2}-[0-9a-f]{8}\.json$/)
    expect(result.filename).not.toContain('alice')
    expect(result.filename).not.toContain('@')
    expect(result.filename).not.toContain('example.com')
  })

  test('filename hash matches the envelope hash', async () => {
    const result = await runExport('alice@example.com', { skipAuditLog: true })
    const hashFromFilename = result.filename.match(/-([0-9a-f]{8})\.json$/)?.[1]
    expect(hashFromFilename).toBe(result.payload.emailHash.slice(0, 8))
  })

  test('exportedAt is an ISO timestamp', async () => {
    const result = await runExport('alice@example.com', { skipAuditLog: true })
    expect(result.payload.exportedAt).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)
    expect(Number.isFinite(Date.parse(result.payload.exportedAt))).toBe(true)
  })

  test('exportedBy reflects the searchedByUserId option', async () => {
    const result = await runExport('alice@example.com', {
      skipAuditLog: true,
      searchedByUserId: '00000000-0000-0000-0000-000000000001',
    })
    expect(result.payload.exportedBy).toBe('00000000-0000-0000-0000-000000000001')
  })

  test('exportedBy is null when no user id supplied', async () => {
    const result = await runExport('alice@example.com', { skipAuditLog: true })
    expect(result.payload.exportedBy).toBeNull()
  })

  test('sources filter narrows the envelope content', async () => {
    registerGdprSource({
      name: 'custom:keep',
      table: 'k',
      emailColumn: 'email',
      searchFn: async () => [{ id: 'k1', email: 'alice@example.com' }],
    })
    registerGdprSource({
      name: 'custom:skip',
      table: 's',
      emailColumn: 'email',
      searchFn: async () => [{ id: 's1', email: 'alice@example.com' }],
    })

    const result = await runExport('alice@example.com', {
      skipAuditLog: true,
      sources: ['custom:keep'],
    })

    expect(result.payload.sources).toHaveLength(1)
    expect(result.payload.sources[0].source).toBe('custom:keep')
  })

  test('subjectEmail override appears in the envelope but does not change the hash', async () => {
    const result = await runExport('alice@example.com', {
      skipAuditLog: true,
      subjectEmail: 'redacted@privacy.local',
    })
    expect(result.payload.subject).toBe('redacted@privacy.local')
    // Hash still derived from the original search email
    expect(result.payload.emailHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('throws GdprNotConfiguredError when secret is missing', async () => {
    delete process.env.GDPR_AUDIT_SECRET
    await expect(
      runExport('alice@example.com', { skipAuditLog: true }),
    ).rejects.toThrow('GDPR_AUDIT_SECRET')
  })
})
