import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { clearGdprSources, registerGdprSource } from '../registry'
import { runSearch } from '../search'

const realSecret = process.env.GDPR_AUDIT_SECRET

beforeEach(() => {
  clearGdprSources()
  process.env.GDPR_AUDIT_SECRET = 'test-secret-do-not-use-in-prod-00000000'
})

afterEach(() => {
  if (realSecret === undefined) delete process.env.GDPR_AUDIT_SECRET
  else process.env.GDPR_AUDIT_SECRET = realSecret
})

describe('runSearch', () => {
  test('returns empty results when no sources are registered', async () => {
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    expect(result.results).toHaveLength(0)
    expect(result.totalRecords).toBe(0)
    expect(result.emailHash).toMatch(/^[0-9a-f]{64}$/)
  })

  test('returns empty results when no source matches', async () => {
    registerGdprSource({
      name: 'custom:empty',
      table: 'empty',
      emailColumn: 'email',
      searchFn: async () => [],
    })
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    expect(result.results).toHaveLength(0)
    expect(result.totalRecords).toBe(0)
  })

  test('aggregates across multiple sources', async () => {
    registerGdprSource({
      name: 'form:contact',
      displayName: 'Contact form',
      table: 'form_submissions',
      emailColumn: 'email',
      searchFn: async () => [
        { id: 'r1', email: 'alice@example.com', name: 'Alice', created_at: new Date('2026-04-12T10:00:00Z') },
      ],
    })
    registerGdprSource({
      name: 'custom:audit',
      displayName: 'Audit submission',
      table: 'audit_submissions',
      emailColumn: 'email',
      identifierColumn: 'audit_ref',
      searchFn: async () => [
        { id: 'a1', audit_ref: 'CG-2026-031', email: 'alice@example.com', companyName: 'Acme' },
        { id: 'a2', audit_ref: 'CG-2026-047', email: 'alice@example.com', companyName: 'Acme' },
      ],
    })

    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    expect(result.results).toHaveLength(2)
    expect(result.totalRecords).toBe(3)

    const form = result.results.find((r) => r.source === 'form:contact')!
    expect(form.records).toHaveLength(1)
    expect(form.records[0].id).toBe('r1')
    expect(form.records[0].createdAt).toBe('2026-04-12T10:00:00.000Z')

    const audit = result.results.find((r) => r.source === 'custom:audit')!
    expect(audit.records).toHaveLength(2)
    expect(audit.records[0].identifier).toBe('CG-2026-031')
    expect(audit.records[0].summary).toContain('CG-2026-031')
    expect(audit.records[0].summary).toContain('Acme')
  })

  test('normalises the input email before invoking searchFn', async () => {
    let receivedEmail: string | undefined
    registerGdprSource({
      name: 'custom:probe',
      table: 'x',
      emailColumn: 'email',
      searchFn: async (e) => {
        receivedEmail = e
        return []
      },
    })
    await runSearch('  Alice@EXAMPLE.com  ', { skipAuditLog: true })
    expect(receivedEmail).toBe('alice@example.com')
  })

  test('hash is stable across case/whitespace variants', async () => {
    registerGdprSource({
      name: 'custom:probe',
      table: 'x',
      emailColumn: 'email',
      searchFn: async () => [],
    })
    const a = await runSearch('alice@example.com', { skipAuditLog: true })
    const b = await runSearch(' Alice@EXAMPLE.com ', { skipAuditLog: true })
    expect(a.emailHash).toBe(b.emailHash)
  })

  test('applies excludeFields to record data', async () => {
    registerGdprSource({
      name: 'custom:audit',
      table: 'audit_submissions',
      emailColumn: 'email',
      excludeFields: ['ip_address', 'user_agent'],
      searchFn: async () => [
        {
          id: 'r1',
          email: 'alice@example.com',
          name: 'Alice',
          ip_address: '1.2.3.4',
          user_agent: 'curl/8',
        },
      ],
    })
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    const record = result.results[0].records[0]
    expect(record.data).not.toHaveProperty('ip_address')
    expect(record.data).not.toHaveProperty('user_agent')
    expect(record.data.email).toBe('alice@example.com')
    expect(record.data.name).toBe('Alice')
  })

  test('applies fields whitelist to record data', async () => {
    registerGdprSource({
      name: 'custom:audit',
      table: 'audit_submissions',
      emailColumn: 'email',
      fields: ['id', 'email'],
      searchFn: async () => [
        { id: 'r1', email: 'alice@example.com', name: 'Alice', extra: 'secret' },
      ],
    })
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    const record = result.results[0].records[0]
    expect(Object.keys(record.data).sort()).toEqual(['email', 'id'])
  })

  test('source filter narrows the set queried', async () => {
    registerGdprSource({
      name: 'custom:a',
      table: 'a',
      emailColumn: 'email',
      searchFn: async () => [{ id: '1', email: 'alice@example.com' }],
    })
    registerGdprSource({
      name: 'custom:b',
      table: 'b',
      emailColumn: 'email',
      searchFn: async () => [{ id: '2', email: 'alice@example.com' }],
    })
    const result = await runSearch('alice@example.com', {
      sources: ['custom:a'],
      skipAuditLog: true,
    })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].source).toBe('custom:a')
  })

  test('a broken source does not break the whole search', async () => {
    registerGdprSource({
      name: 'custom:broken',
      table: 'x',
      emailColumn: 'email',
      searchFn: async () => {
        throw new Error('boom')
      },
    })
    registerGdprSource({
      name: 'custom:ok',
      table: 'y',
      emailColumn: 'email',
      searchFn: async () => [{ id: 'r1', email: 'alice@example.com' }],
    })
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    expect(result.results).toHaveLength(1)
    expect(result.results[0].source).toBe('custom:ok')
  })

  test('throws GdprNotConfiguredError when secret is missing', async () => {
    delete process.env.GDPR_AUDIT_SECRET
    await expect(
      runSearch('alice@example.com', { skipAuditLog: true }),
    ).rejects.toThrow('GDPR_AUDIT_SECRET')
  })

  test('reads jsonb form-submission data field for summary', async () => {
    // form_submissions stores form fields inside row.data — verify the
    // summary builder peeks in there when top-level fields are absent.
    registerGdprSource({
      name: 'form:contact',
      displayName: 'Contact form',
      table: 'form_submissions',
      emailColumn: 'email',
      searchFn: async () => [
        {
          id: 'sub-1',
          form_id: 'form-1',
          data: { email: 'alice@example.com', name: 'Alice Q', message: 'hi' },
          created_at: new Date('2026-04-12T10:00:00Z'),
        },
      ],
    })
    const result = await runSearch('alice@example.com', { skipAuditLog: true })
    expect(result.results[0].records[0].summary).toContain('Alice Q')
  })
})
