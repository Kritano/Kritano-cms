import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils'
import {
  Puzzle,
  ChevronRight,
  X,
  ShieldAlert,
  Download,
  Search,
  Check,
} from 'lucide-react'

type Tab = 'installed' | 'available'

interface PluginInfo {
  name: string
  version: string
  description: string
  author: string
  trust: 'trusted' | 'sandboxed'
  source: 'npm' | 'local'
  enabled: boolean
  routes: number
  hooks: number
  collections: string[]
  fieldTypes: string[]
  adminSections: string[]
  editorTabs: string[]
  dashboardWidgets: string[]
  settingsPages: string[]
  installedAt: string | null
}

interface AvailablePlugin {
  name: string
  repo: string
  description: string
  version: string
  author: string
  trust: string
  tags: string[]
  icon: string
  installed: boolean
}

interface PluginDetail extends Omit<PluginInfo, 'routes' | 'hooks'> {
  requires: string[]
  cms: { minVersion: string; maxVersion?: string } | null
  routes: Array<{ method: string; path: string }>
  hooks: Array<{ event: string; order: number }>
  settings: Record<string, unknown>
}

function trustBadge(trust: string, source: string) {
  if (source === 'local') return <Badge>Local</Badge>
  if (trust === 'trusted') return <Badge variant="success">Trusted</Badge>
  return <Badge variant="default">Sandboxed</Badge>
}

