import type { BlocksFieldOptions, BlockDefinition, FieldDefinition } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class BlocksFieldBuilder extends FieldBuilder<BlocksFieldOptions> {
  constructor(blockDefs: BlockDefinition[]) {
    super({ type: 'blocks', blocks: blockDefs })
  }
}

export function blocks(blockDefs: BlockDefinition[]): BlocksFieldBuilder {
  return new BlocksFieldBuilder(blockDefs)
}

export function block(
  name: string,
  fields: Record<string, FieldBuilder<FieldDefinition>>,
): BlockDefinition {
  const resolved: Record<string, FieldDefinition> = {}
  for (const [key, builder] of Object.entries(fields)) {
    resolved[key] = builder.toDefinition()
  }
  return { name, fields: resolved }
}
