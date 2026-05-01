import { Badge } from '@/components/ui/Badge'
import { FileText } from 'lucide-react'
import type { SearchHit } from './useSearch'

interface SearchResultProps {
  hit: SearchHit
  selected: boolean
  onClick: () => void
}

export function SearchResult({ hit, selected, onClick }: SearchResultProps) {
  return (
    <button
      className={`flex w-full items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors ${
        selected ? 'bg-gray-100' : 'hover:bg-gray-50'
      }`}
      onClick={onClick}
    >
      <FileText size={16} className="shrink-0 text-gray-400" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate text-sm font-medium text-gray-900">
            {hit.title || 'Untitled'}
          </span>
          <Badge>{hit.collection}</Badge>
        </div>
        {hit.excerpt && (
          <p
            className="mt-0.5 truncate text-xs text-gray-500"
            dangerouslySetInnerHTML={{ __html: hit.excerpt }}
          />
        )}
      </div>
    </button>
  )
}
