import { Image as ImageIcon } from 'lucide-react'
import { truncate } from '@/lib/utils'

interface Props {
  media: {
    id: string
    filename: string
    original_filename: string
    mime_type: string
    size: number
    width: number | null
    height: number | null
    url: string
    thumbnail_url: string | null
  }
  selected?: boolean
  onClick: () => void
  draggable?: boolean
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function MediaCard({ media, selected, onClick, draggable }: Props) {
  const isImage = media.mime_type.startsWith('image/')
  const thumbUrl = media.thumbnail_url || media.url

  return (
    <button
      type="button"
      onClick={onClick}
      draggable={draggable}
      onDragStart={(e) => {
        if (draggable) e.dataTransfer.setData('text/media-id', media.id)
      }}
      className={`group relative flex flex-col overflow-hidden rounded-lg border text-left transition-all hover:shadow-md ${
        selected ? 'border-gray-900 ring-2 ring-gray-900' : 'border-gray-200'
      }`}
    >
      <div className="flex aspect-square items-center justify-center bg-gray-100">
        {isImage ? (
          <img src={thumbUrl} alt="" className="h-full w-full object-cover" />
        ) : (
          <ImageIcon size={32} className="text-gray-300" />
        )}
      </div>
      <div className="px-2.5 py-2">
        <p className="truncate text-xs font-medium text-gray-700">
          {truncate(media.original_filename, 30)}
        </p>
        <p className="text-xs text-gray-400">{formatSize(media.size)}</p>
      </div>
    </button>
  )
}
