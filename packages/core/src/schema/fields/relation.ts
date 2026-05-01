import type { RelationFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class RelationFieldBuilder extends FieldBuilder<RelationFieldOptions> {
  constructor(target: string) {
    super({ type: 'relation', target })
  }
}

export function relation(target: string): RelationFieldBuilder {
  return new RelationFieldBuilder(target)
}
