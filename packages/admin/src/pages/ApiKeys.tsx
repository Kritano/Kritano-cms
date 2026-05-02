import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { formatDate } from '@/lib/utils'
import { Plus, Trash2, Copy, X, Key } from 'lucide-react'

const AVAILABLE_SCOPES = [
  { value: 'content:read', label: 'Content — Read', description: 'List and read documents' },
  { value: 'content:write', label: 'Content — Write', description: 'Create, update, delete documents' },
  { value: 'content:publish', label: 'Content — Publish', description: 'Publish and unpublish documents' },
  { value: 'media:read', label: 'Media — Read', description: 'List and read media files' },
  { value: 'media:write', label: 'Media — Write', description: 'Upload and delete media files' },
  { value: 'schema:read', label: 'Schema — Read', description: 'Read collection schema' },
]

interface ApiKey {
  id: string
  name: string
  key_prefix: string
  permissions: string[]
  last_used: string | null
  expires_at: string | null
  created_by: string
  created_at: string
}

export function ApiKeys() {
  const queryClient = useQueryClient()
  const [showCreate, setShowCreate] = useState(false)
  const [newKeyRevealed, setNewKeyRevealed] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  // Create form state
  const [name, setName] = useState('')
  const [scopes, setScopes] = useState<string[]>([])
  const [expiresAt, setExpiresAt] = useState('')
  const [error, setError] = useState('')

  const { data, isLoading, error: queryError } = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api<{ data: ApiKey[] }>('/admin/api-keys'),
    retry: false,
  })

  const createMutation = useMutation({
    mutationFn: () =>
      api<{ data: ApiKey & { key: string } }>('/admin/api-keys', {
        method: 'POST',
        body: { name, permissions: scopes, expiresAt: expiresAt || null },
      }),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
      setNewKeyRevealed(data.data.key)
      setName('')
      setScopes([])
      setExpiresAt('')
      setError('')
      setShowCreate(false)
    },
    onError: (err: any) => setError(err.message || 'Failed to create API key'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      api(`/admin/api-keys/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['api-keys'] })
    },
  })

  function toggleScope(scope: string) {
    setScopes((prev) =>
      prev.includes(scope) ? prev.filter((s) => s !== scope) : [...prev, scope],
    )
  }

  function copyKey() {
    if (newKeyRevealed) {
      navigator.clipboard.writeText(newKeyRevealed)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const keys = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">API Keys</h2>
        <Button onClick={() => setShowCreate(true)} size="sm">
          <Plus size={16} className="mr-1.5" />
          Create key
        </Button>
      </div>

      {/* Newly created key reveal */}
      {newKeyRevealed && (
        <div className="rounded-lg border border-green-200 bg-green-50 p-4">
          <p className="mb-2 text-sm font-medium text-green-800">
            API key created. Copy it now — it won't be shown again.
          </p>
          <div className="flex items-center gap-2">
            <code className="flex-1 rounded bg-white px-3 py-2 text-sm font-mono text-gray-900 border border-green-200 select-all">
              {newKeyRevealed}
            </code>
            <Button variant="secondary" size="sm" onClick={copyKey}>
              <Copy size={14} className="mr-1" />
              {copied ? 'Copied!' : 'Copy'}
            </Button>
            <button
              onClick={() => setNewKeyRevealed(null)}
              className="text-green-400 hover:text-green-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>
      )}

      {/* Create panel */}
      {showCreate && (
        <div className="rounded-lg border border-gray-200 bg-white p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-gray-900">Create API Key</h3>
            <button onClick={() => { setShowCreate(false); setError('') }} className="text-gray-400 hover:text-gray-600">
              <X size={16} />
            </button>
          </div>

          <div className="max-w-lg space-y-4">
            <Input
              label="Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. MCP Server, Frontend Build"
            />

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Permissions</label>
              <div className="space-y-2">
                {AVAILABLE_SCOPES.map((scope) => (
                  <label key={scope.value} className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={scopes.includes(scope.value)}
                      onChange={() => toggleScope(scope.value)}
                      className="mt-0.5 h-4 w-4 rounded text-gray-900"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-700">{scope.label}</span>
                      <p className="text-xs text-gray-500">{scope.description}</p>
                    </div>
                  </label>
                ))}
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-gray-700">Expiry (optional)</label>
              <input
                type="date"
                value={expiresAt}
                onChange={(e) => setExpiresAt(e.target.value)}
                className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
              />
              <p className="text-xs text-gray-500">Leave blank for no expiry.</p>
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}

            <Button
              onClick={() => createMutation.mutate()}
              disabled={!name || scopes.length === 0 || createMutation.isPending}
            >
              {createMutation.isPending ? 'Creating…' : 'Create API Key'}
            </Button>
          </div>
        </div>
      )}

      {/* Keys list */}
      {queryError && (
        <div className="rounded-md bg-red-50 px-4 py-3 text-sm text-red-700">
          Failed to load API keys: {(queryError as any).message || 'Unknown error'}
        </div>
      )}

      {isLoading && (
        <div className="py-8 text-center text-sm text-gray-500">Loading...</div>
      )}

      {!isLoading && keys.length === 0 && !showCreate && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Key size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-900">No API keys</p>
          <p className="mt-1 text-sm text-gray-500">
            Create an API key to connect external services like MCP, frontends, or CI/CD.
          </p>
        </div>
      )}

      {keys.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Key</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Scopes</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last used</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Expires</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {keys.map((key) => (
                <tr key={key.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">{key.name}</td>
                  <td className="px-4 py-3">
                    <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs text-gray-600">
                      {key.key_prefix}...
                    </code>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {(Array.isArray(key.permissions) ? key.permissions : []).map((scope) => (
                        <Badge key={scope}>{scope.replace(':', ' ')}</Badge>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {key.last_used ? formatDate(String(key.last_used)) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {key.expires_at ? formatDate(String(key.expires_at)) : 'Never'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Revoke "${key.name}"? This cannot be undone.`)) {
                          deleteMutation.mutate(key.id)
                        }
                      }}
                      className="text-gray-400 hover:text-red-600"
                      title="Revoke key"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
