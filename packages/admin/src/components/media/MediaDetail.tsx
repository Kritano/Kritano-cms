import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { X, Copy, Trash2, FileText } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'

interface MediaItem {
  id: string
  filename: string
  original_filename: string
  mime_type: string
  size: number
  width: number | null
  height: number | null
  alt: string | null
  url: string
}

interface Props {
  media: MediaItem
  onClose: () => void
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

export function MediaDetail({ media, onClose }: Props) {
  const [alt, setAlt] = useState(media.alt || '')
  const [copied, setCopied] = useState(false)
  const queryClient = useQueryClient()

  const { data: usageData } = useQuery({
    queryKey: ['media-usage', media.id],
    queryFn: () => api<{ data: { id: string; title: string; collection: string }[] }>(`/media/${media.id}/usage`),
  })
  const usedIn = usageData?.data ?? []

  const updateAlt = useMutation({
    mutationFn: () => api(`/media/${media.id}`, { method: 'PATCH', body: { alt } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['media'] }),
  })

  const deleteMutation = useMutation({
    mutationFn: () => api(`/media/${media.id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      onClose()
    },
  })

  function copyUrl() {
    navigator.clipboard.writeText(media.url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  function handleDelete() {
    if (confirm('Delete this file? This cannot be undone.')) {
      deleteMutation.mutate()
    }
  }

  const isImage = media.mime_type.startsWith('image/')

  return (
    <div className="fixed inset-y-0 right-0 z-50 flex w-96 flex-col border-l border-gray-200 bg-white shadow-xl">
      <div className="flex items-center justify-between border-b border-gray-200 px-4 py-3">
        <h3 className="text-sm font-semibold text-gray-900">Media details</h3>
        <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
          <X size={18} />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* Preview */}
        {isImage && (
          <div className="overflow-hidden rounded-md bg-gray-100">
            <img src={media.url} alt={media.alt || ''} className="w-full" />
          </div>
        )}

        {/* Alt text */}
        <div>
          <Input
            label="Alt text"
            value={alt}
            onChange={(e) => setAlt(e.target.value)}
            onBlur={() => updateAlt.mutate()}
            placeholder="Describe this image"
          />
        </div>

        {/* Details */}
        <dl className="space-y-2 text-sm">
          <div className="flex justify-between">
            <dt className="text-gray-500">Filename</dt>
            <dd className="text-gray-700 truncate ml-4">{media.original_filename}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Type</dt>
            <dd className="text-gray-700">{media.mime_type}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-gray-500">Size</dt>
            <dd className="text-gray-700">{formatSize(media.size)}</dd>
          </div>
          {media.width && media.height && (
            <div className="flex justify-between">
              <dt className="text-gray-500">Dimensions</dt>
              <dd className="text-gray-700">{media.width} × {media.height}</dd>
            </div>
          )}
        </dl>

        {/* URL copy */}
        <button
          onClick={copyUrl}
          className="flex w-full items-center gap-2 rounded-md border border-gray-200 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
        >
          <Copy size={14} />
          {copied ? 'Copied!' : 'Copy URL'}
        </button>
      </div>

      <div className="border-t border-gray-200 p-4 space-y-3">
        {/* Usage tracking */}
        <div>
          <p className="text-xs font-medium text-gray-500 mb-1.5">
            <FileText size={12} className="inline mr-1" />
            Used in {usedIn.length} document{usedIn.length !== 1 ? 's' : ''}
          </p>
          {usedIn.length > 0 && (
            <div className="space-y-1 max-h-24 overflow-y-auto">
              {usedIn.map((doc) => (
                <Link
                  key={`${doc.collection}-${doc.id}`}
                  to="/admin/$collection/$id"
                  params={{ collection: doc.collection, id: doc.id }}
                  className="block text-xs text-gray-600 hover:text-gray-900 hover:underline"
                >
                  {doc.title} ({doc.collection})
                </Link>
              ))}
            </div>
          )}
        </div>

        <Button variant="danger" className="w-full" onClick={handleDelete} disabled={deleteMutation.isPending}>
          <Trash2 size={16} className="mr-1.5" />
          {usedIn.length > 0 ? `Delete (used in ${usedIn.length} doc${usedIn.length !== 1 ? 's' : ''})` : 'Delete file'}
        </Button>
      </div>
    </div>
  )
}
