import { useState } from 'react'
import { Copy, Check } from 'lucide-react'

interface Props {
  script: string
}

export function ScriptOutput({ script }: Props) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(script)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-medium text-gray-700">
          SSH into your server as root and run this script:
        </p>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 rounded-md border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          {copied ? <Check size={14} /> : <Copy size={14} />}
          {copied ? 'Copied!' : 'Copy to clipboard'}
        </button>
      </div>
      <pre className="max-h-[500px] overflow-auto rounded-lg bg-gray-900 p-4 text-xs leading-relaxed text-gray-100">
        <code>{script}</code>
      </pre>
    </div>
  )
}
