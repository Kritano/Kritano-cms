import type { CmsConfig, FieldDefinition, CollectionDefinition } from '@kritano/cms/types'

export class SchemaValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'SchemaValidationError'
  }
}

export function validateSchema(config: CmsConfig): void {
  validateSite(config)
  validateCollections(config)
}

function validateSite(config: CmsConfig): void {
  if (!config.site) {
    throw new SchemaValidationError('Missing "site" configuration')
  }
  if (!config.site.name || typeof config.site.name !== 'string') {
    throw new SchemaValidationError('site.name is required and must be a string')
  }
  if (!config.site.domain || typeof config.site.domain !== 'string') {
    throw new SchemaValidationError('site.domain is required and must be a string')
  }
  if (!config.site.language || typeof config.site.language !== 'string') {
    throw new SchemaValidationError('site.language is required and must be a string')
  }
}

function validateCollections(config: CmsConfig): void {
  if (!Array.isArray(config.collections) || config.collections.length === 0) {
    throw new SchemaValidationError('At least one collection must be defined')
  }

  const collectionNames = new Set<string>()

  for (const collection of config.collections) {
    validateCollection(collection, collectionNames, config)
    collectionNames.add(collection.name)
  }
}

function validateCollection(
  collection: CollectionDefinition,
  existingNames: Set<string>,
  config: CmsConfig,
): void {
  if (!collection.name || typeof collection.name !== 'string') {
    throw new SchemaValidationError('Collection name is required and must be a string')
  }

  if (!/^[a-zA-Z][a-zA-Z0-9-]*$/.test(collection.name)) {
    throw new SchemaValidationError(
      `Collection "${collection.name}": name must start with a letter and contain only letters, numbers, and hyphens`,
    )
  }

  if (existingNames.has(collection.name)) {
    throw new SchemaValidationError(`Duplicate collection name: "${collection.name}"`)
  }

  if (!collection.fields || Object.keys(collection.fields).length === 0) {
    throw new SchemaValidationError(`Collection "${collection.name}": must have at least one field`)
  }

  const fieldNames = new Set<string>()

  for (const [fieldName, field] of Object.entries(collection.fields)) {
    if (fieldNames.has(fieldName)) {
      throw new SchemaValidationError(
        `Collection "${collection.name}": duplicate field name "${fieldName}"`,
      )
    }
    fieldNames.add(fieldName)
    validateField(collection.name, fieldName, field, config)
  }
}

function validateField(
  collectionName: string,
  fieldName: string,
  field: FieldDefinition,
  config: CmsConfig,
): void {
  const prefix = `Collection "${collectionName}", field "${fieldName}"`

  if (!field.type) {
    throw new SchemaValidationError(`${prefix}: missing field type`)
  }

  const validTypes = [
    'text', 'textarea', 'richText', 'slug', 'url', 'number', 'boolean',
    'datetime', 'select', 'multiSelect', 'media', 'relation', 'seoBlock',
    'blocks', 'array', 'colour',
  ]

  if (!validTypes.includes(field.type)) {
    throw new SchemaValidationError(`${prefix}: unknown field type "${field.type}"`)
  }

  switch (field.type) {
    case 'text':
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        throw new SchemaValidationError(`${prefix}: min (${field.min}) cannot be greater than max (${field.max})`)
      }
      break

    case 'number':
      if (field.min !== undefined && field.max !== undefined && field.min > field.max) {
        throw new SchemaValidationError(`${prefix}: min (${field.min}) cannot be greater than max (${field.max})`)
      }
      break

    case 'select':
      if (!Array.isArray(field.options) || field.options.length === 0) {
        throw new SchemaValidationError(`${prefix}: select field must have at least one option`)
      }
      break

    case 'multiSelect':
      if (!Array.isArray(field.options) || field.options.length === 0) {
        throw new SchemaValidationError(`${prefix}: multiSelect field must have at least one option`)
      }
      break

    case 'relation': {
      const targetExists = config.collections.some((c) => c.name === field.target)
      if (!targetExists) {
        throw new SchemaValidationError(
          `${prefix}: relation target "${field.target}" does not match any collection`,
        )
      }
      break
    }

    case 'slug':
      if (field.from) {
        // Validate that the 'from' field exists in the same collection
        const collection = config.collections.find((c) => c.name === collectionName)
        if (collection && !collection.fields[field.from]) {
          throw new SchemaValidationError(
            `${prefix}: slug "from" references field "${field.from}" which does not exist in this collection`,
          )
        }
      }
      break

    case 'blocks':
      if (!Array.isArray(field.blocks) || field.blocks.length === 0) {
        throw new SchemaValidationError(`${prefix}: blocks field must define at least one block type`)
      }
      const blockNames = new Set<string>()
      for (const blockDef of field.blocks) {
        if (!blockDef.name) {
          throw new SchemaValidationError(`${prefix}: block definition missing name`)
        }
        if (blockNames.has(blockDef.name)) {
          throw new SchemaValidationError(`${prefix}: duplicate block name "${blockDef.name}"`)
        }
        blockNames.add(blockDef.name)
      }
      break

    case 'array':
      if (!field.of) {
        throw new SchemaValidationError(`${prefix}: array field must specify "of" type`)
      }
      break
  }
}
