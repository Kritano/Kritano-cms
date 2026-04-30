import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2, Search, Upload, Download, AlertTriangle, Wrench } from 'lucide-react'

interface Redirect {
  id: string
  from_path: string
  to_path: string
  type: number
  hits: number
  created_at: string
}

interface Chain {
  chain: { id: string; fromPath: string; toPath: string }[]
  suggestion: { fromId: string; newToPath: string }
}

export function Redirects() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [newFrom, setNewFrom] = useState('')
  const [newTo, setNewTo] = useState('')
  const [newType, setNewType] = useState(301)
  const [editId, setEditId] = useState<string | null>(null)
  const [editFrom, setEditFrom] = useState('')
  const [editTo, setEditTo] = useState('')
  const [editType, setEditType] = useState(301)
  const [showImport, setShowImport] = useState(false)
  const [csvText, setCsvText] = useState('')
  const [showChains, setShowChains] = useState(false)
  const [error, setError] = useState('')

  const { data, isLoading } = useQuery({
    queryKey: ['redirects', search],
    queryFn: () => api<{ data: Redirect[]; total: number }>(`/admin/redirects?limit=200${search ? `&search=${encodeURIComponent(search)}` : ''}`),
  })

  const { data: chainsData } = useQuery({
    queryKey: ['redirect-chains'],
    queryFn: () => api<{ data: Chain[] }>('/admin/redirects/check-chains', { method: 'POST' }),
  })

  const createMutation = useMutation({
    mutationFn: () => api('/admin/redirects', { method: 'POST', body: { fromPath: newFrom, toPath: newTo, type: newType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      queryClient.invalidateQueries({ queryKey: ['redirect-chains'] })
      setNewFrom('')
      setNewTo('')
      setNewType(301)
      setShowAdd(false)
      setError('')
    },
    onError: (err: any) => setError(err.message || 'Failed to create redirect'),
  })

  const updateMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/redirects/${id}`, { method: 'PUT', body: { fromPath: editFrom, toPath: editTo, type: editType } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      queryClient.invalidateQueries({ queryKey: ['redirect-chains'] })
      setEditId(null)
    },
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/redirects/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      queryClient.invalidateQueries({ queryKey: ['redirect-chains'] })
    },
  })

  const importMutation = useMutation({
    mutationFn: () => api<{ data: { imported: number; skipped: number } }>('/admin/redirects/import', { method: 'POST', body: { csv: csvText } }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      queryClient.invalidateQueries({ queryKey: ['redirect-chains'] })
      setCsvText('')
      setShowImport(false)
      alert(`Imported ${result.data.imported} redirects (${result.data.skipped} skipped)`)
    },
  })

  const fixChainMutation = useMutation({
    mutationFn: (chain: Chain) => api(`/admin/redirects/${chain.suggestion.fromId}`, {
      method: 'PUT',
      body: { toPath: chain.suggestion.newToPath },
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['redirects'] })
      queryClient.invalidateQueries({ queryKey: ['redirect-chains'] })
    },
  })

  const redirects = data?.data ?? []
  const chains = chainsData?.data ?? []

  function startEdit(r: Redirect) {
    setEditId(r.id)
    setEditFrom(r.from_path)
    setEditTo(r.to_path)
    setEditType(r.type)
  }

  function handleExport() {
    window.open('/api/admin/redirects/export', '_blank')
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Redirects</h1>
        <div className="flex gap-2">
          <Button variant="secondary" size="sm" onClick={() => setShowImport(!showImport)}>
            <Upload size={14} className="mr-1.5" />
            Import CSV
          </Button>
          <Button variant="secondary" size="sm" onClick={handleExport}>
            <Download size={14} className="mr-1.5" />
            Export CSV
          </Button>
          <Button size="sm" onClick={() => setShowAdd(!showAdd)}>
            <Plus size={14} className="mr-1.5" />
            Add redirect
          </Button>
        </div>
      </div>

      {/* Chain warnings */}
      {chains.length > 0 && (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <AlertTriangle size={16} className="text-amber-600" />
              <span className="text-sm font-medium text-amber-800">
                {chains.length} redirect chain{chains.length > 1 ? 's' : ''} detected
              </span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => setShowChains(!showChains)}>
              {showChains ? 'Hide' : 'View chains'}
            </Button>
          </div>
          {showChains && (
            <div className="mt-3 space-y-2">
              {chains.map((chain, idx) => (
                <div key={idx} className="flex items-center justify-between rounded border border-amber-200 bg-white px-3 py-2">
                  <div className="text-xs text-gray-600">
                    {chain.chain.map((c, i) => (
                      <span key={c.id}>
                        {i > 0 && <span className="mx-1 text-amber-500">→</span>}
                        <code className="rounded bg-gray-100 px-1">{c.fromPath}</code>
                      </span>
                    ))}
                    <span className="mx-1 text-amber-500">→</span>
                    <code className="rounded bg-gray-100 px-1">{chain.suggestion.newToPath}</code>
                  </div>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => fixChainMutation.mutate(chain)}
                    disabled={fixChainMutation.isPending}
                  >
                    <Wrench size={12} className="mr-1" />
                    Fix
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* CSV Import */}
      {showImport && (
        <div className="rounded-lg border border-gray-200 bg-white p-4 space-y-3">
          <p className="text-sm text-gray-600">Paste CSV content (format: <code className="bg-gray-100 px-1 rounded">from_path,to_path,type</code>)</p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm font-mono"
            placeholder={`from_path,to_path,type\n/old-page,/new-page,301\n/another,/destination,302`}
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={() => importMutation.mutate()} disabled={!csvText || importMutation.isPending}>
              {importMutation.isPending ? 'Importing…' : 'Import'}
            </Button>
            <Button variant="ghost" size="sm" onClick={() => { setShowImport(false); setCsvText('') }}>Cancel</Button>
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by path…"
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {/* Table */}
      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">From</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">To</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Hits</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Created</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {/* Inline add row */}
              {showAdd && (
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2">
                    <input value={newFrom} onChange={(e) => setNewFrom(e.target.value)} placeholder="/old-url" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-4 py-2">
                    <input value={newTo} onChange={(e) => setNewTo(e.target.value)} placeholder="/new-url" className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                  </td>
                  <td className="px-4 py-2">
                    <select value={newType} onChange={(e) => setNewType(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                      <option value={301}>301</option>
                      <option value={302}>302</option>
                    </select>
                  </td>
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2" />
                  <td className="px-4 py-2 text-right">
                    <Button size="sm" onClick={() => createMutation.mutate()} disabled={!newFrom || !newTo || createMutation.isPending}>
                      Add
                    </Button>
                  </td>
                </tr>
              )}

              {redirects.map((r) => (
                <tr key={r.id} className="hover:bg-gray-50">
                  {editId === r.id ? (
                    <>
                      <td className="px-4 py-2">
                        <input value={editFrom} onChange={(e) => setEditFrom(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <input value={editTo} onChange={(e) => setEditTo(e.target.value)} className="w-full rounded border border-gray-300 px-2 py-1 text-sm" />
                      </td>
                      <td className="px-4 py-2">
                        <select value={editType} onChange={(e) => setEditType(Number(e.target.value))} className="rounded border border-gray-300 px-2 py-1 text-sm">
                          <option value={301}>301</option>
                          <option value={302}>302</option>
                        </select>
                      </td>
                      <td className="px-4 py-2 text-gray-500">{r.hits}</td>
                      <td className="px-4 py-2 text-gray-500">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-2 text-right space-x-1">
                        <Button size="sm" onClick={() => updateMutation.mutate(r.id)}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => setEditId(null)}>Cancel</Button>
                      </td>
                    </>
                  ) : (
                    <>
                      <td className="px-4 py-3 font-mono text-gray-900 cursor-pointer" onClick={() => startEdit(r)}>{r.from_path}</td>
                      <td className="px-4 py-3 font-mono text-gray-600 cursor-pointer" onClick={() => startEdit(r)}>{r.to_path}</td>
                      <td className="px-4 py-3">
                        <Badge variant={r.type === 301 ? 'default' : 'warning'}>{r.type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-gray-500">{r.hits}</td>
                      <td className="px-4 py-3 text-gray-500">{formatDate(r.created_at)}</td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => {
                            if (confirm('Delete this redirect?')) deleteMutation.mutate(r.id)
                          }}
                          className="text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </>
                  )}
                </tr>
              ))}

              {redirects.length === 0 && !showAdd && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm text-gray-400">No redirects found.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
