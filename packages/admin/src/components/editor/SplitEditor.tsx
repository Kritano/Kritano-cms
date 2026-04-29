interface Props {
  value: string
  onChange: (value: string) => void
}

export function SplitEditor({ value, onChange }: Props) {
  // Simple markdown → HTML preview for v0.1
  const html = markdownToHtml(value)

  return (
    <div className="grid grid-cols-2 gap-0 divide-x divide-gray-200 rounded-md border border-gray-200 bg-white">
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Write markdown…"
        className="min-h-[400px] resize-none border-0 px-4 py-3 font-mono text-sm leading-relaxed text-gray-900 placeholder:text-gray-400 focus:outline-none"
      />
      <div
        className="prose prose-sm max-w-none overflow-y-auto px-4 py-3"
        dangerouslySetInnerHTML={{ __html: html }}
      />
    </div>
  )
}

function markdownToHtml(md: string): string {
  if (!md) return '<p class="text-gray-400">Preview will appear here…</p>'

  return md
    // Headings
    .replace(/^#### (.+)$/gm, '<h4>$1</h4>')
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    // Bold & italic
    .replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    // Code blocks
    .replace(/```[\s\S]*?```/g, (match) => {
      const code = match.slice(3, -3).replace(/^\w*\n/, '')
      return `<pre><code>${code}</code></pre>`
    })
    // Inline code
    .replace(/`(.+?)`/g, '<code>$1</code>')
    // Links
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    // Blockquotes
    .replace(/^> (.+)$/gm, '<blockquote>$1</blockquote>')
    // Unordered lists
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    // HR
    .replace(/^---$/gm, '<hr />')
    // Paragraphs
    .replace(/\n\n/g, '</p><p>')
    .replace(/^(?!<[huplbco])(.+)$/gm, '<p>$1</p>')
}
