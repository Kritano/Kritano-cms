import { SeoBlockField } from '@/components/fields/SeoBlockField'

interface Props {
  value: any
  onChange: (value: any) => void
}

export function SeoPanel({ value, onChange }: Props) {
  return (
    <div className="space-y-4">
      <h3 className="text-sm font-semibold text-gray-900">SEO</h3>
      <SeoBlockField label="" value={value} onChange={onChange} />
    </div>
  )
}
