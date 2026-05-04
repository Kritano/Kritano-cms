import { getClient } from '../db/client'
import { getDeclaredForms, type FormConfig } from '../schema/addForm'

/**
 * Sync forms declared in cms.config.ts to the database.
 * Creates new forms, updates fields on existing ones if changed.
 * Called on server startup after migrations.
 */
export async function syncDeclaredForms(): Promise<void> {
  const forms = getDeclaredForms()
  if (forms.length === 0) return

  const sql = getClient()

  for (const form of forms) {
    try {
      // Check if form exists
      const existing = await sql`SELECT id, fields FROM forms WHERE slug = ${form.slug} LIMIT 1`

      if (existing.length === 0) {
        // Create new form
        await sql`
          INSERT INTO forms (name, slug, fields, settings)
          VALUES (
            ${form.name},
            ${form.slug},
            ${sql.json(form.fields as any)},
            ${sql.json(form.settings || {})}
          )
        `
        console.log(`[CMS] Form created: ${form.slug}`)
      } else if (form.fields.length > 0) {
        // Update fields if declared inline and the form has no fields yet
        const existingFields = existing[0].fields as any[]
        if (!existingFields || existingFields.length === 0) {
          await sql`
            UPDATE forms
            SET fields = ${sql.json(form.fields as any)},
                settings = ${sql.json(form.settings || {})},
                updated_at = now()
            WHERE slug = ${form.slug}
          `
          console.log(`[CMS] Form updated: ${form.slug}`)
        }
      }
    } catch (err) {
      console.warn(`[CMS] Failed to sync form "${form.slug}": ${err}`)
    }
  }
}
