import { getClient } from '../db/client'

const MAX_REVISIONS = 50

export async function createRevision(
  documentId: string,
  collection: string,
  tableName: string,
  userId: string | null,
): Promise<void> {
  const sql = getClient()

  // Snapshot the current document state
  const rows = await sql.unsafe(
    `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`,
    [documentId],
  )

  if (rows.length === 0) return

  const data = rows[0]

  await sql`
    INSERT INTO revisions (document_id, collection, data, created_by)
    VALUES (${documentId}, ${collection}, ${JSON.stringify(data)}::jsonb, ${userId})
  `

  // Prune old revisions beyond the limit
  await sql`
    DELETE FROM revisions
    WHERE document_id = ${documentId}
      AND id NOT IN (
        SELECT id FROM revisions
        WHERE document_id = ${documentId}
        ORDER BY created_at DESC
        LIMIT ${MAX_REVISIONS}
      )
  `
}
