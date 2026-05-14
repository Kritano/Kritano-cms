# GDPR / Data Subject Rights

Kritano ships first-class tooling for the four GDPR operations a small business actually performs: **lookup**, **export** (SAR — subject access request), **erasure** (right to be forgotten), and an **audit log** that survives the data it describes.

The module:

- **Auto-discovers** personal-data sources from your declared forms and collections — zero configuration for the common case.
- Lets you **register custom tables** that sit outside the standard CMS schema.
- Provides an admin page at `/admin/gdpr` for the day-to-day operations.
- Logs every operation permanently to two tables (`gdpr_search_log`, `gdpr_deletion_log`) so you can prove what happened to a regulator.

This doc is the consumer reference. For the design rationale and what's coming in v2, see `gdpr.md` at the repo root.

---

## Set up

GDPR support is **opt-in** — the module ships with the CMS but does nothing until you set `GDPR_AUDIT_SECRET`. Until then the admin page shows a setup hint and the API returns 503.

### 1. Generate the audit secret

```bash
openssl rand -hex 32
```

Add it to `.env`:

```env
GDPR_AUDIT_SECRET=replace-with-the-output-of-openssl-above
```

### Why this matters

Audit-log rows store an HMAC of every subject's email (`hmac_sha256(GDPR_AUDIT_SECRET, lower(trim(email)))`) instead of the email itself. That lets you prove "we deleted a record for this person" without holding their email indefinitely in the log.

Raw SHA-256 of an email is trivially brute-forced via rainbow table — emails have very low entropy. The HMAC key defends against that: an attacker who gets a DB dump cannot reverse the hash without also having the secret.

> **Never rotate `GDPR_AUDIT_SECRET`.** Rotating it breaks the link between historic audit-log entries and any future lookups for the same subject. Treat it like a database encryption key.

### 2. Restart the CMS

```bash
bun run dev
```

The `0006_gdpr_tables.sql` migration applies automatically (creates `gdpr_search_log` and `gdpr_deletion_log` plus the `pgcrypto` extension).

### 3. Visit `/admin/gdpr`

The page shows how many sources were auto-discovered. If you haven't declared any forms or collections with email fields yet, the count is 0 — that's fine. Continue to the next section to add some.

---

## How sources are discovered

A "source" is any table that holds personal data keyed by email. There are three ways a source ends up in the registry:

### Forms declared via `addForm()`

Any form with at least one `email`-typed field is auto-registered.

```typescript
// cms.config.ts
import { defineConfig, addForm } from '@kritano/cms/core'

addForm('contact', {
  fields: [
    { name: 'email',   type: 'email',    label: 'Email', required: true },
    { name: 'name',    type: 'text',     label: 'Your name' },
    { name: 'message', type: 'textarea', label: 'Message' },
  ],
})

export default defineConfig({ /* ... */ })
```

Registered as: `form:contact`. Searches join `form_submissions` with `forms` by slug and match against `lower(data->>'email')`.

If a form has multiple email fields, the first one wins. Forms with no email field are not auto-registered (and don't need to be — they aren't personal data).

### Collections with an `email()` field

Use the new `email()` field builder to explicitly mark a column as holding an email address:

```typescript
import { defineCollection, text, email, datetime } from '@kritano/cms/core'

defineCollection('subscriber', {
  fields: {
    email:       email().required(),
    name:        text(),
    consentedAt: datetime(),
  },
})
```

Registered as: `collection:subscriber`, searched against `lower(email)`.

