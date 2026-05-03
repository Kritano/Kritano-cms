import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { BlockPreviewFallback } from '@/components/blocks/BlockPreviewFallback'
import { Search, Layers } from 'lucide-react'
import type { FieldDefinition } from '@kritano/cms/types'

interface BlockField {
  name: string
  type: string
  required: boolean
  nullable: boolean
  notes: string
}

interface BlockInfo {
  name: string
  description: string | null
  fields: BlockField[]
  usedIn: Array<{ collection: string; fieldName: string }>
}

interface BlocksResponse {
  blocks: Record<string, BlockInfo>
  stats: {
    totalBlocks: number
    collectionsWithBlocks: number
  }
}

function formatBlockName(name: string): string {
  return name
    .replace(/[-_]/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b\w/g, (c) => c.toUpperCase())
}

function fieldsToDefinitions(fields: BlockField[]): Record<string, FieldDefinition> {
  const defs: Record<string, FieldDefinition> = {}
  for (const f of fields) {
    defs[f.name] = { type: f.type as any, required: f.required, nullable: f.nullable }
  }
  return defs
}

function highlightMatch(text: string, query: string): React.ReactNode {
  if (!query) return text
  const idx = text.toLowerCase().indexOf(query.toLowerCase())
  if (idx === -1) return text
  return (
    <>
      {text.slice(0, idx)}
      <mark className="rounded bg-yellow-100 px-0.5">{text.slice(idx, idx + query.length)}</mark>
      {text.slice(idx + query.length)}
    </>
  )
}

export function BlockLibrary() {
  const [search, setSearch] = useState('')
  const [collectionFilter, setCollectionFilter] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['admin-blocks'],
    queryFn: () => api<BlocksResponse>('/admin/blocks'),
    staleTime: 5 * 60 * 1000,
  })

  const allBlocks = Object.values(data?.blocks ?? {})
  const stats = data?.stats

  // Get unique collections that have blocks
  const collectionsWithBlocks = [...new Set(allBlocks.flatMap((b) => b.usedIn.map((u) => u.collection)))]

  // Filter
  const filtered = allBlocks.filter((block) => {
    // Collection filter
    if (collectionFilter && !block.usedIn.some((u) => u.collection === collectionFilter)) {
      return false
    }

    // Search
    if (!search) return true
    const q = search.toLowerCase()
    return (
      block.name.toLowerCase().includes(q) ||
      (block.description || '').toLowerCase().includes(q) ||
      block.fields.some((f) => f.name.toLowerCase().includes(q))
    )
  })

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Block Library</h2>
        {stats && (
          <p className="mt-1 text-sm text-gray-500">
            {stats.totalBlocks} block type{stats.totalBlocks !== 1 ? 's' : ''} defined across {stats.collectionsWithBlocks} collection{stats.collectionsWithBlocks !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* Search + Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search blocks..."
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
        {collectionsWithBlocks.length > 1 && (
          <select
            value={collectionFilter || ''}
            onChange={(e) => setCollectionFilter(e.target.value || null)}
            className="rounded-md border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">All collections ({allBlocks.length})</option>
            {collectionsWithBlocks.map((col) => {
              const count = allBlocks.filter((b) => b.usedIn.some((u) => u.collection === col)).length
              return (
                <option key={col} value={col}>
                  {col.charAt(0).toUpperCase() + col.slice(1)} ({count})
                </option>
              )
            })}
          </select>
        )}
      </div>

      {/* Loading */}
      {isLoading && <div className="py-8 text-center text-sm text-gray-500">Loading blocks...</div>}

      {/* Empty */}
      {!isLoading && filtered.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Layers size={40} className="mx-auto mb-3 text-gray-300" />
          {search || collectionFilter ? (
            <p className="text-sm text-gray-500">No blocks match your search.</p>
          ) : (
            <>
              <p className="text-sm font-medium text-gray-900">No blocks defined</p>
              <p className="mt-1 text-sm text-gray-500">
                Add blocks to your collections using the <code className="rounded bg-gray-100 px-1 text-xs">blocks()</code> field type.
              </p>
            </>
          )}
        </div>
      )}

      {/* Block cards */}
      {!isLoading && filtered.length > 0 && (
        <div className="space-y-6">
          {filtered.map((block) => (
            <div
              key={block.name}
              id={`block-${block.name}`}
              className="overflow-hidden rounded-lg border border-gray-200 bg-white"
            >
              {/* Preview */}
              <div className="border-b border-gray-100 bg-gray-50">
                <div className="mx-auto max-w-md py-4">
                  <BlockPreviewFallback fields={fieldsToDefinitions(block.fields)} />
                </div>
              </div>

              {/* Info */}
              <div className="p-6">
                <div className="flex items-start justify-between">
                  <div>
                    <h3 className="text-base font-semibold text-gray-900">
                      {highlightMatch(formatBlockName(block.name), search)}
                    </h3>
                    {block.description && (
                      <p className="mt-1 text-sm text-gray-600">
                        {highlightMatch(block.description, search)}
                      </p>
                    )}
                  </div>
                </div>

                {/* Fields table */}
                {block.fields.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-2 text-xs font-semibold uppercase tracking-wider text-gray-400">Fields</h4>
                    <div className="overflow-hidden rounded-md border border-gray-200">
                      <table className="min-w-full divide-y divide-gray-200 text-sm">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Type</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Required</th>
                            <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Notes</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {block.fields.map((field) => (
                            <tr key={field.name} className="hover:bg-gray-50">
                              <td className="px-3 py-1.5 font-mono text-xs text-gray-900">
                                {highlightMatch(field.name, search)}
                              </td>
                              <td className="px-3 py-1.5">
                                <Badge>{field.type}</Badge>
                              </td>
                              <td className="px-3 py-1.5 text-xs text-gray-500">
                                {field.required ? 'Yes' : 'No'}
                              </td>
                              <td className="px-3 py-1.5 text-xs text-gray-400">{field.notes || '—'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}

                {/* Used in */}
                {block.usedIn.length > 0 && (
                  <div className="mt-4">
                    <h4 className="mb-1.5 text-xs font-semibold uppercase tracking-wider text-gray-400">Used in</h4>
                    <div className="flex flex-wrap gap-2">
                      {block.usedIn.map((u, i) => (
                        <span key={i} className="text-sm text-gray-600">
                          {u.collection.charAt(0).toUpperCase() + u.collection.slice(1)} <span className="text-gray-400">({u.fieldName})</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
