import { cn } from '@/lib/utils'

interface Props {
  label: string
  value: string
  onChange: (value: string) => void
  maxLength?: number
}

export function TextareaField({ label, value, onChange, maxLength }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <textarea
        value={value || ''}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        rows={4}
        className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
      />
      {maxLength && (
        <p className={cn('text-xs', (value?.length || 0) > maxLength ? 'text-red-500' : 'text-gray-400')}>
          {value?.length || 0}/{maxLength}
        </p>
      )}
    </div>
  )
}
