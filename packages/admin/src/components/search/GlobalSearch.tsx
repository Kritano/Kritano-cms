import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { Search, X } from 'lucide-react'
import { useSearch } from './useSearch'
import { SearchResult } from './SearchResult'
import type { SearchHit } from './useSearch'

export function GlobalSearch() {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const navigate = useNavigate()
  const { results, isLoading } = useSearch(query)

  // Flatten all hits for keyboard navigation
  const allHits: SearchHit[] = results
    ? Object.values(results.results).flatMap((r) => r.hits)
    : []

  // Cmd+K / Ctrl+K to open
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setOpen((prev) => !prev)
      }
      if (e.key === 'Escape' && open) {
        setOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  // Focus input when opened
  useEffect(() => {
    if (open) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 50)
    }
  }, [open])

  // Reset selection when results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [results])

  const navigateToResult = useCallback(
    (hit: SearchHit) => {
      setOpen(false)
      navigate({ to: `/admin/${hit.collection}/${hit.id}` })
    },
    [navigate],
  )

  function handleInputKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.min(prev + 1, allHits.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => Math.max(prev - 1, 0))
    } else if (e.key === 'Enter' && allHits[selectedIndex]) {
      e.preventDefault()
      navigateToResult(allHits[selectedIndex])
    }
  }

  if (!open) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-50 bg-black/40"
        onClick={() => setOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-x-0 top-[15%] z-50 mx-auto w-full max-w-lg">
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl">
          {/* Search input */}
          <div className="flex items-center gap-3 border-b border-gray-200 px-4">
            <Search size={18} className="shrink-0 text-gray-400" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleInputKeyDown}
              placeholder="Search everything..."
              className="h-12 flex-1 bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
            />
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>

          {/* Results */}
          <div className="max-h-80 overflow-y-auto">
            {isLoading && query && (
              <div className="space-y-2 p-3">
                {[1, 2, 3].map((i) => (
                  <div key={i} className="flex items-center gap-3 rounded-md px-3 py-2.5">
                    <div className="h-4 w-4 animate-pulse rounded bg-gray-200" />
                    <div className="flex-1 space-y-1.5">
                      <div className="h-3.5 w-3/4 animate-pulse rounded bg-gray-200" />
                      <div className="h-2.5 w-1/2 animate-pulse rounded bg-gray-100" />
                    </div>
                  </div>
                ))}
              </div>
            )}

            {!isLoading && query && allHits.length === 0 && (
              <div className="py-8 text-center text-sm text-gray-500">
                No results for &ldquo;{query}&rdquo;
              </div>
            )}

            {!isLoading && allHits.length > 0 && (
              <div className="p-2">
                {Object.entries(results!.results).map(([collection, data]) => {
                  if (data.hits.length === 0) return null
                  return (
                    <div key={collection}>
                      <p className="px-3 pb-1 pt-2 text-xs font-semibold uppercase tracking-wider text-gray-400">
                        {collection}s
                      </p>
                      {data.hits.map((hit) => {
                        const globalIndex = allHits.indexOf(hit)
                        return (
                          <SearchResult
                            key={hit.id}
                            hit={hit}
                            selected={globalIndex === selectedIndex}
                            onClick={() => navigateToResult(hit)}
                          />
                        )
                      })}
                    </div>
                  )
                })}
              </div>
            )}

            {!query && (
              <div className="py-8 text-center text-sm text-gray-400">
                Start typing to search...
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center justify-between border-t border-gray-100 px-4 py-2">
            <div className="flex gap-2 text-xs text-gray-400">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">↑↓</kbd>
              <span>navigate</span>
              <kbd className="ml-1 rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">↵</kbd>
              <span>open</span>
            </div>
            <div className="text-xs text-gray-400">
              <kbd className="rounded border border-gray-200 bg-gray-50 px-1.5 py-0.5 font-mono text-[10px]">esc</kbd>
              <span className="ml-1">close</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
