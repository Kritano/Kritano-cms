import type { NumberFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class NumberFieldBuilder extends FieldBuilder<NumberFieldOptions> {
  constructor() {
    super({ type: 'number' })
  }

  min(value: number): this {
    this._def.min = value
    return this
  }

  max(value: number): this {
    this._def.max = value
    return this
  }

  integer(): this {
    this._def.integer = true
    return this
  }
}

export function number(): NumberFieldBuilder {
  return new NumberFieldBuilder()
}
