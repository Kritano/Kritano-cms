import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  AlertTriangle,
  Database,
  Download,
  FileWarning,
  History,
  Search,
  ShieldCheck,
  Trash2,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { api } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { formatDate } from '@/lib/utils'

interface SourceMeta {
  name: string
  displayName: string
  table: string
  emailColumn: string
  identifierColumn?: string
  createdAtColumn?: string
  retentionPolicyDays?: number
  autoDiscovered: boolean
}

interface SearchRecord {
  id: string
  identifier?: string
  summary: string
  createdAt?: string
  data: Record<string, unknown>
}

interface SearchResult {
  source: string
  displayName: string
  records: SearchRecord[]
}

interface SearchResponse {
  emailHash: string
  results: SearchResult[]
  searchLogId: string | null
  totalRecords: number
}

interface DeletionResult {
  results: Array<{
    source: string
    displayName: string
    status: 'success' | 'failed' | 'skipped'
    recordsAttempted: number
    recordsDeleted: number
    recordsFailed: number
    failureReason?: string
    deletionLogIds: string[]
  }>
  summary: {
    totalAttempted: number
    totalDeleted: number
    totalFailed: number
    totalSkipped: number
  }
}

interface AuditLogEntry {
  kind: 'search' | 'deletion'
  id: string
  emailHash: string
  at: string
  userId: string | null
  source: string | null
  status: string | null
  rationale: string | null
  reason: string | null
  resultCount: number | null
  exported: boolean | null
}

interface NotConfiguredError {
  error: 'gdpr_not_configured'
  message: string
}

