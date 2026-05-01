import type { CmsConfig, CollectionDefinition, FieldDefinition } from '@kritano/cms/types'

function fieldToGraphQLType(field: FieldDefinition): string {
  switch (field.type) {
    case 'text':
    case 'textarea':
    case 'slug':
    case 'url':
    case 'select':
    case 'colour':
      return field.required ? 'String!' : 'String'
    case 'richText':
    case 'seoBlock':
    case 'blocks':
    case 'multiSelect':
    case 'array':
      return 'JSON'
    case 'number':
      return field.required ? 'Float!' : 'Float'
    case 'boolean':
      return field.required ? 'Boolean!' : 'Boolean'
    case 'datetime':
      return 'String'
    case 'media':
    case 'relation':
      return 'ID'
  }
}

function capitalize(str: string): string {
  return str.charAt(0).toUpperCase() + str.slice(1)
}

export function buildGraphQLSchema(config: CmsConfig): string {
  const types: string[] = []
  const queries: string[] = []

  types.push(`scalar JSON`)
  types.push('')

  for (const collection of config.collections) {
    const typeName = capitalize(collection.name)

    // Type definition
    const fields = [
      '  id: ID!',
      '  status: String!',
      '  createdAt: String!',
      '  updatedAt: String!',
      '  publishedAt: String',
    ]

    const systemFields = new Set(['status', 'publishedAt', 'createdAt', 'updatedAt'])

    for (const [fieldName, field] of Object.entries(collection.fields)) {
      if (systemFields.has(fieldName)) continue
      fields.push(`  ${fieldName}: ${fieldToGraphQLType(field)}`)
    }

    types.push(`type ${typeName} {`)
    types.push(fields.join('\n'))
    types.push('}')
    types.push('')

    types.push(`type ${typeName}List {`)
    types.push(`  data: [${typeName}!]!`)
    types.push('  total: Int!')
    types.push('  page: Int!')
    types.push('  limit: Int!')
    types.push('  totalPages: Int!')
    types.push('}')
    types.push('')

    // Queries
    queries.push(`  ${collection.name}(id: ID!): ${typeName}`)
    queries.push(`  ${collection.name}BySlug(slug: String!): ${typeName}`)
    queries.push(`  ${collection.name}List(page: Int, limit: Int, status: String, sort: String, order: String): ${typeName}List`)
  }

  types.push('type Query {')
  types.push(queries.join('\n'))
  types.push('}')

  return types.join('\n')
}
