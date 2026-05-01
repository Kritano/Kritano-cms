import type { CmsConfig, CollectionDefinition, FieldDefinition } from '@kritano/cms/types'
import { getSearchClient, isSearchAvailable } from './client'

interface TypesenseFieldDef {
  name: string
  type: string
  facet?: boolean
  optional?: boolean
  sort?: boolean
}

const FIELD_TYPE_MAP: Record<string, { type: string; facet?: boolean } | null> = {
  text: { type: 'string' },
  textarea: { type: 'string' },
  richText: { type: 'string' },
  slug: { type: 'string' },
  url: { type: 'string' },
  number: { type: 'float' },
  boolean: { type: 'bool' },
  datetime: { type: 'int64' },
  select: { type: 'string', facet: true },
  multiSelect: { type: 'string[]', facet: true },
  colour: { type: 'string' },
  // Not indexed
  media: null,
  relation: null,
  seoBlock: null,
  blocks: null,
  array: null,
}

/** Convert a CMS collection definition to a Typesense collection schema */
export function buildTypesenseSchema(collection: CollectionDefinition): {
  name: string
  fields: TypesenseFieldDef[]
} {
  const fields: TypesenseFieldDef[] = [
    // System fields — always present
    { name: 'collection', type: 'string', facet: true },
    { name: 'status', type: 'string', facet: true },
    { name: 'publishedAt', type: 'int64', sort: true, optional: true },
    { name: 'title', type: 'string' },
  ]

  // Add collection-specific fields
  for (const [name, field] of Object.entries(collection.fields)) {
    // Skip fields already handled as system fields
    if (name === 'status' || name === 'title') continue

    const mapping = FIELD_TYPE_MAP[field.type]
    if (!mapping) continue

    fields.push({
      name,
      type: mapping.type,
      facet: mapping.facet,
      optional: true,
    })
  }

  return {
    name: `cms_${collection.name}`,
    fields,
  }
}

/** Sync all CMS collection schemas to Typesense */
export async function syncSchemas(config: CmsConfig): Promise<{ synced: string[]; errors: string[] }> {
  if (!isSearchAvailable()) {
    return { synced: [], errors: ['Search not available — TYPESENSE_API_KEY not set'] }
  }

  const client = getSearchClient()
  if (!client) {
    return { synced: [], errors: ['Search client not available'] }
  }

  const synced: string[] = []
  const errors: string[] = []

  // Check Typesense health first
  try {
    await client.health.retrieve()
  } catch {
    return { synced: [], errors: ['Typesense is not reachable'] }
  }

  for (const collection of config.collections) {
    const schema = buildTypesenseSchema(collection)

    try {
      // Try to get existing collection
      try {
        await client.collections(schema.name).retrieve()
        // Collection exists — update schema (drop and recreate for field changes)
        // Typesense doesn't support altering field types, so we recreate
        await client.collections(schema.name).delete()
      } catch {
        // Collection doesn't exist — that's fine, we'll create it
      }

      await client.collections().create({
        name: schema.name,
        fields: schema.fields as any,
        default_sorting_field: 'publishedAt',
      })

      synced.push(collection.name)
    } catch (err) {
      errors.push(`${collection.name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return { synced, errors }
}
