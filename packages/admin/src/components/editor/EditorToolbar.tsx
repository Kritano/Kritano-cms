import { cn } from '@/lib/utils'

export type EditorMode = 'visual' | 'markdown' | 'split'

interface Props {
  mode: EditorMode
  onModeChange: (mode: EditorMode) => void
}

const modes: { value: EditorMode; label: string }[] = [
  { value: 'visual', label: 'Visual' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'split', label: 'Split' },
]

export function EditorToolbar({ mode, onModeChange }: Props) {
  return (
    <div className="flex items-center gap-1 rounded-md border border-gray-200 bg-gray-50 p-0.5">
      {modes.map((m) => (
        <button
          key={m.value}
          type="button"
          onClick={() => onModeChange(m.value)}
          className={cn(
            'rounded-[5px] px-3 py-1 text-xs font-medium transition-colors',
            mode === m.value
              ? 'bg-white text-gray-900 shadow-sm'
              : 'text-gray-500 hover:text-gray-700',
          )}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}
