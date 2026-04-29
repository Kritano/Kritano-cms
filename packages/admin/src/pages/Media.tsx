import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MediaGrid } from '@/components/media/MediaGrid'
import { MediaUploader } from '@/components/media/MediaUploader'
import { MediaDetail } from '@/components/media/MediaDetail'

export function Media() {
  const [selectedMedia, setSelectedMedia] = useState<any>(null)

  const { data, refetch } = useQuery({
    queryKey: ['media'],
    queryFn: () => api<any>('/media?limit=100'),
  })

  const items = (data?.data || []) as any[]

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>

      <MediaUploader onUploadComplete={() => refetch()} />

      <MediaGrid
        items={items}
        selectedId={selectedMedia?.id}
        onSelect={(media) => setSelectedMedia(media)}
      />

      {selectedMedia && (
        <MediaDetail
          media={selectedMedia}
          onClose={() => setSelectedMedia(null)}
        />
      )}
    </div>
  )
}
