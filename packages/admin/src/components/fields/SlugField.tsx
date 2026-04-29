import { useEffect, useState } from 'react'
import { Input } from '@/components/ui/Input'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  sourceValue?: string
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function SlugField({ label, value, onChange, sourceValue }: Props) {
  const [manual, setManual] = useState(false)

  useEffect(() => {
    if (!manual && sourceValue) {
      onChange(slugify(sourceValue))
    }
  }, [sourceValue, manual])

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="block text-sm font-medium text-gray-700">{label}</label>
        <button
          type="button"
          onClick={() => setManual(!manual)}
          className="text-xs text-gray-400 hover:text-gray-600"
        >
          {manual ? 'Auto-generate' : 'Edit manually'}
        </button>
      </div>
      <Input
        value={value || ''}
        onChange={(e) => {
          setManual(true)
          onChange(slugify(e.target.value))
        }}
        disabled={!manual}
        className={!manual ? 'bg-gray-50' : ''}
      />
    </div>
  )
}
