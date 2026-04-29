import { ExternalLink } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { formatDate } from '@/lib/utils'

interface Props {
  status: string
  createdAt: string | null
  updatedAt: string | null
  publishedAt: string | null
  onPublish: () => void
  onUnpublish: () => void
  loading?: boolean
  previewUrl?: string | null
}

export function PublishPanel({ status, createdAt, updatedAt, publishedAt, onPublish, onUnpublish, loading, previewUrl }: Props) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Publish</h3>
        <Badge variant={status === 'published' ? 'success' : 'default'}>
          {status === 'published' ? 'Published' : 'Draft'}
        </Badge>
      </div>

      <div className="flex gap-2">
        {status === 'draft' ? (
          <Button onClick={onPublish} className="flex-1" disabled={loading}>
            {loading ? 'Publishing…' : 'Publish'}
          </Button>
        ) : (
          <Button variant="secondary" onClick={onUnpublish} className="flex-1" disabled={loading}>
            {loading ? 'Unpublishing…' : 'Unpublish'}
          </Button>
        )}
        {previewUrl && (
          <a
            href={previewUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={14} />
            View
          </a>
        )}
      </div>

      <dl className="space-y-2 text-sm">
        {createdAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Created</dt>
            <dd className="text-gray-700">{formatDate(createdAt)}</dd>
          </div>
        )}
        {updatedAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Updated</dt>
            <dd className="text-gray-700">{formatDate(updatedAt)}</dd>
          </div>
        )}
        {publishedAt && (
          <div className="flex justify-between">
            <dt className="text-gray-500">Published</dt>
            <dd className="text-gray-700">{formatDate(publishedAt)}</dd>
          </div>
        )}
      </dl>
    </div>
  )
}
