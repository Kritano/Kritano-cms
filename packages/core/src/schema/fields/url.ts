import type { UrlFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class UrlFieldBuilder extends FieldBuilder<UrlFieldOptions> {
  constructor() {
    super({ type: 'url' })
  }
}

export function url(): UrlFieldBuilder {
  return new UrlFieldBuilder()
}
