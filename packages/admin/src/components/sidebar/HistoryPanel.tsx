import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { RotateCcw, Eye } from 'lucide-react'

interface Revision {
  id: string
  createdAt: string
  createdBy: { id: string; name: string } | null
  label: string
}

interface RevisionDetail {
  id: string
  data: Record<string, unknown>
  createdAt: string
  createdBy: { id: string; name: string } | null
}

interface Props {
  collection: string
  documentId: string | null
  onRestore: () => void
}

export function HistoryPanel({ collection, documentId, onRestore }: Props) {
  const queryClient = useQueryClient()
  const [previewId, setPreviewId] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['revisions', collection, documentId],
    queryFn: () =>
      api<{ data: Revision[] }>(`/${collection}/${documentId}/revisions`),
    enabled: !!documentId,
  })

  const { data: previewData } = useQuery({
    queryKey: ['revision-detail', collection, documentId, previewId],
    queryFn: () =>
      api<{ data: RevisionDetail }>(`/${collection}/${documentId}/revisions/${previewId}`),
    enabled: !!previewId && !!documentId,
  })

  const restoreMutation = useMutation({
    mutationFn: (revId: string) =>
      api(`/${collection}/${documentId}/revisions/${revId}/restore`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['revisions', collection, documentId] })
      queryClient.invalidateQueries({ queryKey: ['document', collection, documentId] })
      setPreviewId(null)
      onRestore()
    },
  })

  const revisions = data?.data ?? []

  if (!documentId) {
    return (
      <div className="text-sm text-gray-500">
        Save the document to start tracking revisions.
      </div>
    )
  }

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-semibold text-gray-900">Revision History</h3>

      {isLoading ? (
        <p className="text-xs text-gray-400">Loading…</p>
      ) : revisions.length === 0 ? (
        <p className="text-xs text-gray-400">No revisions yet. Revisions are created on each save.</p>
      ) : (
        <div className="space-y-1.5 max-h-[400px] overflow-y-auto">
          {revisions.map((rev, idx) => (
            <div
              key={rev.id}
              className={`rounded-md border px-3 py-2 text-xs ${
                previewId === rev.id
                  ? 'border-gray-900 bg-gray-50'
                  : 'border-gray-200 hover:border-gray-300'
              }`}
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-700">
                    {formatDate(rev.createdAt)}
                  </p>
                  <p className="text-gray-500">
                    {rev.createdBy?.name || 'System'}
                    {idx === 0 && (
                      <span className="ml-1.5"><Badge>Latest</Badge></span>
                    )}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button
                    onClick={() => setPreviewId(previewId === rev.id ? null : rev.id)}
                    className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                    title="Preview"
                  >
                    <Eye size={14} />
                  </button>
                  {idx > 0 && (
                    <button
                      onClick={() => {
                        if (confirm(`Restore to version from ${formatDate(rev.createdAt)}? Current content will be saved as a new revision.`)) {
                          restoreMutation.mutate(rev.id)
                        }
                      }}
                      className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                      title="Restore this version"
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Preview panel */}
              {previewId === rev.id && previewData?.data && (
                <div className="mt-2 rounded border border-gray-200 bg-white p-2 text-xs">
                  <p className="mb-1 font-medium text-gray-600">Snapshot:</p>
                  <pre className="max-h-40 overflow-auto whitespace-pre-wrap text-gray-500">
                    {JSON.stringify(previewData.data.data, null, 2).slice(0, 2000)}
                  </pre>
                  {idx > 0 && (
                    <Button
                      size="sm"
                      className="mt-2 w-full"
                      onClick={() => {
                        if (confirm('Restore this version?')) {
                          restoreMutation.mutate(rev.id)
                        }
                      }}
                      disabled={restoreMutation.isPending}
                    >
                      <RotateCcw size={14} className="mr-1" />
                      {restoreMutation.isPending ? 'Restoring…' : 'Restore this version'}
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
