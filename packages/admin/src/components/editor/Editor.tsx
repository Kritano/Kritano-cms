import { useState, useCallback } from 'react'
import { EditorToolbar, type EditorMode } from './EditorToolbar'
import { VisualEditor } from './VisualEditor'
import { MarkdownEditor } from './MarkdownEditor'
import { SplitEditor } from './SplitEditor'

interface Props {
  label: string
  content: any // TipTap JSON
  onChange: (content: any) => void
}

// Simple TipTap JSON → markdown converter for mode switching
function jsonToMarkdown(json: any): string {
  if (!json || !json.content) return ''
  return json.content.map(nodeToMd).filter(Boolean).join('\n\n')
}

function nodeToMd(node: any): string {
  switch (node.type) {
    case 'paragraph':
      return inlineToMd(node.content)
    case 'heading':
      return '#'.repeat(node.attrs?.level || 1) + ' ' + inlineToMd(node.content)
    case 'bulletList':
      return (node.content || []).map((li: any) => '- ' + inlineToMd(li.content?.[0]?.content)).join('\n')
    case 'orderedList':
      return (node.content || []).map((li: any, i: number) => `${i + 1}. ` + inlineToMd(li.content?.[0]?.content)).join('\n')
    case 'blockquote':
      return (node.content || []).map((n: any) => '> ' + nodeToMd(n)).join('\n')
    case 'codeBlock':
      return '```\n' + (node.content?.[0]?.text || '') + '\n```'
    case 'horizontalRule':
      return '---'
    default:
      return inlineToMd(node.content)
  }
}

function inlineToMd(content: any[] | undefined): string {
  if (!content) return ''
  return content.map((n) => {
    let text = n.text || ''
    const marks = n.marks || []
    for (const mark of marks) {
      if (mark.type === 'bold') text = `**${text}**`
      if (mark.type === 'italic') text = `*${text}*`
      if (mark.type === 'code') text = `\`${text}\``
      if (mark.type === 'link') text = `[${text}](${mark.attrs?.href || ''})`
    }
    return text
  }).join('')
}

// Simple markdown → TipTap JSON (basic parser for mode switching)
function markdownToJson(md: string): any {
  const lines = md.split('\n')
  const content: any[] = []

  for (const line of lines) {
    if (!line.trim()) continue
    const headingMatch = line.match(/^(#{1,4})\s+(.+)$/)
    if (headingMatch) {
      content.push({ type: 'heading', attrs: { level: headingMatch[1].length }, content: [{ type: 'text', text: headingMatch[2] }] })
    } else if (line === '---') {
      content.push({ type: 'horizontalRule' })
    } else if (line.startsWith('> ')) {
      content.push({ type: 'blockquote', content: [{ type: 'paragraph', content: [{ type: 'text', text: line.slice(2) }] }] })
    } else {
      content.push({ type: 'paragraph', content: [{ type: 'text', text: line }] })
    }
  }

  return { type: 'doc', content }
}

export function Editor({ label, content, onChange }: Props) {
  const stored = localStorage.getItem('cms_editor_mode')
  const [mode, setMode] = useState<EditorMode>((stored as EditorMode) || 'visual')
  const [markdownText, setMarkdownText] = useState(() => jsonToMarkdown(content))

  const handleModeChange = useCallback((newMode: EditorMode) => {
    if (newMode !== 'visual' && mode === 'visual') {
      // Leaving visual → serialize to MD
      setMarkdownText(jsonToMarkdown(content))
    } else if (newMode === 'visual' && mode !== 'visual') {
      // Entering visual → parse MD to JSON
      onChange(markdownToJson(markdownText))
    }
    setMode(newMode)
    localStorage.setItem('cms_editor_mode', newMode)
  }, [mode, content, markdownText, onChange])

  const handleMarkdownChange = useCallback((md: string) => {
    setMarkdownText(md)
    // Also update the JSON content for auto-save
    onChange(markdownToJson(md))
  }, [onChange])

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-gray-700">{label}</label>
        <EditorToolbar mode={mode} onModeChange={handleModeChange} />
      </div>

      {mode === 'visual' && (
        <VisualEditor content={content} onChange={onChange} />
      )}
      {mode === 'markdown' && (
        <MarkdownEditor value={markdownText} onChange={handleMarkdownChange} />
      )}
      {mode === 'split' && (
        <SplitEditor value={markdownText} onChange={handleMarkdownChange} />
      )}
    </div>
  )
}
