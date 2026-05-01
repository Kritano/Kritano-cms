import type { SlugFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class SlugFieldBuilder extends FieldBuilder<SlugFieldOptions> {
  constructor() {
    super({ type: 'slug' })
  }

  from(fieldName: string): this {
    this._def.from = fieldName
    return this
  }
}

export function slug(): SlugFieldBuilder {
  return new SlugFieldBuilder()
}
