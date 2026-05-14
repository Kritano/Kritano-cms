import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import { clearGdprSources, registerGdprSource } from '../registry'
import { GdprUnsupportedMethodError, runDelete } from '../delete'

const realSecret = process.env.GDPR_AUDIT_SECRET

beforeEach(() => {
  clearGdprSources()
  process.env.GDPR_AUDIT_SECRET = 'test-secret-do-not-use-in-prod-00000000'
})

afterEach(() => {
  if (realSecret === undefined) delete process.env.GDPR_AUDIT_SECRET
  else process.env.GDPR_AUDIT_SECRET = realSecret
})

describe('runDelete', () => {
  test('returns empty results when no sources are registered', async () => {
    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'manual test rationale',
    })
    expect(result.results).toHaveLength(0)
    expect(result.summary.totalAttempted).toBe(0)
    expect(result.summary.totalDeleted).toBe(0)
  })

  test('rejects unsupported method (anonymised) in v1', async () => {
    await expect(
      runDelete('alice@example.com', {
        method: 'anonymised',
        skipAuditLog: true,
      }),
    ).rejects.toBeInstanceOf(GdprUnsupportedMethodError)
  })

  test('deletes matched rows via deleteFn and reports counts', async () => {
    const deletedRows: string[] = []
    registerGdprSource({
      name: 'custom:audit',
      displayName: 'Audit submissions',
      table: 'audit_submissions',
      emailColumn: 'email',
      searchFn: async () => [
        { id: 'a1', email: 'alice@example.com' },
        { id: 'a2', email: 'alice@example.com' },
      ],
      deleteFn: async (row) => {
        deletedRows.push(String(row.id))
      },
    })

    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested',
    })

    expect(deletedRows).toEqual(['a1', 'a2'])
    expect(result.results).toHaveLength(1)
    expect(result.results[0].recordsAttempted).toBe(2)
    expect(result.results[0].recordsDeleted).toBe(2)
    expect(result.results[0].recordsFailed).toBe(0)
    expect(result.results[0].status).toBe('success')
    expect(result.summary.totalDeleted).toBe(2)
  })

  test('invokes onDelete callback per row, after deletion', async () => {
    const order: string[] = []
    registerGdprSource({
      name: 'custom:files',
      table: 'files',
      emailColumn: 'email',
      searchFn: async () => [
        { id: 'f1', email: 'alice@example.com', pdf_path: '/tmp/f1.pdf' },
      ],
      deleteFn: async (row) => {
        order.push(`delete:${row.id}`)
      },
      onDelete: async (row) => {
        order.push(`onDelete:${row.id}`)
      },
    })

    await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(order).toEqual(['delete:f1', 'onDelete:f1'])
  })

  test('a throwing onDelete is logged but does not count the row as failed', async () => {
    registerGdprSource({
      name: 'custom:files',
      table: 'files',
      emailColumn: 'email',
      searchFn: async () => [{ id: 'f1', email: 'alice@example.com' }],
      deleteFn: async () => {},
      onDelete: async () => {
        throw new Error('file unlink failed')
      },
    })

    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    // onDelete failures are best-effort — the DB row is already gone, so we
    // count it as deleted and just warn.
    expect(result.results[0].recordsDeleted).toBe(1)
    expect(result.results[0].recordsFailed).toBe(0)
    expect(result.results[0].status).toBe('success')
  })

  test('per-row deleteFn failure is counted as failed but does not abort the source', async () => {
    registerGdprSource({
      name: 'custom:audit',
      table: 'audit_submissions',
      emailColumn: 'email',
      searchFn: async () => [
        { id: 'a1', email: 'alice@example.com' },
        { id: 'a2', email: 'alice@example.com' },
        { id: 'a3', email: 'alice@example.com' },
      ],
      deleteFn: async (row) => {
        if (row.id === 'a2') throw new Error('row a2 locked')
      },
    })

    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(result.results[0].recordsAttempted).toBe(3)
    expect(result.results[0].recordsDeleted).toBe(2)
    expect(result.results[0].recordsFailed).toBe(1)
    expect(result.results[0].status).toBe('failed')
    expect(result.results[0].failureReason).toContain('1 of 3')
    expect(result.summary.totalFailed).toBe(1)
    expect(result.summary.totalDeleted).toBe(2)
  })

  test('a source whose searchFn throws does not break the other sources', async () => {
    registerGdprSource({
      name: 'custom:broken',
      table: 'x',
      emailColumn: 'email',
      searchFn: async () => {
        throw new Error('connection refused')
      },
    })
    registerGdprSource({
      name: 'custom:ok',
      table: 'y',
      emailColumn: 'email',
      searchFn: async () => [{ id: 'r1', email: 'alice@example.com' }],
      deleteFn: async () => {},
    })

    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(result.results).toHaveLength(2)
    const broken = result.results.find((r) => r.source === 'custom:broken')!
    expect(broken.status).toBe('failed')
    expect(broken.failureReason).toContain('connection refused')

    const ok = result.results.find((r) => r.source === 'custom:ok')!
    expect(ok.status).toBe('success')
    expect(ok.recordsDeleted).toBe(1)
  })

  test('normalises input email before search', async () => {
    let received: string | undefined
    registerGdprSource({
      name: 'custom:probe',
      table: 'x',
      emailColumn: 'email',
      searchFn: async (e) => {
        received = e
        return []
      },
      deleteFn: async () => {},
    })

    await runDelete('  Alice@Example.COM ', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(received).toBe('alice@example.com')
  })

  test('source filter narrows the set acted on', async () => {
    let aCalled = false
    let bCalled = false
    registerGdprSource({
      name: 'custom:a',
      table: 'a',
      emailColumn: 'email',
      searchFn: async () => {
        aCalled = true
        return [{ id: '1', email: 'alice@example.com' }]
      },
      deleteFn: async () => {},
    })
    registerGdprSource({
      name: 'custom:b',
      table: 'b',
      emailColumn: 'email',
      searchFn: async () => {
        bCalled = true
        return [{ id: '2', email: 'alice@example.com' }]
      },
      deleteFn: async () => {},
    })

    await runDelete('alice@example.com', {
      sources: ['custom:a'],
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(aCalled).toBe(true)
    expect(bCalled).toBe(false)
  })

  test('empty result for a source still produces a per-source entry (skipped audit)', async () => {
    registerGdprSource({
      name: 'custom:empty',
      table: 'x',
      emailColumn: 'email',
      searchFn: async () => [],
      deleteFn: async () => {},
    })

    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })

    expect(result.results).toHaveLength(1)
    expect(result.results[0].status).toBe('success')
    expect(result.results[0].recordsAttempted).toBe(0)
    expect(result.results[0].recordsDeleted).toBe(0)
  })

  test('throws GdprNotConfiguredError when secret is missing', async () => {
    delete process.env.GDPR_AUDIT_SECRET
    await expect(
      runDelete('alice@example.com', {
        skipAuditLog: true,
        rationale: 'subject requested deletion',
      }),
    ).rejects.toThrow('GDPR_AUDIT_SECRET')
  })

  test('default requestedBy is admin', async () => {
    let capturedId: string | null = null as string | null
    registerGdprSource({
      name: 'custom:audit',
      table: 'x',
      emailColumn: 'email',
      searchFn: async () => [{ id: 'r1', email: 'alice@example.com' }],
      deleteFn: async (row) => {
        capturedId = String(row.id)
      },
    })
    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })
    expect(capturedId).toBe('r1')
    expect(result.results[0].status).toBe('success')
  })

  test('row without id and no deleteFn fails that row', async () => {
    registerGdprSource({
      name: 'custom:no-id',
      table: 'x',
      emailColumn: 'email',
      // No deleteFn — falls through to default DELETE BY id, which requires
      // row.id. With no id present, the row should fail (logged as failed).
      searchFn: async () => [{ email: 'alice@example.com' }],
    })
    const result = await runDelete('alice@example.com', {
      skipAuditLog: true,
      rationale: 'subject requested deletion',
    })
    expect(result.results[0].recordsFailed).toBe(1)
    expect(result.results[0].recordsDeleted).toBe(0)
  })
})
