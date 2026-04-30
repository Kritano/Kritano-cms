import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'

interface Activity {
  id: string
  user_id: string | null
  user_name: string | null
  user_email: string | null
  action: string
  resource: string
  resource_id: string | null
  metadata: Record<string, unknown> | null
  created_at: string
}

const ACTION_LABELS: Record<string, string> = {
  'document.created': 'Created',
  'document.updated': 'Updated',
  'document.published': 'Published',
  'document.unpublished': 'Unpublished',
  'document.deleted': 'Deleted',
  'media.uploaded': 'Uploaded media',
  'media.deleted': 'Deleted media',
  'user.invited': 'Invited user',
  'user.created': 'User joined',
  'user.role_changed': 'Role changed',
  'user.deleted': 'Deactivated user',
  'user.2fa_enabled': 'Enabled 2FA',
  'user.2fa_disabled': 'Disabled 2FA',
  'role.created': 'Created role',
  'role.updated': 'Updated role',
  'role.deleted': 'Deleted role',
  'settings.updated': 'Updated settings',
}

function actionVariant(action: string): 'default' | 'success' | 'warning' | 'danger' {
  if (action.includes('deleted') || action.includes('disabled')) return 'danger'
  if (action.includes('published') || action.includes('created')) return 'success'
  if (action.includes('invited') || action.includes('enabled')) return 'warning'
  return 'default'
}

export function ActivityLog() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['activity', page],
    queryFn: () =>
      api<{ data: Activity[]; total: number; totalPages: number }>(`/admin/activity?page=${page}&limit=50`),
  })

  const activities = data?.data ?? []
  const totalPages = data?.totalPages ?? 1

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Activity Log</h1>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : activities.length === 0 ? (
        <p className="text-sm text-gray-500">No activity recorded yet.</p>
      ) : (
        <div className="space-y-2">
          {activities.map((activity) => (
            <div
              key={activity.id}
              className="flex items-start gap-4 rounded-lg border border-gray-200 bg-white px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">
                    {activity.user_name || activity.user_email || 'System'}
                  </span>
                  <Badge variant={actionVariant(activity.action)}>
                    {ACTION_LABELS[activity.action] || activity.action}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-gray-500">
                  {activity.resource}
                  {activity.metadata && (activity.metadata as Record<string, unknown>).title
                    ? `: ${(activity.metadata as Record<string, unknown>).title}`
                    : activity.metadata && (activity.metadata as Record<string, unknown>).email
                      ? `: ${(activity.metadata as Record<string, unknown>).email}`
                      : activity.metadata && (activity.metadata as Record<string, unknown>).name
                        ? `: ${(activity.metadata as Record<string, unknown>).name}`
                        : ''}
                </p>
              </div>
              <span className="shrink-0 text-xs text-gray-400">{formatDate(activity.created_at)}</span>
            </div>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <Button
            variant="secondary"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </Button>
          <span className="text-sm text-gray-500">
            Page {page} of {totalPages}
          </span>
          <Button
            variant="secondary"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  )
}
