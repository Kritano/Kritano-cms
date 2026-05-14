import { describe, expect, test } from 'bun:test'
import { email } from '../../schema/fields'
import type { TextFieldOptions } from '@kritano/cms/types'

describe('email() field builder', () => {
  test('produces a text field with format:"email"', () => {
    const def = email().toDefinition() as TextFieldOptions
    expect(def.type).toBe('text')
    expect(def.format).toBe('email')
  })

  test('supports required() chaining like text()', () => {
    const def = email().required().toDefinition() as TextFieldOptions
    expect(def.required).toBe(true)
    expect(def.format).toBe('email')
  })

  test('default unmodified is non-required + non-nullable', () => {
    const def = email().toDefinition() as TextFieldOptions
    expect(def.required).toBeUndefined()
    expect(def.nullable).toBeUndefined()
  })
})
