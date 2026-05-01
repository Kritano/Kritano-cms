import type { BlockDefinition } from '@kritano/cms/types'
import { FieldRenderer } from '@/components/fields/FieldRenderer'

interface Props {
  blockDef: BlockDefinition
  fields: Record<string, unknown>
  onChange: (fields: Record<string, unknown>) => void
}

export function BlockEditor({ blockDef, fields, onChange }: Props) {
  function updateField(name: string, value: unknown) {
    onChange({ ...fields, [name]: value })
  }

  return (
    <div className="space-y-3 py-2">
      {Object.entries(blockDef.fields).map(([name, field]) => (
        <FieldRenderer
          key={name}
          name={name}
          label={name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
          field={field}
          value={fields[name]}
          onChange={(val) => updateField(name, val)}
          allValues={fields}
        />
      ))}
    </div>
  )
}
