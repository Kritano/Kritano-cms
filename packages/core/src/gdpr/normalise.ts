import { createHmac } from 'node:crypto'

/**
 * Normalise an email for storage, lookup, and hashing. Lower-case + trim.
 * Single source of truth — used by writes, searches, and hashEmailForAudit
 * so they always agree.
 */
export function normaliseEmail(input: string): string {
  return input.trim().toLowerCase()
}

/**
 * HMAC-SHA256 of the normalised email keyed by GDPR_AUDIT_SECRET.
 *
 * Why HMAC and not raw SHA-256: emails are low-entropy. Raw SHA-256(email)
 * reverses trivially via rainbow table given a DB dump. HMAC with an
 * out-of-DB secret defends against that — an attacker who gets the DB but
 * not the secret cannot reverse the hash.
 *
 * The secret must never be rotated. Rotating it breaks the link between
 * historic audit-log entries and any future lookups for the same subject.
 * Treat it like a database encryption key.
 */
export function hashEmailForAudit(email: string): string {
  const secret = process.env.GDPR_AUDIT_SECRET
  if (!secret || secret.length < 16) {
    throw new GdprNotConfiguredError(
      'GDPR_AUDIT_SECRET is not set (or is shorter than 16 chars). ' +
        'Add a long random string (e.g. `openssl rand -hex 32`) to your .env ' +
        'and never rotate it — see docs/gdpr.md.',
    )
  }
  return createHmac('sha256', secret).update(normaliseEmail(email)).digest('hex')
}

/** Cheap probe used by the API layer to return 503 with a clear message. */
export function isGdprConfigured(): boolean {
  const secret = process.env.GDPR_AUDIT_SECRET
  return !!secret && secret.length >= 16
}

export class GdprNotConfiguredError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'GdprNotConfiguredError'
  }
}
