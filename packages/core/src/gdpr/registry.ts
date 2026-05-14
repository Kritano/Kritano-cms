import type { CmsConfig, FieldDefinition, TextFieldOptions } from '@kritano/cms/types'
import { getDeclaredForms } from '../schema/addForm'
import { collectionToTableName, fieldToColumnName } from '../db/schema-generator'
import { getClient } from '../db/client'
import { normaliseEmail } from './normalise'
import type { GdprSource } from './types'

const sources = new Map<string, GdprSource>()

/**
 * Register a custom GDPR source. Idempotent on `name` — re-registering the
 * same name overwrites (useful for hot-reload / tests).
 *
 * Call from `cms.config.ts` for tables outside the standard Kritano schema
 * (consumer-managed lead pipelines, audit submissions, etc.). Forms declared
 * via `addForm()` and collections containing email fields are auto-registered
 * at server boot via `initGdpr()`.
 */
export function registerGdprSource(source: GdprSource): void {
  sources.set(source.name, { ...source, autoDiscovered: source.autoDiscovered ?? false })
}

export function getRegisteredSources(): GdprSource[] {
  return Array.from(sources.values())
}

export function getGdprSource(name: string): GdprSource | undefined {
  return sources.get(name)
}

/** Test helper. Not part of the public API surface. */
export function clearGdprSources(): void {
  sources.clear()
}

/**
 * Heuristic match for field/column names that look like they hold an email.
 * Conservative on purpose — false positives would expose non-PII columns
 * as GDPR sources.
 */
const EMAIL_NAME_RE = /^email$|_email$|Email$/

/**
 * Find the email field in a form's declared fields. Prefers explicit
 * `type: 'email'`; falls back to a name match so forms whose admin-builder
 * field is `type: 'text'` but named `email` / `customerEmail` / `contact_email`
 * are still discovered.
 */
export function findEmailFieldInForm(
  fields: Array<{ name: string; type: string }>,
): string | undefined {
  const explicit = fields.find((f) => f.type === 'email')
  if (explicit) return explicit.name
  const heuristic = fields.find((f) => EMAIL_NAME_RE.test(f.name))
  return heuristic?.name
}

function findEmailFieldInCollection(
  fields: Record<string, FieldDefinition>,
): string | undefined {
  // Prefer explicit format: 'email'
  for (const [name, field] of Object.entries(fields)) {
    if (field.type === 'text' && (field as TextFieldOptions).format === 'email') {
      return name
    }
  }
  // Fallback to the name heuristic on text fields
  for (const [name, field] of Object.entries(fields)) {
    if (field.type === 'text' && EMAIL_NAME_RE.test(name)) {
      return name
    }
  }
  return undefined
}

/**
 * Build a form-submissions source for a given slug + email field name. Used
 * by both the cms.config.ts path and the DB-forms path so the searchFn is
 * identical.
 *
 * The email field is inlined into the SQL (not bound as a parameter) because
 * postgres-js can be ambiguous about the type of a parameterised JSONB key,
 * and the field name is trusted internal config — never user input.
 */
function buildFormSource(
  slug: string,
  displayName: string,
  emailField: string,
): GdprSource {
  // Defensive: even though the field name comes from our own schema, refuse
  // anything containing a single quote so a malformed schema can't break SQL.
  if (emailField.includes("'") || emailField.includes('"')) {
    throw new Error(`Invalid email field name "${emailField}" for form ${slug}`)
  }
  return {
    name: `form:${slug}`,
    displayName,
    table: 'form_submissions',
    emailColumn: emailField,
    identifierColumn: 'id',
    createdAtColumn: 'created_at',
    autoDiscovered: true,
    searchFn: async (email: string) => {
      const sql = getClient()
      const normalised = normaliseEmail(email)
      const rows = await sql.unsafe(
        `SELECT s.*
           FROM form_submissions s
           JOIN forms f ON s.form_id = f.id
          WHERE f.slug = $1
            AND lower(s.data->>'${emailField}') = $2`,
        [slug, normalised],
      )
      return rows as unknown[]
    },
  }
}

/** Auto-register forms declared in cms.config.ts via addForm(). */
export function discoverFormsSources(): GdprSource[] {
  const discovered: GdprSource[] = []
  for (const form of getDeclaredForms()) {
    const emailField = findEmailFieldInForm(form.fields)
    if (!emailField) continue

    const source = buildFormSource(
      form.slug,
      `${form.name} (form submission)`,
      emailField,
    )
    registerGdprSource(source)
    discovered.push(source)
  }
  return discovered
}

