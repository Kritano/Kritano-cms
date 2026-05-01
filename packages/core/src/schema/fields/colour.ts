import type { ColourFieldOptions } from '#types'
import { FieldBuilder } from './builder'

export class ColourFieldBuilder extends FieldBuilder<ColourFieldOptions> {
  constructor() {
    super({ type: 'colour' })
  }
}

export function colour(): ColourFieldBuilder {
  return new ColourFieldBuilder()
}
