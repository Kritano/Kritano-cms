import type { TextFieldOptions } from '@kritano/cms/types'
import { TextFieldBuilder } from './text'

/**
 * `email()` is sugar for a text field marked as containing an email address.
 *
 * Why not a new FieldType: the codebase has exhaustive switches over field.type
 * in the schema generator, search indexer, GraphQL builder, admin renderer,
 * etc. A new top-level type would require touching all of them. Treating it
 * as `text` with `format: 'email'` lets every existing path keep working —
 * only the GDPR registry (and, later, admin-side validation) cares about
 * the format marker.
 */
export class EmailFieldBuilder extends TextFieldBuilder {
  constructor() {
    super()
    ;(this as unknown as { _def: TextFieldOptions })._def.format = 'email'
  }
}

export function email(): EmailFieldBuilder {
  return new EmailFieldBuilder()
}
