import type { BooleanFieldOptions } from '#types'
import { FieldBuilder } from './builder'

export class BooleanFieldBuilder extends FieldBuilder<BooleanFieldOptions> {
  constructor() {
    super({ type: 'boolean' })
  }
}

export function boolean(): BooleanFieldBuilder {
  return new BooleanFieldBuilder()
}
