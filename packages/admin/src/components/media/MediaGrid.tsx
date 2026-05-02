import { MediaCard } from './MediaCard'

interface MediaItem {
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

interface Props {
  items: MediaItem[]
  selectedId?: string | null
  onSelect: (media: MediaItem) => void
  draggable?: boolean
}

export function MediaGrid({ items, selectedId, onSelect, draggable }: Props) {
  if (items.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
        <p className="text-sm text-gray-500">No media files yet. Upload some above.</p>
      </div>
    )
  }

  return (
    <div className="grid grid-cols-3 gap-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => (
        <MediaCard
          key={item.id}
          media={item}
          selected={selectedId === item.id}
          onClick={() => onSelect(item)}
          draggable={draggable}
        />
      ))}
    </div>
  )
}
