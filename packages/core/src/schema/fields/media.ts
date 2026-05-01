import type { MediaFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class MediaFieldBuilder extends FieldBuilder<MediaFieldOptions> {
  constructor() {
    super({ type: 'media' })
  }
}

export function media(): MediaFieldBuilder {
  return new MediaFieldBuilder()
}
