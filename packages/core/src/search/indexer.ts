import type { CollectionDefinition, FieldDefinition } from '@kritano/cms/types'
import { getSearchClient, isSearchAvailable } from './client'

/** Extract plain text from TipTap JSON content */
export function extractText(tiptapJson: unknown): string {
  if (!tiptapJson || typeof tiptapJson !== 'object') return ''

  const node = tiptapJson as Record<string, unknown>
  const parts: string[] = []

  // Extract text from text nodes
  if (node.type === 'text' && typeof node.text === 'string') {
    parts.push(node.text)
  }

  // Recurse into content array
  if (Array.isArray(node.content)) {
    for (const child of node.content) {
      parts.push(extractText(child))
    }
  }

  return parts.filter(Boolean).join(' ')
}

/** Convert a CMS document to a Typesense document for indexing */
export function toSearchDocument(
  collectionName: string,
  doc: Record<string, unknown>,
  fields: Record<string, FieldDefinition>,
): Record<string, unknown> {
  const searchDoc: Record<string, unknown> = {
    id: doc.id as string,
    collection: collectionName,
    status: (doc.status as string) || 'draft',
    publishedAt: doc.published_at
      ? Math.floor(new Date(doc.published_at as string).getTime() / 1000)
      : 0,
    title: (doc.title as string) || '',
  }

  for (const [name, field] of Object.entries(fields)) {
    if (name === 'status' || name === 'title') continue

    // Convert camelCase field name to snake_case column name
    const columnName = name.replace(/[A-Z]/g, (m) => `_${m.toLowerCase()}`)
    const value = doc[columnName] ?? doc[name]

    if (value === null || value === undefined) continue

    switch (field.type) {
      case 'text':
      case 'textarea':
      case 'slug':
      case 'url':
      case 'colour':
        searchDoc[name] = String(value)
        break
      case 'richText':
        searchDoc[name] = extractText(value)
        break
      case 'number':
        searchDoc[name] = typeof value === 'number' ? value : parseFloat(String(value))
        break
      case 'boolean':
        searchDoc[name] = Boolean(value)
        break
      case 'datetime':
        searchDoc[name] = value ? Math.floor(new Date(String(value)).getTime() / 1000) : 0
        break
      case 'select':
        searchDoc[name] = String(value)
        break
      case 'multiSelect':
        searchDoc[name] = Array.isArray(value) ? value.map(String) : []
        break
      // media, relation, seoBlock, blocks, array — not indexed
    }
  }

  return searchDoc
}

/** Upsert a document into the search index */
export async function upsertDocument(
  collectionName: string,
  doc: Record<string, unknown>,
  fields: Record<string, FieldDefinition>,
): Promise<boolean> {
  if (!isSearchAvailable()) return false

  const client = getSearchClient()
  if (!client) return false

  const tsCollectionName = `cms_${collectionName}`
  const searchDoc = toSearchDocument(collectionName, doc, fields)

  try {
    await client.collections(tsCollectionName).documents().upsert(searchDoc)
    return true
  } catch (err) {
    console.warn(`[Search] Failed to index document ${doc.id} in ${collectionName}: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

/** Remove a document from the search index */
export async function deleteDocument(
  collectionName: string,
  documentId: string,
): Promise<boolean> {
  if (!isSearchAvailable()) return false

  const client = getSearchClient()
  if (!client) return false

  const tsCollectionName = `cms_${collectionName}`

  try {
    await client.collections(tsCollectionName).documents(documentId).delete()
    return true
  } catch (err) {
    // Ignore "not found" errors — document may not have been indexed
    console.warn(`[Search] Failed to remove document ${documentId} from ${collectionName}: ${err instanceof Error ? err.message : err}`)
    return false
  }
}

/** Re-index all published documents for a collection */
export async function reindexCollection(
  collectionName: string,
  documents: Record<string, unknown>[],
  fields: Record<string, FieldDefinition>,
): Promise<{ indexed: number; errors: number }> {
  if (!isSearchAvailable()) return { indexed: 0, errors: 0 }

  const client = getSearchClient()
  if (!client) return { indexed: 0, errors: 0 }

  const tsCollectionName = `cms_${collectionName}`
  let indexed = 0
  let errors = 0

  for (const doc of documents) {
    const searchDoc = toSearchDocument(collectionName, doc, fields)
    try {
      await client.collections(tsCollectionName).documents().upsert(searchDoc)
      indexed++
    } catch {
      errors++
    }
  }

  return { indexed, errors }
}

/** Clear all documents from a collection's search index */
export async function clearCollection(collectionName: string): Promise<boolean> {
  if (!isSearchAvailable()) return false

  const client = getSearchClient()
  if (!client) return false

  const tsCollectionName = `cms_${collectionName}`

  try {
    await client.collections(tsCollectionName).delete()
    return true
  } catch {
    return false
  }
}