`email()` is sugar for `text()` with a `format: 'email'` marker — the underlying database column is still `text`. The marker just tells the GDPR registry which column holds the email. (See [Why not a new field type](#why-not-a-new-field-type) below.)

### Fallback: the name heuristic

If you haven't switched a field over to `email()` yet, the registry falls back to a conservative name match on plain `text()` fields. It matches:

- `email`
- `*_email` (e.g. `contact_email`)
- `*Email` (e.g. `customerEmail`)

```typescript
defineCollection('lead', {
  fields: {
    email:        text(),  // ← auto-detected
    contactEmail: text(),  // ← also auto-detected (snake_case: contact_email)
    companyName:  text(),  // ← not matched
  },
})
```

Adding an explicit `email()` to your schemas is recommended — the marker survives renames and is unambiguous.

### Custom tables outside the CMS schema

For tables your application manages directly (lead pipelines, audit submissions, custom workflow state), call `registerGdprSource()` from `cms.config.ts`:

```typescript
import { registerGdprSource } from '@kritano/cms/gdpr'

registerGdprSource({
  name:           'custom:audit-submissions',
  displayName:    'AI readiness audit submission',
  table:          'audit_submissions',
  emailColumn:    'email',
  identifierColumn: 'audit_ref',          // shown alongside results
  retentionPolicyDays: 730,                // honoured by v2 retention sweep
  excludeFields:  ['ip_address', 'user_agent'],  // strip operational metadata from exports

  // Optional callback after row deletion — for example, unlinking a generated PDF
  onDelete: async (row) => {
    if (row.pdf_path) {
      const { unlink } = await import('node:fs/promises')
      await unlink(row.pdf_path as string).catch(() => {})
    }
  },
})
```

Re-registering with the same `name` overwrites — idempotent, safe for hot reload.

---

## Using the admin page

Open `/admin/gdpr`. The page is laid out top-to-bottom:

1. **Setup hint** (only if `GDPR_AUDIT_SECRET` is missing).
2. **Source summary** — N sources registered, broken down by auto-discovered vs custom.
3. **Search form** — email input, "Log this search as a SAR response" checkbox, optional reason.
4. **Results** — grouped by source, with per-record View / per-source Export and Delete, plus top-level "Export all" and "Delete all".
5. **Recent activity** — the last 50 log entries across searches and deletions, interleaved by timestamp.

### Looking up a subject

Type the email and press Search. The page calls `POST /api/admin/gdpr/search`, which writes a row to `gdpr_search_log` and returns matches across every registered source.

The lookup is case- and whitespace-insensitive — `Alice@Example.com  ` and `alice@example.com` find the same records and produce the same audit hash.

### Responding to a SAR (export)

Click **Export all (SAR)** (top-right, after a search) or per-source **Export**. The browser downloads a JSON file named `gdpr-export-YYYY-MM-DD-<hash8>.json` — the filename uses the first 8 hex chars of the HMAC hash so the subject's email never lands in your `~/Downloads/` folder or screen recordings.

The file content:

```json
{
  "schema": "kritano-gdpr-export-v1",
  "subject": "alice@example.com",
  "emailHash": "8f7c…",
  "exportedAt": "2026-05-14T13:41:50.282Z",
  "exportedBy": "uuid-of-admin-user",
  "searchLogId": "uuid-of-search-log-row",
  "totalRecords": 3,
  "sources": [
    {
      "source": "form:contact",
      "displayName": "Contact (form submission)",
      "records": [ /* full record(s) after excludeFields applied */ ]
    },
    /* ... */
  ]
}
```

This is suitable to attach directly to a SAR response email. The corresponding `gdpr_search_log` row has `exported = true`.

### Erasure (right to be forgotten)

Click **Delete** on a source, or **Delete all** at the top. A modal opens with:

- **Method** — locked to `hard_delete` in v1 (anonymisation arrives in v2).
- **Requested by** — radio: *Data subject* (use when responding to a subject's request) or *Admin discretion*.
- **Rationale** — free-text, minimum 10 characters, written to `gdpr_deletion_log.rationale`.
- **Email confirmation** — retype the email to enable the Delete button. Case-insensitive match.

On confirm, the page calls `POST /api/admin/gdpr/delete`. Each row in scope produces **one row** in `gdpr_deletion_log` with `status` = `success` / `failed` / `skipped`. Sources with zero matching records still get a `skipped` row, so the audit trail can prove you checked them.

**Per-source isolation:** if one source's delete fails (e.g. a foreign-key violation, a network issue inside an `onDelete` callback), the other sources still run. The result modal shows per-source counts so you can see exactly where partial state ended up.

### Audit trail

Every search and deletion writes a row to `gdpr_search_log` or `gdpr_deletion_log`. These tables are **never truncated and never purged** — they outlive the data they describe, which is the whole point.

The activity panel at the bottom of `/admin/gdpr` shows the last 50 entries. For long-range exports, query the tables directly:

```sql
-- All deletions for a given subject (use the hash you computed in code)
SELECT * FROM gdpr_deletion_log
 WHERE email_hash = '8f7c…'
 ORDER BY deleted_at DESC;

-- Every SAR response in the last 90 days
SELECT searched_at, result_count, reason
  FROM gdpr_search_log
 WHERE exported = true
   AND searched_at > now() - interval '90 days'
 ORDER BY searched_at DESC;
```

To compute the hash for a known email in TypeScript:

```typescript
import { hashEmailForAudit } from '@kritano/cms/gdpr'

const hash = hashEmailForAudit('alice@example.com')
// → '8f7c…64-hex-chars'
```

---

## API reference

All endpoints live under `/api/admin/gdpr/*` and require an authenticated admin session (`requireAuth + requirePermission('settings')`). Until `GDPR_AUDIT_SECRET` is set, every endpoint returns **503** with `{ error: 'gdpr_not_configured', message: '…' }`.

### `GET /api/admin/gdpr/sources`

Lists all registered sources.

```json
{
  "sources": [
    {
      "name": "form:contact",
      "displayName": "Contact (form submission)",
      "table": "form_submissions",
      "emailColumn": "email",
      "identifierColumn": "id",
      "createdAtColumn": "created_at",
      "retentionPolicyDays": null,
      "autoDiscovered": true
    }
  ]
}
```

### `POST /api/admin/gdpr/search`

```json
{ "email": "alice@example.com", "reason": "Ticket #043", "logAsSar": false, "sources": ["form:contact"] }
```

Returns:

```json
{
  "emailHash": "8f7c…",
  "results": [
    {
      "source": "form:contact",
      "displayName": "Contact (form submission)",
      "records": [
        {
          "id": "7c2a…",
          "identifier": "7c2a…",
          "summary": "Alice Q · hi",
          "createdAt": "2026-04-12T10:00:00.000Z",
          "data": { /* full row after excludeFields */ }
        }
      ]
    }
  ],
  "searchLogId": "uuid",
  "totalRecords": 1
}
```

### `POST /api/admin/gdpr/export`

```json
{ "email": "alice@example.com", "sources": ["form:contact"] }
```

Returns `200 application/json` with `Content-Disposition: attachment; filename="gdpr-export-…-….json"` and an `X-Gdpr-Search-Log-Id` header.

### `POST /api/admin/gdpr/delete`

```json
{
  "email": "alice@example.com",
  "method": "hard_delete",
  "rationale": "Subject requested deletion via privacy@example.com on 14 May 2026",
  "requestedBy": "subject",
  "sources": ["form:contact"]
}
```

Validation:

- `email` required, non-empty
- `rationale` required, ≥ 10 chars
- `method` ∈ `['hard_delete']` (v1)
- `requestedBy` ∈ `['subject', 'admin']`

Returns:

```json
{
  "results": [
    {
      "source": "form:contact",
      "displayName": "Contact (form submission)",
      "status": "success",
      "recordsAttempted": 1,
      "recordsDeleted": 1,
      "recordsFailed": 0,
      "deletionLogIds": ["uuid"]
    }
  ],
  "summary": { "totalAttempted": 1, "totalDeleted": 1, "totalFailed": 0, "totalSkipped": 0 }
}
```

### `GET /api/admin/gdpr/log/recent?limit=50`

Interleaved search + deletion log entries, ordered by timestamp DESC. `limit` is clamped to `[1, 200]`.

---

## `registerGdprSource()` reference

Full options:

```typescript
interface GdprSource {
  /** Unique identifier. Use a 'custom:' prefix to distinguish from auto-discovered. */
  name: string

  /** Human-readable label for the admin UI. */
  displayName?: string

  /** Database table to query. */
  table: string

  /** Column holding the email. */
  emailColumn: string

  /** Human-friendly reference column (e.g. 'audit_ref'). Shown alongside results. */
  identifierColumn?: string

  /** Column used by the v2 retention sweep. Default: 'created_at'. */
  createdAtColumn?: string

  /** Override the search query. Receives a normalised (lower, trim) email. */
  searchFn?: (email: string) => Promise<unknown[]>

  /**
   * Override the per-row DELETE. Receives the row as returned by searchFn.
   * Default: DELETE FROM "<table>" WHERE id = $1.
   */
  deleteFn?: (row: Record<string, unknown>) => Promise<void>

  /** Callback after row deletion. Best-effort — failures are logged but don't fail the row. */
  onDelete?: (row: Record<string, unknown>) => Promise<void>

  /** Columns to include in exports. Default: all columns. */
  fields?: string[]

  /** Columns to exclude from exports. Wins over `fields` on collision. */
  excludeFields?: string[]

  /** Retention in days. Honoured by the v2 retention sweep. */
  retentionPolicyDays?: number

  /** Extra WHERE clause for retention. Trusted developer input — never user-supplied. */
  retentionFilter?: string
}
```

### Common patterns

**Strip operational metadata from SAR exports:**

```typescript
registerGdprSource({
  name: 'custom:audit-submissions',
  table: 'audit_submissions',
  emailColumn: 'email',
  excludeFields: ['ip_address', 'user_agent', 'browser_fingerprint'],
})
```

**Whitelist exactly which columns are visible:**

```typescript
registerGdprSource({
  name: 'custom:newsletter',
  table: 'newsletter_subscribers',
  emailColumn: 'email',
  fields: ['id', 'email', 'subscribed_at', 'preferences'],   // nothing else is exported
})
```

**Clean up files when a row is deleted:**

```typescript
registerGdprSource({
  name: 'custom:invoices',
  table: 'invoices',
  emailColumn: 'customer_email',
  onDelete: async (row) => {
    if (row.pdf_path) {
      const { unlink } = await import('node:fs/promises')
      await unlink(row.pdf_path as string).catch(() => {})
    }
  },
})
```

**Custom search logic (e.g. JSONB lookup):**

```typescript
import { getClient } from '@kritano/cms/core'

registerGdprSource({
  name: 'custom:audit-trail',
  table: 'audit_trail',
  emailColumn: 'subject_email',
  searchFn: async (email) => {
    const sql = getClient()
    return await sql.unsafe(
      `SELECT * FROM audit_trail
        WHERE payload->>'email' = $1
           OR payload->>'cc_email' = $1`,
      [email],
    )
  },
})
```

---

## Why not a new field type

The `email()` builder produces `{ type: 'text', format: 'email' }`, not a new `'email'` field type. Adding a new top-level `FieldType` would require touching the dozen exhaustive switches across the codebase (DB schema generator, search indexer, GraphQL builder, admin field renderer, validation layer). Treating it as a `text` field with a format marker means:

- The database column stays `text`.
- Every existing path that switches on `field.type === 'text'` keeps working.
- The GDPR registry checks `field.format === 'email'` to identify the column.

You can also pick up emails via the name heuristic on plain `text()` fields, so you don't *have* to migrate every collection — but explicit `email()` is preferred.

---

## What's not in v1

These arrive in v2 (see `gdpr.md` at the repo root for the full plan):

- **Anonymisation** (`onAnonymise` callback + method toggle in the deletion modal) — for records you must retain (HMRC, accounting) but want to scrub PII from.
- **Retention sweep** — scheduled job that auto-deletes rows past `retentionPolicyDays`, with full audit logging.
- **Privacy notice versioning** — immutable snapshots of `/privacy` content, with each submission recording the active version.

And in v3:

- Role-based GDPR permissions (a dedicated `gdpr` permission rather than reusing `settings`).
- Rectification UI.
- Regulator audit-report export (PDF summary over a date range).

---

## Operational notes

### Backups still hold personal data

Deletion only affects the live database. Whatever backup policy you have will retain the deleted record until the backup rolls off. Two reasonable approaches:

- Document your backup retention window (e.g. "backups retained 30 days") in your privacy policy. Subjects' data is effectively erased once it ages out.
- Or, honour deletions in backups too — replay deletion-log entries against restored backups before reuse. More complex; only worth it if your retention is long.

### Single-admin compatibility

The v1 GDPR endpoints gate on `requirePermission('settings')`, the same permission used for API keys and site settings. Any user with `settings` access can see all PII and trigger deletions. v3 introduces a dedicated `gdpr` permission — until then, audit the `settings` role membership.

### Audit-log forensics

The two log tables (`gdpr_deletion_log`, `gdpr_search_log`) are designed to be queried directly when you need to demonstrate compliance:

```sql
-- "Show me every deletion in the last quarter, with who did it"
SELECT d.deleted_at, d.source, d.status, d.rationale, u.email AS admin_email
  FROM gdpr_deletion_log d
  LEFT JOIN users u ON u.id = d.deleted_by_user_id
 WHERE d.deleted_at > now() - interval '90 days'
 ORDER BY d.deleted_at DESC;

-- "How quickly do we respond to SARs?" (search-to-export latency)
SELECT searched_at, exported, result_count, reason
  FROM gdpr_search_log
 WHERE searched_at > now() - interval '90 days';
```
