# Kritano CMS — GDPR / Data Subject Rights Tooling

A feature specification for first-class GDPR compliance support inside the Kritano admin. This is a generic feature for all Kritano consumers, not a chrisgarlick.com-specific bolt-on.

*Specification compiled May 2026. Intended as the implementation reference for the Kritano CMS maintainer.*

---

## Why every Kritano CMS instance needs this

Any Kritano consumer using `addForm()` or collections to capture personal data (name, email, company details, etc.) inherits GDPR obligations under UK GDPR and EU GDPR. The current Kritano admin gives them:

- A `form_submissions` table that holds submissions (visible via the still-pending Forms submissions tab — issue #13)
- No way to look up "what data do we hold for this person?"
- No way to action a Subject Access Request beyond manual SQL
- No way to action a Right to Erasure beyond manual SQL
- No deletion audit trail
- No SAR audit trail
- No retention sweep

For consumers handling personal data, this gap forces them to either build bespoke tooling (which they often skip) or fall back to direct DB access (error-prone and unauditable). Every Kritano deployment processing personal data has the same compliance need; the cleanest home is Kritano itself.

This spec describes a feature that:

1. **Auto-discovers** personal-data sources from declared forms and collections — zero configuration for the common case.
2. **Allows custom registration** of consumer-specific tables outside the standard Kritano schema (e.g. lead-state tables, audit submissions, custom workflow records).
3. **Provides an admin page** at `/admin/gdpr` for the four operations consumers actually perform: lookup, export (SAR), delete (erasure), and review of past actions.
4. **Logs every operation** to permanent audit tables that survive deletion of the underlying data, so the regulator can be shown a history.
5. **Supports a retention sweeper** that auto-deletes records past their declared retention window, with full logging.

The feature targets the 80% of GDPR compliance work a small business actually has to do. Roles, multi-tenancy, and advanced rectification flows are explicitly out of v1 scope.

---

## Architecture overview

```
┌─────────────────────────────────────────────────────────────────────┐
│ /admin/gdpr  (new admin page)                                        │
│   • Email lookup → grouped results across all sources                │
│   • Per-source actions: view JSON, export, delete                    │
│   • Top-level: "Export everything" (SAR), "Delete everything" (RtE) │
│   • Recent activity log (last 50 actions)                            │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Kritano core GDPR module (new package: @kritano/cms-gdpr            │
│ or new subpath: @kritano/cms/gdpr)                                   │
│                                                                       │
│   • Source registry — auto-discovers forms/collections, accepts      │
│     custom registrations via registerGdprSource()                    │
│   • Search engine — runs WHERE-by-email queries across sources       │
│   • Delete engine — hard delete or anonymise, with callbacks         │
│   • Audit logger — writes gdpr_deletion_log + gdpr_search_log        │
│   • Retention sweeper — daily scan, deletes past-retention records   │
└──────────────────────────────┬──────────────────────────────────────┘
                               │
                               ▼
┌─────────────────────────────────────────────────────────────────────┐
│ Sources                                                              │
│   • All forms declared via addForm()         (auto-discovered)       │
│   • All collections with email-typed fields  (auto-discovered)       │
│   • Custom-registered tables                 (via registerGdprSource)│
└─────────────────────────────────────────────────────────────────────┘
```

---

## Database schema

Two new tables, neither ever purged:

```sql
-- Every deletion logged permanently. Survives the data it describes.
CREATE TABLE gdpr_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,                    -- sha256(lowercase email) — proves "we held data for this subject" without storing the email itself
  source text NOT NULL,                        -- e.g. 'form:contact' | 'collection:article' | 'custom:audit-submissions'
  source_record_id text,                       -- the deleted record's primary key (as text)
  source_display_name text,                    -- human-readable, e.g. 'Contact form submission'
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_by text NOT NULL,                  -- 'subject' (data subject requested) | 'retention' (auto-purge) | 'admin' (admin discretion)
  deletion_method text NOT NULL,               -- 'hard_delete' | 'anonymised'
  fields_deleted text[],                       -- column names that were wiped
  rationale text,                              -- optional free-text note ("user requested via /privacy/delete link, 14 May 2026")
  retention_snapshot jsonb                     -- snapshot of selected metadata (NOT PII) for the audit trail
);
CREATE INDEX gdpr_deletion_log_email_hash_idx ON gdpr_deletion_log (email_hash);
CREATE INDEX gdpr_deletion_log_deleted_at_idx ON gdpr_deletion_log (deleted_at);

-- Every search logged permanently. Demonstrates SAR responsiveness.
CREATE TABLE gdpr_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now(),
  searched_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  result_count integer NOT NULL,
  exported boolean NOT NULL DEFAULT false,    -- did the admin export this search as a SAR response?
  reason text                                  -- optional, e.g. 'SAR received via privacy@example.com, ticket #043'
);
CREATE INDEX gdpr_search_log_email_hash_idx ON gdpr_search_log (email_hash);
```

**Why hash the email and not store it:** the deletion log itself must not retain personal data after the underlying data is gone, otherwise we've just moved the data. SHA-256 of lowercase email gives us a deterministic identifier — we can prove that a record corresponding to a given email was deleted (by hashing the email and matching), without holding the email itself indefinitely.

---

## Source registry

A "source" is any table that holds personal data keyed by email. The registry is in-memory at server boot, populated from three places:

### 1. Forms (auto-discovered)

Every form declared via `addForm()` is auto-registered as a source. The system locates the email field by inspecting the form's declared schema:

```ts
addForm('contact', {
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },  // ← detected as the email field
    { name: 'name',  type: 'text',  label: 'Name' },
    { name: 'message', type: 'textarea', label: 'Message' },
  ],
})
// Becomes registered as:
// {
//   name: 'form:contact',
//   table: 'form_submissions',
//   searchFn: (email) => sql`SELECT s.* FROM form_submissions s
//                            JOIN forms f ON s.form_id = f.id
//                            WHERE f.slug = 'contact' AND s.data->>'email' = ${email}`,
//   displayName: 'Contact form submission',
// }
```

If a form has multiple email-typed fields, the first one wins. If a form has no email-typed field, it's not auto-registered (and admins can add it manually via `registerGdprSource` if needed).

### 2. Collections (auto-discovered)

Every collection defined via `defineCollection()` is scanned for email-typed fields:

```ts
defineCollection('subscriber', {
  fields: {
    email: email().required(),     // ← detected
    name: text(),
    consentedAt: datetime(),
  },
})
// Auto-registers a source matching this collection
```

If `email()` (a hypothetical new field type) doesn't exist yet in Kritano, the heuristic falls back to: any `text()` or `text().required()` field whose `name` matches `/^email|.+_email|.+Email$/`. Adding an explicit `email()` field type is recommended for v1.

### 3. Custom registrations

Tables outside the Kritano schema (consumer-managed tables for state, lead pipelines, audit submissions, etc.) register imperatively in `cms.config.ts` or at server boot:

```ts
import { registerGdprSource } from '@kritano/cms/gdpr'

registerGdprSource({
  name: 'audit-submissions',
  displayName: 'AI readiness audit submission',
  table: 'audit_submissions',
  emailColumn: 'email',
  identifierColumn: 'audit_ref',          // shown in the admin UI as the human-readable ID
  retentionPolicyDays: 730,                // 24-month retention; sweep auto-deletes past this
  // Optional: do work outside the DB on deletion (e.g. remove generated files)
  onDelete: async (row) => {
    if (row.pdf_path) await fs.unlink(row.pdf_path).catch(() => {})
  },
  // Optional: provide an anonymised version of the row instead of deleting it
  // (useful for financial records that must be retained for HMRC purposes)
  onAnonymise: async (row) => ({
    ...row,
    email: 'redacted@gdpr.local',
    data: { ...row.data, name: 'REDACTED', companyName: row.data.companyName },
  }),
  // Optional: limit which columns appear in SAR exports (default: all)
  excludeFields: ['ip_address', 'user_agent'],   // exclude operational metadata from SAR
})
```

### Registration API (proposed)

```ts
// @kritano/cms/gdpr — public types

export interface GdprSource {
  /** Unique identifier — used in the audit log and the admin UI. Use a 'custom:' prefix for clarity. */
  name: string
  /** Human-readable label for the admin UI. */
  displayName?: string
  /** Database table name to query. */
  table: string
  /** Column holding the email (for the WHERE clause). */
  emailColumn: string
  /** Optional human-friendly identifier column. Shown in the admin UI alongside results. */
  identifierColumn?: string
  /** Optional override for the search query. Receives a normalised (lowercase, trimmed) email. */
  searchFn?: (email: string) => Promise<unknown[]>
  /** Optional callback after row deletion (e.g. delete an associated file). */
  onDelete?: (row: any) => Promise<void>
  /** Optional anonymisation path. Returns the anonymised row; the engine UPDATEs the row in place. */
  onAnonymise?: (row: any) => Promise<Record<string, unknown>>
  /** Columns to include in SAR exports. Default: all. */
  fields?: string[]
  /** Columns to exclude from SAR exports (overrides `fields`). Use for operational metadata. */
  excludeFields?: string[]
  /** Days to retain. If set, the retention sweep deletes rows older than this. */
  retentionPolicyDays?: number
  /** Optional WHERE clause additions for retention (e.g. only sweep records where status != 'sent'). */
  retentionFilter?: string
}

export function registerGdprSource(source: GdprSource): void
export function getRegisteredSources(): GdprSource[]
```

---

## Admin UI

A new admin route at `/admin/gdpr`. Single-page React component in `packages/admin`.

### Layout

```
─────────────────────────────────────────────────────────────────
 GDPR / Data Subject Rights

 Look up by email
 ┌──────────────────────────────────┐  ┌──────────┐
 │ alice@example.com                │  │  Search  │
 └──────────────────────────────────┘  └──────────┘

 [×] Log this search as a SAR response   Reason: ┌─────────────┐
                                                 │ Ticket #043 │
                                                 └─────────────┘
─────────────────────────────────────────────────────────────────
 Results — 3 records across 2 sources for alice@example.com
 (Searched 14 May 2026 14:23 by chris@chrisgarlick.com)

 ┌─ form:contact (1 record) ───────────────────────────────────┐
 │   Contact form submission · 12 Apr 2026                     │
 │   ID: 7c2a... · email: alice@example.com                    │
 │   ▸ View record    ▸ Export    ▸ Delete                     │
 └──────────────────────────────────────────────────────────────┘

 ┌─ custom:audit-submissions (2 records) ──────────────────────┐
 │   CG-2026-031 · 03 May 2026 · status: sent                  │
 │   ▸ View record    ▸ Export    ▸ Delete                     │
 │                                                              │
 │   CG-2026-047 · 12 May 2026 · status: pending_review        │
 │   ▸ View record    ▸ Export    ▸ Delete                     │
 └──────────────────────────────────────────────────────────────┘

 ─────────────────────────────────────────────────────────────────
  ▸ Export all (SAR)        ▸ Delete all (Right to Erasure)
─────────────────────────────────────────────────────────────────
```

### Top-level actions

- **Export all** — produces a single JSON blob containing all records from all sources for the searched email. Suitable to send directly as a SAR response. Sets `gdpr_search_log.exported = true`.
- **Delete all** — opens a confirmation modal (see below). Iterates every record across every source, deletes (or anonymises per the source's policy), logs each to `gdpr_deletion_log`.

### Deletion confirmation modal

Mandatory friction to prevent accidental deletion:

```
─────────────────────────────────────────────────────────────────
 Delete all data for alice@example.com?

 You are about to delete 3 records across 2 sources. This cannot
 be undone.

 Method: ( ) Hard delete (default — irreversibly remove all data)
         ( ) Anonymise where supported (replace PII with placeholders,
              retain row for records that need it)

 Rationale (required for the audit log):
 ┌───────────────────────────────────────────────────┐
 │ Subject requested deletion via privacy@example.com │
 └───────────────────────────────────────────────────┘

 To confirm, type the email address below:
 ┌──────────────────────────────────┐
 │ alice@example.com                │
 └──────────────────────────────────┘

         [ Cancel ]                  [ Delete all 3 records ]
─────────────────────────────────────────────────────────────────
```

Rationale must be ≥ 10 characters. Email confirmation must match exactly (no copy-paste guard). On confirm, the engine deletes each record, writes a `gdpr_deletion_log` row per source, returns a summary.

### Recent activity

Bottom-of-page list of the last 50 entries from `gdpr_search_log` and `gdpr_deletion_log`, interleaved by timestamp. Each entry shows: action, email-hash (truncated to 8 chars for visual reference), source(s), admin user, optional rationale.

---

## API endpoints

Authenticated as the admin user. Returns JSON.

```
POST   /admin/api/gdpr/search
       Body: { email: string, reason?: string, logAsSar?: boolean }
       Returns: { emailHash, results: SearchResult[], searchLogId }

POST   /admin/api/gdpr/export
       Body: { email: string, sources?: string[] }    // optional source filter
       Returns: 200 application/json (downloadable file)

POST   /admin/api/gdpr/delete
       Body: { email: string, sources?: string[], method: 'hard_delete'|'anonymised', rationale: string }
       Returns: { deletedCount, deletionLogIds: string[] }

GET    /admin/api/gdpr/log/recent?limit=50
       Returns: { entries: AuditLogEntry[] }

GET    /admin/api/gdpr/sources
       Returns: { sources: { name, displayName, table, autoDiscovered, retentionPolicyDays }[] }
```

Where `SearchResult` is:
```ts
interface SearchResult {
  source: string                    // e.g. 'form:contact'
  displayName: string
  records: Array<{
    id: string                       // primary key
    identifier?: string              // human-friendly ref (e.g. audit_ref)
    summary: string                  // 2–3 most-relevant field values joined
    createdAt?: string               // if the source has a created_at column
    data: Record<string, unknown>    // full record (after excludeFields applied)
  }>
}
```

---

## Retention sweep

A scheduled background task (cron-style, daily) that iterates every registered source with a `retentionPolicyDays` value and:

1. Queries records older than the retention window.
2. For each, calls the source's `onDelete` (or `onAnonymise`).
3. Deletes (or anonymises) the row.
4. Writes a `gdpr_deletion_log` entry with `requestedBy: 'retention'`.

```ts
// Example pseudo-code for the sweeper
for (const source of getRegisteredSources()) {
  if (!source.retentionPolicyDays) continue

  const cutoff = new Date(Date.now() - source.retentionPolicyDays * 86400_000)
  const expired = await sql.unsafe(`
    SELECT * FROM ${source.table}
    WHERE created_at < $1
    ${source.retentionFilter ? `AND ${source.retentionFilter}` : ''}
  `, [cutoff])

  for (const row of expired) {
    await deleteRecord(source, row, { requestedBy: 'retention', rationale: 'Retention sweep' })
  }
}
```

Scheduling can be done via:
- A simple `setInterval` loop in `server.ts` running daily (sufficient for single-instance deployments).
- Or an external cron (`crontab`) calling a CLI command — `cms gdpr:sweep`.

For v1, the `setInterval` approach is simpler and covers the typical single-server Kritano deployment.

---

## Privacy notice support (optional v2)

Most consumers will also need to display and version a privacy notice. The current Kritano admin lets you write a `/privacy` page via the `page` collection, which is sufficient. The optional v2 extension:

- A `gdpr_privacy_notice_versions` table that stores immutable snapshots.
- A field on every personal-data submission that records the active version at the time of submission.
- An admin view in `/admin/gdpr/notice` that creates a new version, freezes the previous one, and shows which submissions are under which version.

Out of v1 scope. Consumers can roll this themselves until needed broadly.

---

## Implementation phases

### v1 — Core feature (target: 2–3 weeks)

- [ ] Migrations for `gdpr_deletion_log` and `gdpr_search_log` tables
- [ ] Add an `email()` field type (or formalise the email detection heuristic for `text` fields)
- [ ] `registerGdprSource()` public API + in-memory registry
- [ ] Auto-discovery of all forms declared via `addForm()`
- [ ] Auto-discovery of all collections with email-typed fields
- [ ] Five admin API endpoints (search, export, delete, log, sources)
- [ ] Admin SPA page at `/admin/gdpr` with the layout above
- [ ] Hard-delete path (no anonymisation yet)
- [ ] Documentation update — getting-started.md and a new `gdpr.md` doc

### v2 — Anonymisation + retention + privacy notice (target: 1–2 weeks after v1)

- [ ] `onAnonymise` callback support in `registerGdprSource`
- [ ] "Method" toggle in deletion modal
- [ ] Retention sweep scheduled task
- [ ] CLI command `cms gdpr:sweep` for manual runs
- [ ] Privacy notice versioning tables + admin view

### v3 — Advanced (later)

- [ ] Role-based permissions (separate GDPR-admin role)
- [ ] Right-to-restriction support (mark records, exclude from processing)
- [ ] Rectification UI (edit records inline with audit log)
- [ ] Regulator audit-report export (PDF summary of deletions + SARs over a date range)
- [ ] Webhook notifications on every deletion (for consumers integrating with downstream systems)
- [ ] Bulk lookup (CSV upload of emails for due-diligence sweeps)

---

## Consumer integration example

A consumer site adding the audit-submissions table (this is the chrisgarlick.com use case, included for context — *not* the spec).

**`cms.config.ts`:**

```ts
import { defineConfig, addForm } from '@kritano/cms/core'
import { registerGdprSource } from '@kritano/cms/gdpr'

// 1. Declare the form (auto-registered as a GDPR source)
addForm('audit-intake', {
  fields: [
    { name: 'email', type: 'email', label: 'Email', required: true },
    { name: 'name',  type: 'text',  label: 'Your name', required: true },
    { name: 'companyName', type: 'text', label: 'Company name', required: true },
    // ...
  ],
})

// 2. Register the custom audit-submissions table
registerGdprSource({
  name: 'audit-submissions',
  displayName: 'AI readiness audit submission',
  table: 'audit_submissions',
  emailColumn: 'email',
  identifierColumn: 'audit_ref',
  retentionPolicyDays: 730,
  retentionFilter: "status != 'sent'",   // sweep abandoned/not-sent only; converted clients retained 7y
  onDelete: async (row) => {
    if (row.pdf_path) await fs.unlink(row.pdf_path).catch(() => {})
  },
  excludeFields: ['ip_address', 'user_agent'],
})

export default defineConfig({ ... })
```

**That's it.** From the consumer's perspective:

- `/admin/gdpr` immediately works for both the auto-discovered form and the custom-registered table.
- SAR queries return data from both sources in one place.
- Deletion handles both, including removing the PDF file.
- The retention sweep auto-purges old audit submissions.
- Every operation is logged.

No bespoke admin tooling, no manual SQL runbooks, no fragile consumer-specific code.

---

## Open design questions for the maintainer

1. **Package boundary** — should this ship as `@kritano/cms/gdpr` (subpath of the main package) or as a separate optional `@kritano/cms-gdpr` plugin? Subpath is simpler; plugin is cleaner for consumers who don't process personal data and don't want the tables created.

2. **Email field detection** — adding an explicit `email()` field builder is the cleanest signal. The heuristic on `text()` field names is a fallback but might miss fields named `contact_address` or similar non-obvious cases.

3. **Multi-tenant deployments** — if Kritano ever supports multi-tenant CMS-as-a-service, the audit logs need a `tenant_id` column. Out of v1 scope; design v1 to be easily extended.

4. **Soft-delete option** — for some consumers, hard delete is the wrong default and a soft-delete grace period (e.g. 30 days, recoverable) is preferred. Worth adding as a third method alongside `hard_delete` and `anonymised`?

5. **PDF/file orphan cleanup** — the `onDelete` callback handles consumer-managed files (like the audit PDF). But what about media uploaded via Kritano's own media library? If a contact form attaches an image, deleting the submission should also delete the media file. Worth a follow-up doc to spec how media references are tracked.

6. **Backups** — deletion only affects the live database. Backups (which most consumers run) will retain personal data until they roll off. Consumers should be advised to either honour deletions in backups too (complex) or have a documented retention policy on backups (simpler). This is a docs concern, not a feature.

---

## Why this belongs in Kritano, not in every consumer site

Every Kritano consumer who collects personal data faces the same compliance need. Without a standard implementation:

- Each consumer reinvents the wheel (poorly, in most cases) or skips compliance entirely.
- Bug fixes and regulatory updates have to happen across N different consumer sites.
- The compliance posture of "a site built on Kritano" is unpredictable — sometimes great, sometimes nonexistent.
- The Kritano value proposition weakens — consumers either choose another CMS that has this, or build bespoke tooling that wouldn't have been needed.

Shipping this once, in the upstream, means every Kritano deployment past v2.x is GDPR-compliant out of the box for the operations that actually matter (lookup, export, delete, log, retention). That's a strong differentiator versus other open-source headless CMSes, most of which leave this to consumers entirely.

---

*Specification compiled for the Kritano CMS maintainer by Claude — May 2026.*

---

## v1 implementation plan (added 2026-05-14)

Concrete plan to build the v1 surface against the current `kritano-cms` codebase. Reflects the design-review changes agreed on top of the v1 checklist at line 399.

### Design deltas from the v1 list above

| # | Spec said | v1 will do | Why |
|---|-----------|-----------|-----|
| 1 | `sha256(lower(email))` for audit hash | `hmac_sha256(GDPR_AUDIT_SECRET, lower(trim(email)))` | Raw SHA-256 of an email is trivially brute-forced; HMAC with an out-of-DB secret defends against a DB-dump rainbow attack. |
| 2 | Retention sweep in v1 | **Defer to v2** | `setInterval` is the wrong tool, BullMQ integration is more work than v1 should carry, and Phase 0.1 explicitly excludes scheduled jobs. v1 ships search/export/delete only. |
| 3 | `created_at` hard-coded in retention SQL | n/a in v1 (deferred), but `GdprSource` gets `createdAtColumn?: string` (default `'created_at'`) now so v2 can use it. | Custom tables may use `submitted_at`, `inserted_at`, etc. |
| 4 | No normalisation contract | Single `normaliseEmail(input): string` helper in `@kritano/cms/gdpr`, used for writes, searches, and hashing. | Otherwise SAR lookups silently miss records when case/whitespace differs. |
| 5 | Multi-table delete-all atomicity unspecified | Per-source try/catch; partial-success summary returned to UI; every attempt (success or failure) writes to `gdpr_deletion_log` with a `status` column. | Filesystem `onDelete` side-effects can't be rolled back; document and surface partial state instead of pretending it's atomic. |
| 6 | Package boundary open question | **Ship as `@kritano/cms/gdpr` subpath**, not a plugin. | Plugin system is a v0.3 feature per the roadmap; subpath is simpler and consistent with `@kritano/cms/core` etc. |
| 7 | API path `/admin/api/gdpr/*` | **Correct to `/api/admin/gdpr/*`** to match the existing convention (`/api/admin/api-keys`, `/api/admin/rebuild`, etc. — see `packages/core/src/api/router.ts:70`). | Consistency with existing routes. |
| 8 | "Single admin" assumption | Use the existing `requireAuth` + `requirePermission('settings')` middleware (already used by `api-keys.ts`). Add a new `'gdpr'` permission for v2 when roles become real. | The roles system already partially exists; don't bypass it. |

### Where things live in the codebase

| Concern | File |
|---|---|
| Form declaration + registry | `packages/core/src/schema/addForm.ts` — `getDeclaredForms()` is already exported |
| Form sync to DB | `packages/core/src/lib/form-sync.ts` |
| Form submissions table | declared via Drizzle in `packages/core/src/db/` |
| Collection DSL + field types | `packages/core/src/schema/defineCollection.ts`, `packages/core/src/schema/fields/*` |
| Migration generator | `packages/core/src/db/migration-generator.ts` |
| API router (registers route files) | `packages/core/src/api/router.ts` |
| Admin API route pattern | `packages/core/src/api/routes/*.ts` |
| Admin SPA router | `packages/admin/src/router.tsx` |
| Admin pages | `packages/admin/src/pages/*.tsx` |
| Auth middleware | `requireAuth`, `requirePermission(name)` — used in `api-keys.ts` |

### File-by-file work

**New files (all under `packages/core/src/gdpr/`, exported via `@kritano/cms/gdpr`):**

```
packages/core/src/gdpr/
├── index.ts              # public exports — registerGdprSource, normaliseEmail, hashEmailForAudit, types
├── registry.ts           # in-memory source registry; auto-discovery from forms + collections
├── normalise.ts          # normaliseEmail(input) and hashEmailForAudit(email)
├── search.ts             # runSearch(email): aggregates across sources
├── delete.ts             # runDelete(email, opts): per-source try/catch, writes audit log
├── audit.ts              # writeDeletionLog, writeSearchLog
├── types.ts              # GdprSource, SearchResult, DeletionResult, AuditLogEntry
└── __tests__/
    ├── normalise.test.ts
    ├── registry.test.ts
    └── delete.test.ts
```

**Modify:**

| File | Change |
|---|---|
| `package.json` (root) | Add `"./gdpr": "./packages/core/src/gdpr/index.ts"` to `exports` |
| `packages/core/src/index.ts` | Re-export GDPR types for convenience (optional) |
| `packages/core/src/schema/fields/index.ts` | Add `email()` field builder (alias for `text()` with `format: 'email'` metadata so registry can detect it) |
| `packages/core/src/api/router.ts` | Register `gdprRoutes` from a new `packages/core/src/api/routes/gdpr.ts` |
| `packages/core/src/api/routes/gdpr.ts` (new) | Five endpoints (see below), all behind `requireAuth + requirePermission('settings')` |
| `packages/core/src/db/migrations/<timestamp>_gdpr.sql` (new) | Two tables (final SQL below) |
| `packages/admin/src/router.tsx` | Add `/admin/gdpr` route |
| `packages/admin/src/pages/Gdpr.tsx` (new) | The page from the spec layout |
| `packages/admin/src/pages/Dashboard.tsx` or sidebar nav | Add "GDPR" link |
| `.env.example` | Add `GDPR_AUDIT_SECRET=` (with a note: random ≥32 char string, **never rotate or all audit-hash continuity is lost**) |
| `docs/gdpr.md` (new) | Consumer-facing doc — `registerGdprSource()` usage, SAR/erasure workflow |
| `docs/getting-started.md` | One paragraph + link to `docs/gdpr.md` |
| `CLAUDE.md` | Add GDPR module to the architecture table |

### Migration SQL (final)

```sql
CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE gdpr_deletion_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,                       -- hmac_sha256(GDPR_AUDIT_SECRET, normalised_email) — see normalise.ts
  source text NOT NULL,
  source_record_id text,
  source_display_name text,
  deleted_at timestamptz NOT NULL DEFAULT now(),
  deleted_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  requested_by text NOT NULL CHECK (requested_by IN ('subject','retention','admin')),
  deletion_method text NOT NULL CHECK (deletion_method IN ('hard_delete','anonymised')),
  status text NOT NULL DEFAULT 'success' CHECK (status IN ('success','failed','skipped')),
  failure_reason text,                            -- populated when status = 'failed'
  fields_deleted text[],
  rationale text,
  retention_snapshot jsonb
);
CREATE INDEX gdpr_deletion_log_email_hash_idx ON gdpr_deletion_log (email_hash);
CREATE INDEX gdpr_deletion_log_deleted_at_idx ON gdpr_deletion_log (deleted_at);

CREATE TABLE gdpr_search_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email_hash text NOT NULL,
  searched_at timestamptz NOT NULL DEFAULT now(),
  searched_by_user_id uuid REFERENCES users(id) ON DELETE SET NULL,
  result_count integer NOT NULL,
  exported boolean NOT NULL DEFAULT false,
  reason text
);
CREATE INDEX gdpr_search_log_email_hash_idx ON gdpr_search_log (email_hash);
```

Changes from the original schema: added `pgcrypto` extension; added `status` + `failure_reason` to deletion log (for non-atomic partial-success reporting); added CHECK constraints on enum-like columns.

### API endpoints (final paths)

All under `/api/admin/gdpr/*`, all require `requireAuth` + `requirePermission('settings')`:

```
POST   /api/admin/gdpr/search       { email, reason?, logAsSar? } → { emailHash, results, searchLogId }
POST   /api/admin/gdpr/export       { email, sources? }            → 200 application/json (download)
POST   /api/admin/gdpr/delete       { email, sources?, method, rationale } → { results: PerSourceResult[], summary }
GET    /api/admin/gdpr/log/recent?limit=50 → { entries }
GET    /api/admin/gdpr/sources      → { sources }
```

### Public API surface (`@kritano/cms/gdpr`)

```ts
export function registerGdprSource(source: GdprSource): void
export function getRegisteredSources(): GdprSource[]
export function normaliseEmail(input: string): string         // lower, trim
export function hashEmailForAudit(email: string): string      // HMAC, requires GDPR_AUDIT_SECRET
export interface GdprSource {
  name: string
  displayName?: string
  table: string
  emailColumn: string
  identifierColumn?: string
  createdAtColumn?: string                                    // default 'created_at' (used by v2 sweep)
  searchFn?: (email: string) => Promise<unknown[]>
  onDelete?: (row: any) => Promise<void>
  fields?: string[]
  excludeFields?: string[]
  retentionPolicyDays?: number                                // honoured in v2
  retentionFilter?: string                                    // honoured in v2; documented as trusted dev input only
}
// onAnonymise deferred to v2
```

### Ordered work checklist

Each step is independently shippable (server still boots after each).

1. **Foundations** — `normalise.ts`, `audit.ts`, `types.ts`, migration, env var. No behaviour yet; just the plumbing. Server starts cleanly with empty tables.
2. **Registry + auto-discovery** — `registry.ts`, `email()` field builder, auto-register all `getDeclaredForms()` results at server boot, auto-register collections containing `email()` fields. Add `GET /api/admin/gdpr/sources` so we can verify in a browser.
3. **Search path** — `search.ts` + `POST /api/admin/gdpr/search` + `GET /api/admin/gdpr/log/recent`. Write `gdpr_search_log` entry on every call. Manually testable via curl/admin SPA stub.
4. **Delete path** — `delete.ts` + `POST /api/admin/gdpr/delete`. Per-source try/catch, every attempt writes to `gdpr_deletion_log` with `status` = success/failed/skipped. Returns summary.
5. **Export path** — `POST /api/admin/gdpr/export` returns a JSON file download.
6. **Admin UI** — `packages/admin/src/pages/Gdpr.tsx` with the layout from the spec, plus sidebar nav and route registration. Rebuild + commit `packages/admin/dist/` (per the pre-built admin policy in CLAUDE.md).
7. **Docs** — `docs/gdpr.md`, update `getting-started.md` and `CLAUDE.md`, add `GDPR_AUDIT_SECRET` to `.env.example`.

### Acceptance criteria (v1)

- [ ] Fresh install: `GDPR_AUDIT_SECRET` missing → server boots with a clear warning and `/api/admin/gdpr/*` returns 503 with a setup hint. Other CMS features unaffected.
- [ ] `addForm()` form with an `email` field is auto-listed in `GET /api/admin/gdpr/sources`.
- [ ] Collection with an `email()` field is auto-listed.
- [ ] `registerGdprSource()` call from `cms.config.ts` appears in `GET /api/admin/gdpr/sources`.
- [ ] Search for `Alice@Example.com `, ` alice@example.com`, and `alice@example.com` all return the same results and produce identical `email_hash` values in `gdpr_search_log`.
- [ ] Delete-all with one failing source returns `{ results: [...success, ...failed], summary }` and writes both success and failed rows to `gdpr_deletion_log`.
- [ ] Deleting subject data does not leak plaintext email into `gdpr_deletion_log` (verified by `SELECT * FROM gdpr_deletion_log` post-delete).
- [ ] Admin page `/admin/gdpr` renders, search → results → delete-with-confirmation flow works end-to-end.
- [ ] Tests in `packages/core/src/gdpr/__tests__/` cover: normalisation idempotence, HMAC determinism, registry auto-discovery, per-source delete failure isolation.
- [ ] `docs/gdpr.md` exists with the consumer integration example from this spec, working against the real API.

### Out of scope for v1 (explicit reminder)

- Anonymisation / `onAnonymise` callback
- Retention sweep (any form — `setInterval`, BullMQ, CLI)
- Privacy notice versioning
- Role-based GDPR permissions (uses `'settings'` permission until then)
- Rectification UI
- Media-library reference cleanup
- Backups handling
- CSV/PDF export formats (JSON only)

### Estimated effort

10–14 days of focused work. The admin UI is the largest single piece (~4 days). The backend module is ~5 days. Tests, docs, and acceptance verification are the rest.
