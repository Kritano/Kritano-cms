import type { ArrayFieldOptions, FieldDefinition } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class ArrayFieldBuilder extends FieldBuilder<ArrayFieldOptions> {
  constructor(of: FieldBuilder<FieldDefinition>) {
    super({ type: 'array', of: of.toDefinition() })
  }
}

export function array(of: FieldBuilder<FieldDefinition>): ArrayFieldBuilder {
  return new ArrayFieldBuilder(of)
}
