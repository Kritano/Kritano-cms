import { Input } from '@/components/ui/Input'

interface Props {
  label: string
  value: string | null
  onChange: (value: string | null) => void
  target: string
}

export function RelationField({ label, value, onChange, target }: Props) {
  // TODO: Proper search + select from target collection
  return (
    <Input
      label={`${label} (${target} ID)`}
      value={value || ''}
      onChange={(e) => onChange(e.target.value || null)}
      placeholder={`Enter ${target} ID`}
    />
  )
}
