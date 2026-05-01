import type { SelectFieldOptions } from '#types'
import { FieldBuilder } from './builder'

export class SelectFieldBuilder extends FieldBuilder<SelectFieldOptions> {
  constructor(options: string[]) {
    super({ type: 'select', options })
  }
}

export function select(options: string[]): SelectFieldBuilder {
  return new SelectFieldBuilder(options)
}
