import type { MultiSelectFieldOptions } from '@kritano/types'
import { FieldBuilder } from './builder'

export class MultiSelectFieldBuilder extends FieldBuilder<MultiSelectFieldOptions> {
  constructor(options: string[]) {
    super({ type: 'multiSelect', options })
  }
}

export function multiSelect(options: string[]): MultiSelectFieldBuilder {
  return new MultiSelectFieldBuilder(options)
}
