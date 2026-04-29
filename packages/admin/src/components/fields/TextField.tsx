import { Input } from '@/components/ui/Input'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  required?: boolean
}

export function TextField({ label, value, onChange, required }: Props) {
  return (
    <Input
      label={label}
      value={value || ''}
      onChange={(e) => onChange(e.target.value)}
      required={required}
    />
  )
}
