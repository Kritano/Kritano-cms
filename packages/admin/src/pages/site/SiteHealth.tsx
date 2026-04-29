import { useQuery, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { KritanoConnect } from '@/components/kritano/KritanoConnect'
import { KritanoHealth } from '@/components/kritano/KritanoHealth'

export function SiteHealth() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['kritano', 'status'],
    queryFn: () => api<any>('/kritano/status', { auth: false }),
  })

  function handleRunAudit() {
    // In production: POST to Kritano API to trigger audit
    // For dev, just refetch status
    queryClient.invalidateQueries({ queryKey: ['kritano', 'status'] })
  }

  if (isLoading) {
    return <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
  }

  const connected = data?.connected
  const scores = data?.scores
  const lastAudit = data?.lastAudit

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Site Health</h2>

      {connected ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <KritanoHealth
            scores={scores}
            lastAudit={lastAudit}
            onRunAudit={handleRunAudit}
          />
        </div>
      ) : (
        <KritanoConnect
          onConnected={() => queryClient.invalidateQueries({ queryKey: ['kritano', 'status'] })}
        />
      )}
    </div>
  )
}
