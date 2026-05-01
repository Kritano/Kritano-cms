import type { TextFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class TextFieldBuilder extends FieldBuilder<TextFieldOptions> {
  constructor() {
    super({ type: 'text' })
  }

  min(value: number): this {
    this._def.min = value
    return this
  }

  max(value: number): this {
    this._def.max = value
    return this
  }

  pattern(value: string): this {
    this._def.pattern = value
    return this
  }
}

export function text(): TextFieldBuilder {
  return new TextFieldBuilder()
}
