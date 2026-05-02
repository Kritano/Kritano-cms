import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { api } from '@/lib/api'
import { MediaGrid } from './MediaGrid'
import { MediaUploader } from './MediaUploader'

interface Props {
  onSelect: (mediaId: string, url: string) => void
  onClose: () => void
}

export function MediaPicker({ onSelect, onClose }: Props) {
  const { data, refetch } = useQuery({
    queryKey: ['media', 'picker'],
    queryFn: () => api<any>('/media?limit=100'),
  })

  const items = (data?.data || []) as any[]

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div
        className="flex max-h-[80vh] w-full max-w-3xl flex-col rounded-lg bg-white shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
          <h3 className="text-sm font-semibold text-gray-900">Select media</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          <MediaUploader onUploadComplete={() => refetch()} />
          <MediaGrid
            items={items}
            onSelect={(media) => {
              onSelect(media.id, media.url)
              onClose()
            }}
          />
        </div>
      </div>
    </div>
  )
}