/**
 * Auto-register collections containing an email field — either explicitly
 * marked with `format: 'email'` (preferred) or matched by the name heuristic
 * on plain text fields.
 */
export function discoverCollectionsSources(config: CmsConfig): GdprSource[] {
  const discovered: GdprSource[] = []
  for (const col of config.collections) {
    const emailField = findEmailFieldInCollection(col.fields)
    if (!emailField) continue

    const table = collectionToTableName(col.name)
    const column = fieldToColumnName(emailField)
    const source: GdprSource = {
      name: `collection:${col.name}`,
      displayName: col.name.charAt(0).toUpperCase() + col.name.slice(1),
      table,
      emailColumn: column,
      identifierColumn: 'id',
      createdAtColumn: 'created_at',
      autoDiscovered: true,
      searchFn: async (email: string) => {
        const sql = getClient()
        const normalised = normaliseEmail(email)
        const rows = await sql.unsafe(
          `SELECT * FROM "${table}" WHERE lower("${column}") = $1`,
          [normalised],
        )
        return rows as unknown[]
      },
    }
    registerGdprSource(source)
    discovered.push(source)
  }
  return discovered
}

/**
 * Pure helper used by the DB-forms discovery — parses a forms-table row's
 * fields jsonb and decides which (if any) field to use as the email column.
 * Extracted for testability without the DB.
 */
export function pickFormSourceFromDbRow(row: {
  slug: string
  name: string
  fields: unknown
}): GdprSource | null {
  const fields = Array.isArray(row.fields)
    ? (row.fields as Array<{ name?: unknown; type?: unknown }>)
    : []
  const normalised = fields
    .filter((f) => typeof f?.name === 'string' && typeof f?.type === 'string')
    .map((f) => ({ name: f.name as string, type: f.type as string }))

  const emailField = findEmailFieldInForm(normalised)
  if (!emailField) return null

  return buildFormSource(row.slug, `${row.name} (form submission)`, emailField)
}

/**
 * Auto-register forms stored in the `forms` table (typically created via
 * the admin form-builder). Forms declared in cms.config.ts via `addForm()`
 * are already in the registry when this runs and are not overwritten.
 *
 * Async because it hits the DB. Called fire-and-forget from initGdpr so a
 * slow / unavailable database doesn't block server startup.
 */
export async function discoverDbFormsSources(): Promise<GdprSource[]> {
  const sql = getClient()
  let rows: Array<{ slug: string; name: string; fields: unknown }>
  try {
    rows = (await sql.unsafe(
      `SELECT slug, name, fields FROM forms`,
    )) as unknown as Array<{ slug: string; name: string; fields: unknown }>
  } catch (err) {
    console.warn(
      `[GDPR] DB-forms discovery skipped: ${(err as Error).message}`,
    )
    return []
  }

  const discovered: GdprSource[] = []
  for (const row of rows) {
    // Don't clobber a source already registered (e.g. from cms.config.ts).
    if (sources.has(`form:${row.slug}`)) continue
    const source = pickFormSourceFromDbRow(row)
    if (!source) continue
    registerGdprSource(source)
    discovered.push(source)
  }
  return discovered
}

/**
 * Called once at server boot. Runs the two sync discovery passes
 * (cms.config.ts forms, collections) immediately, and kicks off the
 * async DB-forms discovery as fire-and-forget so it doesn't block startup.
 *
 * Any consumer-registered sources via `registerGdprSource()` are evaluated
 * during cms.config.ts load (before this runs) and remain untouched.
 */
export function initGdpr(config: CmsConfig): {
  formsDiscovered: number
  collectionsDiscovered: number
  totalSources: number
} {
  const forms = discoverFormsSources()
  const collections = discoverCollectionsSources(config)

  // Fire-and-forget: admin-built forms get picked up shortly after boot.
  // A small window exists where /admin/gdpr might miss them on the very
  // first request — refresh the page once if so.
  discoverDbFormsSources()
    .then((dbForms) => {
      if (dbForms.length > 0) {
        console.log(
          `[GDPR] Discovered ${dbForms.length} admin-builder form source(s) from DB`,
        )
      }
    })
    .catch((err) => {
      console.warn(`[GDPR] DB-forms discovery failed: ${(err as Error).message}`)
    })

  return {
    formsDiscovered: forms.length,
    collectionsDiscovered: collections.length,
    totalSources: sources.size,
  }
}