export function Gdpr() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [reason, setReason] = useState('')
  const [logAsSar, setLogAsSar] = useState(false)
  const [searchResponse, setSearchResponse] = useState<SearchResponse | null>(null)
  const [searchError, setSearchError] = useState<string | null>(null)
  const [setupHint, setSetupHint] = useState<string | null>(null)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deleteScope, setDeleteScope] = useState<{ kind: 'all' } | { kind: 'source'; source: string } | null>(null)
  const [deletionResult, setDeletionResult] = useState<DeletionResult | null>(null)
  const [expandedRecord, setExpandedRecord] = useState<string | null>(null)

  const sourcesQuery = useQuery({
    queryKey: ['gdpr-sources'],
    queryFn: async () => {
      try {
        return await api<{ sources: SourceMeta[] }>('/admin/gdpr/sources')
      } catch (err: unknown) {
        const e = err as Partial<NotConfiguredError> & { message?: string }
        if (e.error === 'gdpr_not_configured') {
          setSetupHint(e.message ?? 'GDPR_AUDIT_SECRET is not set.')
          return { sources: [] }
        }
        throw err
      }
    },
    retry: false,
  })

  const logQuery = useQuery({
    queryKey: ['gdpr-log'],
    queryFn: async () => {
      try {
        return await api<{ entries: AuditLogEntry[] }>('/admin/gdpr/log/recent?limit=50')
      } catch (err: unknown) {
        const e = err as Partial<NotConfiguredError>
        if (e.error === 'gdpr_not_configured') return { entries: [] }
        throw err
      }
    },
    retry: false,
  })

  const searchMutation = useMutation({
    mutationFn: () =>
      api<SearchResponse>('/admin/gdpr/search', {
        method: 'POST',
        body: { email, reason: reason || undefined, logAsSar },
      }),
    onSuccess: (data) => {
      setSearchResponse(data)
      setSearchError(null)
      queryClient.invalidateQueries({ queryKey: ['gdpr-log'] })
    },
    onError: (err: { message?: string }) => {
      setSearchError(err.message ?? 'Search failed')
      setSearchResponse(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (input: { rationale: string; method: 'hard_delete'; requestedBy: 'subject' | 'admin'; sources?: string[] }) =>
      api<DeletionResult>('/admin/gdpr/delete', {
        method: 'POST',
        body: {
          email,
          rationale: input.rationale,
          method: input.method,
          requestedBy: input.requestedBy,
          sources: input.sources,
        },
      }),
    onSuccess: (data) => {
      setDeletionResult(data)
      setShowDeleteModal(false)
      setDeleteScope(null)
      queryClient.invalidateQueries({ queryKey: ['gdpr-log'] })
      // Re-run the search so the UI reflects post-delete state.
      if (email) searchMutation.mutate()
    },
  })

  async function downloadExport(sources?: string[]) {
    if (!email) return
    const token = getAccessToken()
    const res = await fetch('/api/admin/gdpr/export', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ email, sources }),
    })
    if (!res.ok) {
      setSearchError(`Export failed: ${res.status} ${res.statusText}`)
      return
    }
    const blob = await res.blob()
    const disposition = res.headers.get('content-disposition') ?? ''
    const filenameMatch = disposition.match(/filename="([^"]+)"/)
    const filename = filenameMatch?.[1] ?? 'gdpr-export.json'
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
    queryClient.invalidateQueries({ queryKey: ['gdpr-log'] })
  }

  const sources = sourcesQuery.data?.sources ?? []
  const logEntries = logQuery.data?.entries ?? []
  const hasResults = searchResponse && searchResponse.totalRecords > 0

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-900">
            <ShieldCheck size={20} className="text-gray-600" />
            GDPR / Data Subject Rights
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Lookup, export, and erase personal data across all registered sources.
          </p>
        </div>
      </div>

      {setupHint && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4">
          <div className="flex items-start gap-3">
            <AlertTriangle size={20} className="mt-0.5 shrink-0 text-amber-600" />
            <div className="space-y-1">
              <p className="text-sm font-medium text-amber-900">GDPR module not configured</p>
              <p className="text-sm text-amber-800">{setupHint}</p>
            </div>
          </div>
        </div>
      )}

      {!setupHint && sources.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-4">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <Database size={16} />
            <span>
              {sources.length} personal-data {sources.length === 1 ? 'source' : 'sources'} registered
              ({sources.filter((s) => s.autoDiscovered).length} auto-discovered,
              {' '}
              {sources.filter((s) => !s.autoDiscovered).length} custom)
            </span>
          </div>
        </div>
      )}

      {/* Search form */}
      <div className="rounded-lg border border-gray-200 bg-white p-4">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (email.trim().length > 0) searchMutation.mutate()
          }}
          className="space-y-3"
        >
          <div className="flex gap-2">
            <div className="flex-1">
              <Input
                label="Look up by email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="alice@example.com"
                autoComplete="off"
              />
            </div>
            <div className="flex items-end">
              <Button type="submit" disabled={!email.trim() || searchMutation.isPending}>
                <Search size={16} className="mr-1.5" />
                {searchMutation.isPending ? 'Searching…' : 'Search'}
              </Button>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={logAsSar}
                onChange={(e) => setLogAsSar(e.target.checked)}
                className="h-4 w-4 rounded text-gray-900"
              />
              Log this search as a SAR response
            </label>
            <input
              type="text"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder='Reason (e.g. "Ticket #043")'
              className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-sm shadow-sm placeholder:text-gray-400 focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            />
          </div>
        </form>

        {searchError && (
          <p className="mt-3 rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{searchError}</p>
        )}
      </div>

      {/* Results */}
      {searchResponse && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm text-gray-700">
              {searchResponse.totalRecords === 0
                ? 'No records found for this email.'
                : `Found ${searchResponse.totalRecords} record(s) across ${searchResponse.results.length} source(s).`}{' '}
              <span className="text-gray-400">
                hash {searchResponse.emailHash.slice(0, 8)}…
              </span>
            </p>
            {hasResults && (
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" onClick={() => downloadExport()}>
                  <Download size={14} className="mr-1.5" />
                  Export all (SAR)
                </Button>
                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => {
                    setDeleteScope({ kind: 'all' })
                    setShowDeleteModal(true)
                  }}
                >
                  <Trash2 size={14} className="mr-1.5" />
                  Delete all
                </Button>
              </div>
            )}
          </div>

          {searchResponse.results.map((src) => (
            <div key={src.source} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-200 bg-gray-50 px-4 py-2">
                <div>
                  <p className="text-sm font-semibold text-gray-900">{src.displayName}</p>
                  <p className="text-xs text-gray-500">
                    {src.source} · {src.records.length} record(s)
                  </p>
                </div>
                <div className="flex gap-2">
                  <Button variant="secondary" size="sm" onClick={() => downloadExport([src.source])}>
                    <Download size={14} className="mr-1" />
                    Export
                  </Button>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      setDeleteScope({ kind: 'source', source: src.source })
                      setShowDeleteModal(true)
                    }}
                  >
                    <Trash2 size={14} className="mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
              <ul className="divide-y divide-gray-100">
                {src.records.map((rec) => {
                  const expanded = expandedRecord === `${src.source}:${rec.id}`
                  return (
                    <li key={rec.id} className="px-4 py-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">{rec.summary}</p>
                          <p className="mt-0.5 text-xs text-gray-500">
                            id {rec.id}
                            {rec.identifier && ` · ${rec.identifier}`}
                            {rec.createdAt && ` · ${formatDate(rec.createdAt)}`}
                          </p>
                        </div>
                        <button
                          onClick={() =>
                            setExpandedRecord(expanded ? null : `${src.source}:${rec.id}`)
                          }
                          className="text-xs font-medium text-gray-600 hover:text-gray-900"
                        >
                          {expanded ? 'Hide' : 'View'}
                        </button>
                      </div>
                      {expanded && (
                        <pre className="mt-2 max-h-64 overflow-auto rounded bg-gray-50 p-2 text-xs text-gray-700">
                          {JSON.stringify(rec.data, null, 2)}
                        </pre>
                      )}
                    </li>
                  )
                })}
              </ul>
            </div>
          ))}
        </div>
      )}

      {/* Last-deletion summary */}
      {deletionResult && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck size={20} className="mt-0.5 shrink-0 text-green-700" />
            <div className="flex-1 space-y-2">
              <p className="text-sm font-medium text-green-900">
                Deletion complete — {deletionResult.summary.totalDeleted} record(s) erased,
                {' '}
                {deletionResult.summary.totalFailed} failed across {deletionResult.results.length} source(s).
              </p>
              <ul className="space-y-0.5 text-xs text-green-800">
                {deletionResult.results.map((r) => (
                  <li key={r.source}>
                    {r.displayName}: {r.recordsDeleted}/{r.recordsAttempted} deleted
                    {r.recordsFailed > 0 && (
                      <span className="text-red-700"> · {r.recordsFailed} failed</span>
                    )}
                    {r.failureReason && (
                      <span className="text-red-700"> — {r.failureReason}</span>
                    )}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => setDeletionResult(null)}
                className="text-xs font-medium text-green-700 hover:text-green-900"
              >
                Dismiss
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Activity log */}
      <div className="rounded-lg border border-gray-200 bg-white">
        <div className="flex items-center gap-2 border-b border-gray-200 px-4 py-3">
          <History size={16} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-gray-900">Recent activity</h3>
          <span className="text-xs text-gray-500">last 50</span>
        </div>
        {logEntries.length === 0 ? (
          <div className="p-6 text-center text-sm text-gray-500">No activity yet.</div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {logEntries.map((e) => (
              <li key={`${e.kind}:${e.id}`} className="flex items-start gap-3 px-4 py-2.5 text-sm">
                <span className="mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-xs font-medium text-white"
                  style={{ backgroundColor: e.kind === 'search' ? '#475569' : '#b91c1c' }}>
                  {e.kind}
                </span>
                <span className="font-mono text-xs text-gray-400">{e.emailHash.slice(0, 8)}</span>
                <span className="flex-1 truncate text-gray-700">
                  {e.kind === 'search' && (
                    <>
                      {e.resultCount ?? 0} record(s) found
                      {e.exported && ' · exported'}
                      {e.reason && ` · ${e.reason}`}
                    </>
                  )}
                  {e.kind === 'deletion' && (
                    <>
                      {e.source ?? '(unknown source)'}
                      {e.status && ` · ${e.status}`}
                      {e.rationale && ` · ${e.rationale}`}
                    </>
                  )}
                </span>
                <span className="shrink-0 text-xs text-gray-400">{formatDate(e.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Deletion modal */}
      {showDeleteModal && deleteScope && searchResponse && (
        <DeleteConfirmation
          email={email}
          scope={deleteScope}
          results={searchResponse.results}
          isPending={deleteMutation.isPending}
          onCancel={() => {
            setShowDeleteModal(false)
            setDeleteScope(null)
          }}
          onConfirm={(input) =>
            deleteMutation.mutate({
              ...input,
              sources: deleteScope.kind === 'source' ? [deleteScope.source] : undefined,
            })
          }
          error={deleteMutation.error ? (deleteMutation.error as { message?: string }).message ?? 'Deletion failed' : null}
        />
      )}
    </div>
  )
}

interface DeleteConfirmationProps {
  email: string
  scope: { kind: 'all' } | { kind: 'source'; source: string }
  results: SearchResult[]
  isPending: boolean
  error: string | null
  onCancel: () => void
  onConfirm: (input: { rationale: string; method: 'hard_delete'; requestedBy: 'subject' | 'admin' }) => void
}

function DeleteConfirmation(props: DeleteConfirmationProps) {
  const [method] = useState<'hard_delete'>('hard_delete') // anonymise arrives in v2
  const [requestedBy, setRequestedBy] = useState<'subject' | 'admin'>('subject')
  const [rationale, setRationale] = useState('')
  const [confirmEmail, setConfirmEmail] = useState('')

  const scope = props.scope
  const targetSources =
    scope.kind === 'all'
      ? props.results
      : props.results.filter((r) => r.source === scope.source)
  const targetRecordCount = targetSources.reduce((n, s) => n + s.records.length, 0)
  const canConfirm =
    rationale.trim().length >= 10 &&
    confirmEmail.trim().toLowerCase() === props.email.trim().toLowerCase() &&
    !props.isPending

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow-xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <FileWarning size={20} className="mt-0.5 shrink-0 text-red-600" />
            <div>
              <h3 className="text-base font-semibold text-gray-900">
                Delete{' '}
                {props.scope.kind === 'all'
                  ? 'all data'
                  : `data in ${props.scope.source}`}
                {' '}
                for {props.email}?
              </h3>
              <p className="mt-1 text-sm text-gray-600">
                {targetRecordCount} record(s) across {targetSources.length} source(s). This cannot be undone.
              </p>
            </div>
          </div>
          <button onClick={props.onCancel} className="rounded-md p-1 text-gray-400 hover:bg-gray-100">
            <X size={16} />
          </button>
        </div>

        <div className="space-y-3">
          <div className="rounded-md border border-gray-200 bg-gray-50 p-3 text-xs text-gray-600">
            Method: <span className="font-mono font-semibold">hard_delete</span>
            <span className="ml-2 text-gray-400">(anonymisation arrives in v2)</span>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Requested by</label>
            <div className="flex gap-3 text-sm">
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="requestedBy"
                  value="subject"
                  checked={requestedBy === 'subject'}
                  onChange={() => setRequestedBy('subject')}
                />
                Data subject
              </label>
              <label className="flex items-center gap-1.5">
                <input
                  type="radio"
                  name="requestedBy"
                  value="admin"
                  checked={requestedBy === 'admin'}
                  onChange={() => setRequestedBy('admin')}
                />
                Admin discretion
              </label>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              Rationale <span className="text-gray-400">(min 10 chars, written to the audit log)</span>
            </label>
            <textarea
              value={rationale}
              onChange={(e) => setRationale(e.target.value)}
              rows={3}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder="e.g. Subject requested deletion via privacy@example.com on 14 May 2026"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">
              To confirm, retype the email address
            </label>
            <input
              type="text"
              value={confirmEmail}
              onChange={(e) => setConfirmEmail(e.target.value)}
              autoComplete="off"
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              placeholder={props.email}
            />
          </div>

          {props.error && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">{props.error}</p>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button variant="secondary" onClick={props.onCancel}>
              Cancel
            </Button>
            <Button
              variant="danger"
              disabled={!canConfirm}
              onClick={() => props.onConfirm({ rationale, method, requestedBy })}
            >
              {props.isPending ? 'Deleting…' : `Delete ${targetRecordCount} record(s)`}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
