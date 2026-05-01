import type { ColourFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class ColourFieldBuilder extends FieldBuilder<ColourFieldOptions> {
  constructor() {
    super({ type: 'colour' })
  }
}

export function colour(): ColourFieldBuilder {
  return new ColourFieldBuilder()
}
