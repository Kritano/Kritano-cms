import { Input } from '@/components/ui/Input'

interface Props {
  label: string
  value: string | null
  onChange: (value: string | null) => void
}

export function DatetimeField({ label, value, onChange }: Props) {
  const localValue = value ? new Date(value).toISOString().slice(0, 16) : ''

  return (
    <Input
      label={label}
      type="datetime-local"
      value={localValue}
      onChange={(e) => onChange(e.target.value ? new Date(e.target.value).toISOString() : null)}
    />
  )
}
