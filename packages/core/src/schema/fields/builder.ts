import type { FieldDefinition, BaseFieldOptions } from '@kritano/cms/types'

export class FieldBuilder<T extends FieldDefinition = FieldDefinition> {
  protected _def: T

  constructor(def: T) {
    this._def = { ...def }
  }

  required(): this {
    ;(this._def as BaseFieldOptions).required = true
    return this
  }

  nullable(): this {
    ;(this._def as BaseFieldOptions).nullable = true
    return this
  }

  default(value: unknown): this {
    ;(this._def as BaseFieldOptions).default = value
    return this
  }

  toDefinition(): T {
    return { ...this._def }
  }
}
