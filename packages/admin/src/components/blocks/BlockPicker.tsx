import { useState, useEffect, useRef } from 'react'
import type { BlockDefinition } from '@kritano/cms/types'
import { Search, X } from 'lucide-react'
import { BlockPreviewFallback } from './BlockPreviewFallback'

interface Props {
  blocks: BlockDefinition[]
  onSelect: (blockName: string) => void
  onClose: () => void
}

function formatBlockName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function getFieldNames(block: BlockDefinition): string[] {
  return Object.keys(block.fields || {})
}

export function BlockPicker({ blocks, onSelect, onClose }: Props) {
  const [search, setSearch] = useState('')
  const [focusedIndex, setFocusedIndex] = useState(0)
  const searchRef = useRef<HTMLInputElement>(null)

  const filtered = blocks.filter((block) => {
    if (!search) return true
    const q = search.toLowerCase()
    const name = block.name.toLowerCase()
    const desc = ((block as any).description || '').toLowerCase()
    const fieldNames = getFieldNames(block).join(' ').toLowerCase()
    return name.includes(q) || desc.includes(q) || fieldNames.includes(q)
  })

  useEffect(() => {
    searchRef.current?.focus()
  }, [])

  useEffect(() => {
    setFocusedIndex(0)
  }, [search])

  function handleKeyDown(e: React.KeyboardEvent) {
    const cols = 2
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + 1, filtered.length - 1))
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'ArrowDown') {
      e.preventDefault()
      setFocusedIndex((i) => Math.min(i + cols, filtered.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setFocusedIndex((i) => Math.max(i - cols, 0))
    } else if (e.key === 'Enter' && filtered[focusedIndex]) {
      e.preventDefault()
      onSelect(filtered[focusedIndex].name)
      onClose()
    } else if (e.key === 'Escape') {
      e.preventDefault()
      onClose()
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="w-full max-w-lg overflow-hidden rounded-xl bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-200 px-5 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Add a block</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={16} />
          </button>
        </div>

        {/* Search */}
        <div className="border-b border-gray-100 px-5 py-2">
          <div className="relative">
            <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              ref={searchRef}
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search blocks..."
              className="w-full rounded-md border-0 bg-gray-50 py-1.5 pl-8 pr-3 text-sm outline-none placeholder:text-gray-400 focus:bg-gray-100"
            />
          </div>
        </div>

        {/* Grid */}
        <div className="max-h-96 overflow-y-auto p-4">
          {filtered.length === 0 && (
            <div className="py-6 text-center text-sm text-gray-500">
              No blocks found for &ldquo;{search}&rdquo;
              <button onClick={() => setSearch('')} className="mt-1 block w-full text-xs text-gray-400 hover:text-gray-600">
                Clear search
              </button>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            {filtered.map((block, i) => {
              const fieldNames = getFieldNames(block)
              const description = (block as any).description || null

              return (
                <button
                  key={block.name}
                  onClick={() => { onSelect(block.name); onClose() }}
                  className={`group rounded-lg border-2 bg-white p-0 text-left transition-all hover:shadow-md ${
                    i === focusedIndex
                      ? 'border-gray-900 shadow-md'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  {/* Preview */}
                  <div className="overflow-hidden rounded-t-md bg-gray-50">
                    <BlockPreviewFallback fields={block.fields} />
                  </div>

                  {/* Info */}
                  <div className="p-3">
                    <p className="text-sm font-semibold text-gray-900">
                      {formatBlockName(block.name)}
                    </p>
                    {description && (
                      <p className="mt-0.5 line-clamp-2 text-xs text-gray-500">{description}</p>
                    )}
                    {fieldNames.length > 0 && (
                      <p className="mt-1.5 text-[10px] text-gray-400">
                        {fieldNames.join(' · ')}
                      </p>
                    )}
                  </div>
                </button>
              )
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-gray-100 px-5 py-2">
          <div className="flex gap-3 text-[10px] text-gray-400">
            <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">↑↓←→</kbd> navigate</span>
            <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">↵</kbd> insert</span>
            <span><kbd className="rounded border border-gray-200 bg-gray-50 px-1 py-0.5 font-mono">esc</kbd> close</span>
          </div>
        </div>
      </div>
    </div>
  )
}
