import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { ExternalLink, Eye, Calendar, X } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
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
  collection?: string
  documentId?: string | null
}

function statusVariant(status: string): 'success' | 'warning' | 'default' {
  if (status === 'published') return 'success'
  if (status === 'scheduled') return 'warning'
  return 'default'
}

function statusLabel(status: string): string {
  if (status === 'published') return 'Published'
  if (status === 'scheduled') return 'Scheduled'
  return 'Draft'
}

export function PublishPanel({
  status,
  createdAt,
  updatedAt,
  publishedAt,
  onPublish,
  onUnpublish,
  loading,
  previewUrl,
  collection,
  documentId,
}: Props) {
  const queryClient = useQueryClient()
  const [showScheduler, setShowScheduler] = useState(false)
  const [scheduleDate, setScheduleDate] = useState('')
  const [scheduleTime, setScheduleTime] = useState('09:00')
  const [scheduleTz, setScheduleTz] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone)

  // Fetch current schedule
  const { data: scheduleData } = useQuery({
    queryKey: ['schedule', collection, documentId],
    queryFn: () => api<{ data: any }>(`/${collection}/${documentId}/schedule`),
    enabled: !!collection && !!documentId,
  })

  const scheduleMutation = useMutation({
    mutationFn: () =>
      api(`/${collection}/${documentId}/schedule`, {
        method: 'POST',
        body: {
          scheduledFor: `${scheduleDate}T${scheduleTime}:00`,
          timezone: scheduleTz,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', collection, documentId] })
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      queryClient.invalidateQueries({ queryKey: ['document', collection, documentId] })
      setShowScheduler(false)
    },
  })

  const cancelScheduleMutation = useMutation({
    mutationFn: () =>
      api(`/${collection}/${documentId}/schedule`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule', collection, documentId] })
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      queryClient.invalidateQueries({ queryKey: ['document', collection, documentId] })
    },
  })

  const currentSchedule = scheduleData?.data

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">Publish</h3>
        <Badge variant={statusVariant(status)}>
          {statusLabel(status)}
        </Badge>
      </div>

      {/* Action buttons */}
      {status === 'scheduled' && currentSchedule ? (
        <div className="space-y-2">
          <div className="rounded-md bg-amber-50 p-3 text-sm">
            <p className="font-medium text-amber-800">Scheduled for</p>
            <p className="text-amber-700">{formatDate(currentSchedule.scheduled_for)}</p>
            <p className="text-xs text-amber-600">{currentSchedule.timezone}</p>
          </div>
          <Button
            variant="secondary"
            className="w-full"
            onClick={() => cancelScheduleMutation.mutate()}
            disabled={cancelScheduleMutation.isPending}
          >
            <X size={14} className="mr-1.5" />
            {cancelScheduleMutation.isPending ? 'Cancelling…' : 'Cancel schedule'}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <div className="flex gap-2">
            {status === 'draft' || status === 'scheduled' ? (
              <Button onClick={onPublish} className="flex-1" disabled={loading}>
                {loading ? 'Publishing…' : 'Publish now'}
              </Button>
            ) : (
              <Button variant="secondary" onClick={onUnpublish} className="flex-1" disabled={loading}>
                {loading ? 'Unpublishing…' : 'Unpublish'}
              </Button>
            )}
            {previewUrl && status === 'published' && (
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
            {previewUrl && documentId && (
              <button
                onClick={async () => {
                  try {
                    const data = await api<{ token: string }>('/preview/token', {
                      method: 'POST',
                      body: { documentId, collection },
                    })
                    const url = `${previewUrl}?cms_preview=${data.token}`
                    window.open(url, '_blank')
                  } catch {}
                }}
                className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                <Eye size={14} />
                Preview
              </button>
            )}
          </div>

          {/* Schedule option — only for non-published docs with an ID */}
          {status !== 'published' && collection && documentId && (
            <>
              {!showScheduler ? (
                <button
                  onClick={() => setShowScheduler(true)}
                  className="flex w-full items-center justify-center gap-1.5 rounded-md border border-gray-200 px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                >
                  <Calendar size={14} />
                  Schedule for later
                </button>
              ) : (
                <div className="space-y-2 rounded-md border border-gray-200 p-3">
                  <div className="flex gap-2">
                    <input
                      type="date"
                      value={scheduleDate}
                      onChange={(e) => setScheduleDate(e.target.value)}
                      className="flex-1 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                    <input
                      type="time"
                      value={scheduleTime}
                      onChange={(e) => setScheduleTime(e.target.value)}
                      className="w-24 rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                    />
                  </div>
                  <select
                    value={scheduleTz}
                    onChange={(e) => setScheduleTz(e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-2 py-1.5 text-sm"
                  >
                    {['UTC', 'Europe/London', 'Europe/Paris', 'Europe/Berlin', 'America/New_York', 'America/Chicago', 'America/Denver', 'America/Los_Angeles', 'Asia/Tokyo', 'Australia/Sydney'].map((tz) => (
                      <option key={tz} value={tz}>{tz}</option>
                    ))}
                  </select>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => scheduleMutation.mutate()}
                      disabled={!scheduleDate || scheduleMutation.isPending}
                    >
                      {scheduleMutation.isPending ? 'Scheduling…' : 'Schedule'}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowScheduler(false)}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

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