export function PluginManager() {
  const [tab, setTab] = useState<Tab>('installed')

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Plugins</h2>
      </div>

      <div className="flex gap-1 border-b border-gray-200">
        {(['installed', 'available'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'installed' && <InstalledTab />}
      {tab === 'available' && <AvailableTab />}
    </div>
  )
}

// ── Installed Tab ───────────────────────────────────────────────────────

function InstalledTab() {
  const queryClient = useQueryClient()
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api<{ data: PluginInfo[] }>('/admin/plugins'),
  })

  const { data: detailData } = useQuery({
    queryKey: ['plugin-detail', selectedPlugin],
    queryFn: () => api<{ data: PluginDetail }>(`/admin/plugins/detail?name=${encodeURIComponent(selectedPlugin!)}`),
    enabled: !!selectedPlugin,
  })

  const enableMutation = useMutation({
    mutationFn: (name: string) => api('/admin/plugins/enable', { method: 'POST', body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] }),
  })

  const disableMutation = useMutation({
    mutationFn: (name: string) => api('/admin/plugins/disable', { method: 'POST', body: { name } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['plugins'] }),
  })

  const uninstallMutation = useMutation({
    mutationFn: (name: string) => api('/admin/plugins/uninstall', { method: 'POST', body: { name } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      queryClient.invalidateQueries({ queryKey: ['plugins-available'] })
      queryClient.invalidateQueries({ queryKey: ['plugin-registry'] })
      setSelectedPlugin(null)
    },
  })

  const plugins = data?.data ?? []
  const detail = detailData?.data

  return (
    <>
      {isLoading && <div className="py-8 text-center text-sm text-gray-500">Loading...</div>}

      {!isLoading && plugins.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Puzzle size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-900">No plugins installed</p>
          <p className="mt-1 text-sm text-gray-500">Browse the Available tab to find and install plugins.</p>
        </div>
      )}

      {!isLoading && plugins.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <div
              key={plugin.name}
              className={cn(
                'cursor-pointer rounded-lg border bg-white p-5 transition-colors hover:border-gray-300',
                selectedPlugin === plugin.name ? 'border-gray-400 ring-1 ring-gray-400' : 'border-gray-200',
              )}
              onClick={() => setSelectedPlugin(plugin.name)}
            >
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{plugin.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">v{plugin.version} by {plugin.author}</p>
                </div>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400" />
              </div>
              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{plugin.description}</p>
              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {trustBadge(plugin.trust, plugin.source)}
                {plugin.enabled ? <Badge variant="success">Enabled</Badge> : <Badge variant="danger">Disabled</Badge>}
              </div>
              <div className="mt-3">
                <button
                  className={cn('relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors', plugin.enabled ? 'bg-green-500' : 'bg-gray-300')}
                  onClick={(e) => { e.stopPropagation(); plugin.enabled ? disableMutation.mutate(plugin.name) : enableMutation.mutate(plugin.name) }}
                >
                  <span className={cn('inline-block h-4 w-4 rounded-full bg-white shadow transition-transform', plugin.enabled ? 'translate-x-4' : 'translate-x-0.5')} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail panel */}
      {selectedPlugin && detail && (
        <>
          <div className="fixed inset-0 z-40 bg-black/30" onClick={() => setSelectedPlugin(null)} />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">{detail.name}</h3>
              <button onClick={() => setSelectedPlugin(null)} className="text-gray-400 hover:text-gray-600"><X size={20} /></button>
            </div>
            <div className="space-y-6 px-6 py-5">
              <div className="space-y-2 text-sm text-gray-600">
                <div><span className="font-medium text-gray-900">Version:</span> {detail.version}</div>
                <div><span className="font-medium text-gray-900">Author:</span> {detail.author}</div>
                <div><span className="font-medium text-gray-900">Source:</span> {detail.source === 'local' ? 'Local' : 'Package'}</div>
                <div className="flex items-center gap-2"><span className="font-medium text-gray-900">Trust:</span> {trustBadge(detail.trust, detail.source)}</div>
              </div>
              <p className="text-sm text-gray-600">{detail.description}</p>
              {detail.trust === 'sandboxed' && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">This plugin runs in an isolated sandbox with restricted capabilities.</p>
                </div>
              )}
              {(detail.requires?.length ?? 0) > 0 && (
                <div>
                  <h4 className="mb-1.5 text-sm font-medium text-gray-900">Dependencies</h4>
                  {detail.requires.map((dep) => <div key={dep} className="text-sm text-gray-600">{dep}</div>)}
                </div>
              )}
              <div className="flex gap-3 border-t border-gray-200 pt-5">
                <Button variant={detail.enabled ? 'secondary' : 'primary'} size="sm" onClick={() => detail.enabled ? disableMutation.mutate(detail.name) : enableMutation.mutate(detail.name)}>
                  {detail.enabled ? 'Disable' : 'Enable'}
                </Button>
                {detail.source !== 'local' && (
                  <Button variant="danger" size="sm" onClick={() => { if (confirm(`Uninstall ${detail.name}?`)) uninstallMutation.mutate(detail.name) }}>
                    Uninstall
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ── Available Tab ───────────────────────────────────────────────────────

function AvailableTab() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [installing, setInstalling] = useState<string | null>(null)
  const [result, setResult] = useState<{ name: string; message: string } | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plugins-available'],
    queryFn: () => api<{ plugins: AvailablePlugin[] }>('/admin/plugins/available'),
    staleTime: 60 * 60 * 1000,
    retry: false,
  })

  const installMutation = useMutation({
    mutationFn: (plugin: AvailablePlugin) =>
      api<{ success: boolean; message: string }>('/admin/plugins/install', {
        method: 'POST',
        body: { repo: plugin.repo, name: plugin.name },
      }),
    onSuccess: (data, plugin) => {
      setResult({ name: plugin.name, message: data.message })
      setInstalling(null)
      queryClient.invalidateQueries({ queryKey: ['plugins-available'] })
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      queryClient.invalidateQueries({ queryKey: ['plugin-registry'] })
    },
    onError: (err: any) => {
      setResult({ name: '', message: err.message || 'Install failed' })
      setInstalling(null)
    },
  })

  const plugins = (data?.plugins ?? []).filter((p) => {
    if (!search) return true
    const q = search.toLowerCase()
    return p.name.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      p.tags.some((t) => t.toLowerCase().includes(q))
  })

  return (
    <>
      {/* Search */}
      <div className="relative">
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search plugins..."
          className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      {/* Result banner */}
      {result && (
        <div className={cn('flex items-center justify-between rounded-lg px-4 py-3 text-sm', result.name ? 'border border-green-200 bg-green-50 text-green-800' : 'border border-red-200 bg-red-50 text-red-800')}>
          <span>{result.name ? `${result.name} — ${result.message}` : result.message}</span>
          <button onClick={() => setResult(null)} className="text-current opacity-50 hover:opacity-100"><X size={14} /></button>
        </div>
      )}

      {isLoading && <div className="py-8 text-center text-sm text-gray-500">Loading registry...</div>}

      {!isLoading && plugins.length === 0 && (
        <div className="py-8 text-center text-sm text-gray-500">
          {search ? `No plugins found for "${search}"` : 'No plugins available in the registry.'}
        </div>
      )}

      {!isLoading && plugins.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {plugins.map((plugin) => (
            <div key={plugin.name} className="rounded-lg border border-gray-200 bg-white p-5">
              <div className="flex items-start justify-between">
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-semibold text-gray-900">{plugin.name}</h3>
                  <p className="mt-0.5 text-xs text-gray-500">v{plugin.version} by {plugin.author}</p>
                </div>
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{plugin.description}</p>

              {plugin.tags.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {plugin.tags.map((tag) => (
                    <span key={tag} className="rounded bg-gray-100 px-1.5 py-0.5 text-[10px] text-gray-500">{tag}</span>
                  ))}
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5">
                <Badge variant="success">{plugin.trust === 'trusted' ? 'Official' : 'Community'}</Badge>
              </div>

              <div className="mt-4">
                {plugin.installed ? (
                  <span className="inline-flex items-center gap-1.5 text-sm text-green-600">
                    <Check size={14} />
                    Installed
                  </span>
                ) : (
                  <Button
                    size="sm"
                    disabled={installing === plugin.name}
                    onClick={() => { setInstalling(plugin.name); installMutation.mutate(plugin) }}
                  >
                    <Download size={14} className="mr-1.5" />
                    {installing === plugin.name ? 'Installing...' : 'Install'}
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
