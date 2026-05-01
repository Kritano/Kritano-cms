import type { CollectionDefinition, FieldDefinition } from '@kritano/cms/types'
import { FieldBuilder } from './fields/builder'

export function defineCollection(
  name: string,
  options: {
    fields: Record<string, FieldBuilder<FieldDefinition>>
  },
): CollectionDefinition {
  const fields: Record<string, FieldDefinition> = {}
  for (const [key, builder] of Object.entries(options.fields)) {
    fields[key] = builder.toDefinition()
  }
  return { name, fields }
}
