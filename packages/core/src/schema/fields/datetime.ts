import type { DatetimeFieldOptions } from '@kritano/cms/types'
import { FieldBuilder } from './builder'

export class DatetimeFieldBuilder extends FieldBuilder<DatetimeFieldOptions> {
  constructor() {
    super({ type: 'datetime' })
  }
}

export function datetime(): DatetimeFieldBuilder {
  return new DatetimeFieldBuilder()
}
