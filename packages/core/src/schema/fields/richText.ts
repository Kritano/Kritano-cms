import type { RichTextFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class RichTextFieldBuilder extends FieldBuilder<RichTextFieldOptions> {
  constructor() {
    super({ type: 'richText' })
  }
}

export function richText(): RichTextFieldBuilder {
  return new RichTextFieldBuilder()
}
