import type { TextareaFieldOptions } from '#types'
import { FieldBuilder } from './builder'

export class TextareaFieldBuilder extends FieldBuilder<TextareaFieldOptions> {
  constructor() {
    super({ type: 'textarea' })
  }

  maxLength(value: number): this {
    this._def.maxLength = value
    return this
  }
}

export function textarea(): TextareaFieldBuilder {
  return new TextareaFieldBuilder()
}
