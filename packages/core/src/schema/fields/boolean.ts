import type { BooleanFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class BooleanFieldBuilder extends FieldBuilder<BooleanFieldOptions> {
  constructor() {
    super({ type: 'boolean' })
  }
}

export function boolean(): BooleanFieldBuilder {
  return new BooleanFieldBuilder()
}
