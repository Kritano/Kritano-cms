interface Props {
  label: string
  value: string[]
  onChange: (value: string[]) => void
  options: string[]
}

export function MultiSelectField({ label, value: rawValue, onChange, options: rawOptions }: Props) {
  const value = Array.isArray(rawValue) ? rawValue : []
  const options = Array.isArray(rawOptions) ? rawOptions : []
  function toggle(opt: string) {
    if (value.includes(opt)) {
      onChange(value.filter((v) => v !== opt))
    } else {
      onChange([...value, opt])
    }
  }

  return (
    <div className="space-y-1.5">
      <label className="block text-sm font-medium text-gray-700">{label}</label>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => (
          <button
            key={opt}
            type="button"
            onClick={() => toggle(opt)}
            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
              value.includes(opt)
                ? 'border-gray-900 bg-gray-900 text-white'
                : 'border-gray-300 bg-white text-gray-600 hover:border-gray-400'
            }`}
          >
            {opt}
          </button>
        ))}
      </div>
    </div>
  )
}
