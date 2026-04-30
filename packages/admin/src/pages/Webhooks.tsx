import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate, truncate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2, X, Send, ChevronRight } from 'lucide-react'

const WEBHOOK_EVENTS = [
  'content.created',
  'content.updated',
  'content.published',
  'content.unpublished',
  'content.deleted',
  'media.uploaded',
  'media.deleted',
  'form.submitted',
  'user.created',
]

interface Webhook {
  id: string
  name: string
  url: string
  secret: string | null
  events: string[]
  active: boolean
  delivery_count: number
  last_delivery_success: boolean | null
  created_at: string
}

interface Delivery {
  id: string
  event: string
  payload: Record<string, unknown>
  response_code: number | null
  response_body: string | null
  duration_ms: number | null
  success: boolean
  attempt: number
  created_at: string
}

export function Webhooks() {
  const queryClient = useQueryClient()
  const [panel, setPanel] = useState<'closed' | 'new' | 'edit' | 'deliveries'>('closed')
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [url, setUrl] = useState('')
  const [secret, setSecret] = useState('')
  const [events, setEvents] = useState<string[]>([])
  const [error, setError] = useState('')
  const [testResult, setTestResult] = useState<{ success: boolean; responseCode: number | null; durationMs: number } | null>(null)
  const [deliveryDetail, setDeliveryDetail] = useState<Delivery | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['webhooks'],
    queryFn: () => api<{ data: Webhook[] }>('/admin/webhooks'),
  })

  const { data: deliveriesData } = useQuery({
    queryKey: ['webhook-deliveries', selectedId],
    queryFn: () => api<{ data: Delivery[]; total: number }>(`/admin/webhooks/${selectedId}/deliveries?limit=50`),
    enabled: panel === 'deliveries' && !!selectedId,
  })

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, url, secret: secret || null, events }
      if (panel === 'new') return api('/admin/webhooks', { method: 'POST', body })
      return api(`/admin/webhooks/${selectedId}`, { method: 'PUT', body })
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['webhooks'] })
      closePanel()
    },
    onError: (err: any) => setError(err.message || 'Failed to save webhook'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/webhooks/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api(`/admin/webhooks/${id}`, { method: 'PUT', body: { active } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['webhooks'] }),
  })

  const testMutation = useMutation({
    mutationFn: (id: string) =>
      api<{ data: { success: boolean; responseCode: number | null; durationMs: number } }>(
        `/admin/webhooks/${id}/test`,
        { method: 'POST' },
      ),
    onSuccess: (result) => {
      setTestResult(result.data)
      queryClient.invalidateQueries({ queryKey: ['webhook-deliveries', selectedId] })
    },
  })

  const webhooks = data?.data ?? []
  const deliveries = deliveriesData?.data ?? []

  function openNew() {
    setName('')
    setUrl('')
    setSecret('')
    setEvents([])
    setError('')
    setTestResult(null)
    setPanel('new')
    setSelectedId(null)
  }

  function openEdit(wh: Webhook) {
    setName(wh.name)
    setUrl(wh.url)
    setSecret(wh.secret || '')
    setEvents(wh.events)
    setError('')
    setTestResult(null)
    setPanel('edit')
    setSelectedId(wh.id)
  }

  function openDeliveries(wh: Webhook) {
    setSelectedId(wh.id)
    setPanel('deliveries')
    setDeliveryDetail(null)
    setTestResult(null)
  }

  function closePanel() {
    setPanel('closed')
    setSelectedId(null)
    setError('')
    setTestResult(null)
    setDeliveryDetail(null)
  }

  function toggleEvent(event: string) {
    setEvents((prev) => prev.includes(event) ? prev.filter((e) => e !== event) : [...prev, event])
  }

  return (
    <div className="flex gap-6">
      {/* Main list */}
      <div className="flex-1 min-w-0 space-y-4">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold text-gray-900">Webhooks</h1>
          <Button size="sm" onClick={openNew}>
            <Plus size={14} className="mr-1.5" />
            Add webhook
          </Button>
        </div>

        {isLoading ? (
          <p className="text-sm text-gray-500">Loading…</p>
        ) : webhooks.length === 0 ? (
          <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
            <p className="text-sm text-gray-500">No webhooks configured.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {webhooks.map((wh) => (
              <div
                key={wh.id}
                className="flex items-center gap-3 rounded-lg border border-gray-200 bg-white px-4 py-3 hover:border-gray-300"
              >
                {/* Status dot */}
                <div
                  className={`h-2.5 w-2.5 shrink-0 rounded-full ${
                    !wh.active ? 'bg-gray-300' :
                    wh.last_delivery_success === true ? 'bg-green-500' :
                    wh.last_delivery_success === false ? 'bg-red-500' :
                    'bg-gray-300'
                  }`}
                  title={!wh.active ? 'Inactive' : wh.last_delivery_success === true ? 'Last delivery succeeded' : wh.last_delivery_success === false ? 'Last delivery failed' : 'No deliveries yet'}
                />

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-900">{wh.name}</p>
                  <p className="text-xs text-gray-500 truncate">{wh.url}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {wh.events.map((e) => (
                      <Badge key={e}>{e}</Badge>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {/* Active toggle */}
                  <button
                    onClick={() => toggleMutation.mutate({ id: wh.id, active: !wh.active })}
                    className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                      wh.active ? 'bg-green-500' : 'bg-gray-300'
                    }`}
                  >
                    <span
                      className={`inline-block h-3.5 w-3.5 rounded-full bg-white transition-transform ${
                        wh.active ? 'translate-x-4.5' : 'translate-x-0.5'
                      }`}
                    />
                  </button>

                  <Button variant="ghost" size="sm" onClick={() => openDeliveries(wh)}>
                    <ChevronRight size={14} />
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => openEdit(wh)}>
                    Edit
                  </Button>
                  <button
                    onClick={() => {
                      if (confirm(`Delete webhook "${wh.name}"?`)) deleteMutation.mutate(wh.id)
                    }}
                    className="text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Side panel */}
      {panel !== 'closed' && (
        <div className="w-96 shrink-0 rounded-lg border border-gray-200 bg-white p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-medium text-gray-900">
              {panel === 'new' ? 'New Webhook' : panel === 'edit' ? 'Edit Webhook' : 'Delivery Log'}
            </h2>
            <button onClick={closePanel} className="text-gray-400 hover:text-gray-600">
              <X size={18} />
            </button>
          </div>

          {(panel === 'new' || panel === 'edit') && (
            <div className="space-y-4">
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Deploy trigger" />
              <Input label="URL" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://api.example.com/webhook" />
              <Input label="Secret (optional)" value={secret} onChange={(e) => setSecret(e.target.value)} placeholder="Signing secret for HMAC" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Subscribe to events</label>
                <div className="space-y-1.5">
                  {WEBHOOK_EVENTS.map((event) => (
                    <label key={event} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={events.includes(event)}
                        onChange={() => toggleEvent(event)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600">{event}</span>
                    </label>
                  ))}
                </div>
              </div>

              {error && <p className="text-sm text-red-600">{error}</p>}

              <div className="flex gap-2">
                {panel === 'edit' && selectedId && (
                  <Button
                    variant="secondary"
                    onClick={() => testMutation.mutate(selectedId)}
                    disabled={testMutation.isPending}
                  >
                    <Send size={14} className="mr-1.5" />
                    {testMutation.isPending ? 'Sending…' : 'Test'}
                  </Button>
                )}
                <Button
                  className="flex-1"
                  onClick={() => saveMutation.mutate()}
                  disabled={!name || !url || events.length === 0 || saveMutation.isPending}
                >
                  {saveMutation.isPending ? 'Saving…' : 'Save'}
                </Button>
              </div>

              {testResult && (
                <div className={`rounded-md p-3 text-sm ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  <p className="font-medium">{testResult.success ? 'Success' : 'Failed'}</p>
                  <p className="text-xs mt-0.5">
                    Status: {testResult.responseCode ?? 'Network error'} · {testResult.durationMs}ms
                  </p>
                </div>
              )}
            </div>
          )}

          {panel === 'deliveries' && (
            <div className="space-y-3">
              {selectedId && (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => testMutation.mutate(selectedId)}
                  disabled={testMutation.isPending}
                >
                  <Send size={14} className="mr-1.5" />
                  {testMutation.isPending ? 'Sending…' : 'Send test'}
                </Button>
              )}

              {testResult && (
                <div className={`rounded-md p-2 text-xs ${testResult.success ? 'bg-green-50 text-green-800' : 'bg-red-50 text-red-800'}`}>
                  {testResult.success ? 'Test succeeded' : 'Test failed'} · {testResult.responseCode ?? 'error'} · {testResult.durationMs}ms
                </div>
              )}

              {deliveries.length === 0 ? (
                <p className="text-sm text-gray-400">No deliveries yet.</p>
              ) : (
                <div className="space-y-1.5 max-h-[500px] overflow-y-auto">
                  {deliveries.map((d) => (
                    <div key={d.id}>
                      <button
                        onClick={() => setDeliveryDetail(deliveryDetail?.id === d.id ? null : d)}
                        className={`w-full text-left rounded-md border px-3 py-2 text-xs transition-colors ${
                          deliveryDetail?.id === d.id ? 'border-gray-900 bg-gray-50' : 'border-gray-200 hover:border-gray-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className={`h-1.5 w-1.5 rounded-full ${d.success ? 'bg-green-500' : 'bg-red-500'}`} />
                            <span className="font-medium text-gray-700">{d.event}</span>
                          </div>
                          <span className="text-gray-400">{formatDate(d.created_at)}</span>
                        </div>
                        <div className="mt-0.5 text-gray-500">
                          {d.response_code ?? 'error'} · {d.duration_ms ?? 0}ms · attempt {d.attempt}
                        </div>
                      </button>

                      {deliveryDetail?.id === d.id && (
                        <div className="ml-2 mt-1 rounded border border-gray-200 bg-white p-2 text-xs space-y-2">
                          <div>
                            <p className="font-medium text-gray-600">Payload</p>
                            <pre className="max-h-32 overflow-auto whitespace-pre-wrap text-gray-500 mt-0.5">
                              {JSON.stringify(d.payload, null, 2).slice(0, 1500)}
                            </pre>
                          </div>
                          {d.response_body && (
                            <div>
                              <p className="font-medium text-gray-600">Response</p>
                              <pre className="max-h-20 overflow-auto whitespace-pre-wrap text-gray-500 mt-0.5">
                                {d.response_body}
                              </pre>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
