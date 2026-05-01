import type { FieldDefinition } from '@kritano/cms/types'
import { TextField } from './TextField'
import { TextareaField } from './TextareaField'
import { SlugField } from './SlugField'
import { SelectField } from './SelectField'
import { MultiSelectField } from './MultiSelectField'
import { BooleanField } from './BooleanField'
import { DatetimeField } from './DatetimeField'
import { MediaField } from './MediaField'
import { RelationField } from './RelationField'
import { ArrayField } from './ArrayField'
import { SeoBlockField } from './SeoBlockField'

interface Props {
  name: string
  label: string
  field: FieldDefinition
  value: unknown
  onChange: (value: unknown) => void
  allValues?: Record<string, unknown>
}

export function FieldRenderer({ name, label, field, value, onChange, allValues }: Props) {
  // richText and blocks are handled separately in the editor page
  // seoBlock is handled in the sidebar
  switch (field.type) {
    case 'text':
      return <TextField label={label} value={value as string} onChange={onChange} required={field.required} />
    case 'textarea':
      return <TextareaField label={label} value={value as string} onChange={onChange} maxLength={field.maxLength} />
    case 'slug':
      return (
        <SlugField
          label={label}
          value={value as string}
          onChange={onChange}
          sourceValue={field.from && allValues ? String(allValues[field.from] || '') : undefined}
        />
      )
    case 'url':
      return <TextField label={label} value={value as string} onChange={onChange} />
    case 'number':
      return (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="number"
            value={value !== null && value !== undefined ? String(value) : ''}
            onChange={(e) => onChange(e.target.value ? Number(e.target.value) : null)}
            min={field.min}
            max={field.max}
            step={field.integer ? 1 : undefined}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
      )
    case 'boolean':
      return <BooleanField label={label} value={!!value} onChange={onChange} />
    case 'datetime':
      return <DatetimeField label={label} value={value as string | null} onChange={onChange} />
    case 'select':
      return <SelectField label={label} value={value as string} onChange={onChange} options={field.options} />
    case 'multiSelect':
      return <MultiSelectField label={label} value={(value || []) as string[]} onChange={onChange} options={field.options} />
    case 'media':
      return <MediaField label={label} value={value as string | null} onChange={onChange} />
    case 'relation':
      return <RelationField label={label} value={value as string | null} onChange={onChange} target={field.target} />
    case 'array':
      return <ArrayField label={label} value={(value || []) as unknown[]} onChange={onChange} />
    case 'seoBlock':
      return <SeoBlockField label={label} value={value as any} onChange={onChange} />
    case 'colour':
      return (
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">{label}</label>
          <input
            type="color"
            value={(value as string) || '#000000'}
            onChange={(e) => onChange(e.target.value)}
            className="h-10 w-20 cursor-pointer rounded border border-gray-300"
          />
        </div>
      )
    default:
      return null
  }
}
