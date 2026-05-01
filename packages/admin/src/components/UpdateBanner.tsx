import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { ArrowUp, X } from 'lucide-react'

interface UpdateCheckResult {
  mode: 'development' | 'release'
  updateAvailable: boolean
  current: { sha?: string; shortSha?: string; version?: string }
  latest: { sha?: string; shortSha?: string; commitsAhead?: number; version?: string }
  updateType?: string
  dismissed?: boolean
}

export function UpdateBanner() {
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['update-check'],
    queryFn: () => api<UpdateCheckResult>('/admin/updates/check'),
    staleTime: 60 * 60 * 1000, // 1 hour
    retry: false,
  })

  const dismissMutation = useMutation({
    mutationFn: () => api('/admin/updates/dismiss', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['update-check'] })
    },
  })

  if (!data?.updateAvailable || data.dismissed) return null

  const isDev = data.mode === 'development'
  const commitsAhead = data.latest.commitsAhead || 0

  return (
    <div className="mb-4 flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
      <div className="flex items-center gap-2">
        <ArrowUp size={16} className="text-blue-600" />
        <span className="text-sm text-blue-800">
          {isDev
            ? `CMS update available — ${commitsAhead} new commit${commitsAhead !== 1 ? 's' : ''} since your last update.`
            : `CMS ${data.latest.version} available (you're on ${data.current.version} — ${data.updateType} update).`
          }
        </span>
      </div>

      <div className="flex items-center gap-3">
        {isDev && (
          <a
            href={`https://github.com/Kritano/Kritano-cms/commits/main`}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm font-medium text-blue-700 hover:text-blue-900"
          >
            View changes
          </a>
        )}
        <button
          onClick={() => dismissMutation.mutate()}
          className="text-blue-400 hover:text-blue-600"
          title="Dismiss for 7 days"
        >
          <X size={16} />
        </button>
      </div>
    </div>
  )
}

/** Returns the commit count for the sidebar badge, or 0 if no update */
export function useUpdateCount(): number {
  const { data } = useQuery({
    queryKey: ['update-check'],
    queryFn: () => api<UpdateCheckResult>('/admin/updates/check'),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  if (!data?.updateAvailable) return 0
  return data.latest.commitsAhead || (data.updateAvailable ? 1 : 0)
}
