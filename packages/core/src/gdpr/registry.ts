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
 * Heuristic match for column names that look like they hold an email,
 * used when a `text` field isn't explicitly marked with `format: 'email'`.
 * Conservative on purpose — false positives would expose non-PII columns
 * as GDPR sources.
 */
const EMAIL_NAME_RE = /^email$|_email$|Email$/

function findEmailFieldInForm(
  fields: Array<{ name: string; type: string }>,
): string | undefined {
  return fields.find((f) => f.type === 'email')?.name
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

/** Auto-register every declared form that has an email-typed field. */
export function discoverFormsSources(): GdprSource[] {
  const discovered: GdprSource[] = []
  for (const form of getDeclaredForms()) {
    const emailField = findEmailFieldInForm(form.fields)
    if (!emailField) continue

    const source: GdprSource = {
      name: `form:${form.slug}`,
      displayName: `${form.name} (form submission)`,
      table: 'form_submissions',
      emailColumn: emailField,
      identifierColumn: 'id',
      createdAtColumn: 'created_at',
      autoDiscovered: true,
      searchFn: async (email: string) => {
        const sql = getClient()
        const normalised = normaliseEmail(email)
        // form_submissions.data is JSONB keyed by FormFieldConfig.name.
        // Use lower(data->>field) for case-insensitive equality with the
        // already-normalised search input.
        const rows = await sql.unsafe(
          `SELECT s.*
             FROM form_submissions s
             JOIN forms f ON s.form_id = f.id
            WHERE f.slug = $1
              AND lower(s.data->>$2) = $3`,
          [form.slug, emailField, normalised],
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
 * Auto-register every collection that has an email field — either explicitly
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
 * Called once at server boot. Runs both auto-discovery passes. Any
 * consumer-registered sources via `registerGdprSource()` (which happen
 * during `cms.config.ts` evaluation, before this runs) are left untouched.
 */
export function initGdpr(config: CmsConfig): {
  formsDiscovered: number
  collectionsDiscovered: number
  totalSources: number
} {
  const forms = discoverFormsSources()
  const collections = discoverCollectionsSources(config)
  return {
    formsDiscovered: forms.length,
    collectionsDiscovered: collections.length,
    totalSources: sources.size,
  }
}
