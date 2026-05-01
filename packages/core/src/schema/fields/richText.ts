import type { RichTextFieldOptions } from '@kritano/types'
import { FieldBuilder } from './builder'

export class RichTextFieldBuilder extends FieldBuilder<RichTextFieldOptions> {
  constructor() {
    super({ type: 'richText' })
  }
}

export function richText(): RichTextFieldBuilder {
  return new RichTextFieldBuilder()
}
