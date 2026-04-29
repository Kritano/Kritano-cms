// ── Field Types ──────────────────────────────────────────────────────────────

export type FieldType =
  | 'text'
  | 'textarea'
  | 'richText'
  | 'slug'
  | 'url'
  | 'number'
  | 'boolean'
  | 'datetime'
  | 'select'
  | 'multiSelect'
  | 'media'
  | 'relation'
  | 'seoBlock'
  | 'blocks'
  | 'array'
  | 'colour'

// ── Field Definition ─────────────────────────────────────────────────────────

export interface BaseFieldOptions {
  required?: boolean
  nullable?: boolean
  default?: unknown
}

export interface TextFieldOptions extends BaseFieldOptions {
  type: 'text'
  min?: number
  max?: number
  pattern?: string
}

export interface TextareaFieldOptions extends BaseFieldOptions {
  type: 'textarea'
  maxLength?: number
}

export interface RichTextFieldOptions extends BaseFieldOptions {
  type: 'richText'
}

export interface SlugFieldOptions extends BaseFieldOptions {
  type: 'slug'
  from?: string
}

export interface UrlFieldOptions extends BaseFieldOptions {
  type: 'url'
}

export interface NumberFieldOptions extends BaseFieldOptions {
  type: 'number'
  min?: number
  max?: number
  integer?: boolean
}

export interface BooleanFieldOptions extends BaseFieldOptions {
  type: 'boolean'
}

export interface DatetimeFieldOptions extends BaseFieldOptions {
  type: 'datetime'
}

export interface SelectFieldOptions extends BaseFieldOptions {
  type: 'select'
  options: string[]
}

export interface MultiSelectFieldOptions extends BaseFieldOptions {
  type: 'multiSelect'
  options: string[]
}

export interface MediaFieldOptions extends BaseFieldOptions {
  type: 'media'
}

export interface RelationFieldOptions extends BaseFieldOptions {
  type: 'relation'
  target: string
}

export interface SeoBlockFieldOptions extends BaseFieldOptions {
  type: 'seoBlock'
}

export interface BlockDefinition {
  name: string
  fields: Record<string, FieldDefinition>
}

export interface BlocksFieldOptions extends BaseFieldOptions {
  type: 'blocks'
  blocks: BlockDefinition[]
}

export interface ArrayFieldOptions extends BaseFieldOptions {
  type: 'array'
  of: FieldDefinition
}

export interface ColourFieldOptions extends BaseFieldOptions {
  type: 'colour'
}

export type FieldDefinition =
  | TextFieldOptions
  | TextareaFieldOptions
  | RichTextFieldOptions
  | SlugFieldOptions
  | UrlFieldOptions
  | NumberFieldOptions
  | BooleanFieldOptions
  | DatetimeFieldOptions
  | SelectFieldOptions
  | MultiSelectFieldOptions
  | MediaFieldOptions
  | RelationFieldOptions
  | SeoBlockFieldOptions
  | BlocksFieldOptions
  | ArrayFieldOptions
  | ColourFieldOptions

// ── Collection Definition ────────────────────────────────────────────────────

export interface CollectionDefinition {
  name: string
  fields: Record<string, FieldDefinition>
}
