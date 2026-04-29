interface Props {
  value: string
  onChange: (value: string) => void
}

export function MarkdownEditor({ value, onChange }: Props) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Write or paste markdown here…"
      className="block min-h-[400px] w-full resize-y rounded-md border border-gray-200 bg-white px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
    />
  )
}
