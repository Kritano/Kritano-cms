import { Plus, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Props {
  label: string
  value: unknown[]
  onChange: (value: unknown[]) => void
}

export function ArrayField({ label, value: rawValue, onChange }: Props) {
  const value = Array.isArray(rawValue) ? rawValue : []
  function addItem() {
    onChange([...value, ''])
  }

  function removeItem(index: number) {
    onChange(value.filter((_, i) => i !== index))
  }

  function updateItem(index: number, newValue: string) {
    const updated = [...value]
    updated[index] = newValue
    onChange(updated)
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="space-y-2">
        {value.map((item, i) => (
          <div key={i} className="flex items-center gap-2">
            <Input
              value={String(item || '')}
              onChange={(e) => updateItem(i, e.target.value)}
              className="flex-1"
            />
            <button type="button" onClick={() => removeItem(i)} className="text-gray-400 hover:text-red-500">
              <X size={16} />
            </button>
          </div>
        ))}
        <Button type="button" variant="secondary" size="sm" onClick={addItem}>
          <Plus size={16} className="mr-1" />
          Add item
        </Button>
      </div>
    </div>
  )
}
