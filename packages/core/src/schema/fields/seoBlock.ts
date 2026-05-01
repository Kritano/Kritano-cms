import type { SeoBlockFieldOptions } from '@kritano/types'
import { FieldBuilder } from './builder'

export class SeoBlockFieldBuilder extends FieldBuilder<SeoBlockFieldOptions> {
  constructor() {
    super({ type: 'seoBlock' })
  }
}

export function seoBlock(): SeoBlockFieldBuilder {
  return new SeoBlockFieldBuilder()
}
