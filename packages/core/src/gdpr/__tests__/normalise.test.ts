import { afterEach, beforeEach, describe, expect, test } from 'bun:test'
import {
  GdprNotConfiguredError,
  hashEmailForAudit,
  isGdprConfigured,
  normaliseEmail,
} from '../normalise'

describe('normaliseEmail', () => {
  test('lowercases input', () => {
    expect(normaliseEmail('Alice@Example.COM')).toBe('alice@example.com')
  })

  test('trims surrounding whitespace', () => {
    expect(normaliseEmail('  alice@example.com  ')).toBe('alice@example.com')
  })

  test('handles tab/newline whitespace', () => {
    expect(normaliseEmail('\talice@example.com\n')).toBe('alice@example.com')
  })

  test('is idempotent', () => {
    const once = normaliseEmail(' Alice@Example.COM ')
    const twice = normaliseEmail(once)
    expect(twice).toBe(once)
  })
})

describe('hashEmailForAudit', () => {
  const realSecret = process.env.GDPR_AUDIT_SECRET

  beforeEach(() => {
    process.env.GDPR_AUDIT_SECRET = 'test-secret-do-not-use-in-prod-0000000000'
  })

  afterEach(() => {
    if (realSecret === undefined) delete process.env.GDPR_AUDIT_SECRET
    else process.env.GDPR_AUDIT_SECRET = realSecret
  })

  test('is deterministic for the same input', () => {
    const a = hashEmailForAudit('alice@example.com')
    const b = hashEmailForAudit('alice@example.com')
    expect(a).toBe(b)
  })

  test('normalises input before hashing', () => {
    const lower = hashEmailForAudit('alice@example.com')
    const upper = hashEmailForAudit('  Alice@EXAMPLE.com  ')
    expect(lower).toBe(upper)
  })

  test('differs across distinct emails', () => {
    expect(hashEmailForAudit('alice@example.com')).not.toBe(
      hashEmailForAudit('bob@example.com'),
    )
  })

  test('differs across distinct secrets', () => {
    const a = hashEmailForAudit('alice@example.com')
    process.env.GDPR_AUDIT_SECRET = 'different-secret-of-sufficient-length-xx'
    const b = hashEmailForAudit('alice@example.com')
    expect(a).not.toBe(b)
  })

  test('returns hex of 64 chars (sha256)', () => {
    expect(hashEmailForAudit('alice@example.com')).toMatch(/^[0-9a-f]{64}$/)
  })

  test('throws GdprNotConfiguredError when secret is missing', () => {
    delete process.env.GDPR_AUDIT_SECRET
    expect(() => hashEmailForAudit('alice@example.com')).toThrow(
      GdprNotConfiguredError,
    )
  })

  test('throws when secret is shorter than 16 chars', () => {
    process.env.GDPR_AUDIT_SECRET = 'too-short'
    expect(() => hashEmailForAudit('alice@example.com')).toThrow(
      GdprNotConfiguredError,
    )
  })
})

describe('isGdprConfigured', () => {
  const realSecret = process.env.GDPR_AUDIT_SECRET

  afterEach(() => {
    if (realSecret === undefined) delete process.env.GDPR_AUDIT_SECRET
    else process.env.GDPR_AUDIT_SECRET = realSecret
  })

  test('false when unset', () => {
    delete process.env.GDPR_AUDIT_SECRET
    expect(isGdprConfigured()).toBe(false)
  })

  test('false when too short', () => {
    process.env.GDPR_AUDIT_SECRET = 'short'
    expect(isGdprConfigured()).toBe(false)
  })

  test('true when set to a sufficient secret', () => {
    process.env.GDPR_AUDIT_SECRET = 'long-enough-secret-for-tests-0000'
    expect(isGdprConfigured()).toBe(true)
  })
})
