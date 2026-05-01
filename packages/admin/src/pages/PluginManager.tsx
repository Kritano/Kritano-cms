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
  Shield,
  ShieldCheck,
  ShieldAlert,
  FolderOpen,
  AlertTriangle,
} from 'lucide-react'

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

function officialBadge(name: string) {
  if (name.startsWith('@cms-plugin/')) {
    return <Badge variant="success">Official</Badge>
  }
  if (name.startsWith('@cms-verified/')) {
    return <Badge variant="success">Verified</Badge>
  }
  return null
}

export function PluginManager() {
  const queryClient = useQueryClient()
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null)

  const { data, isLoading } = useQuery({
    queryKey: ['plugins'],
    queryFn: () => api<{ data: PluginInfo[] }>('/admin/plugins'),
  })

  const { data: detailData } = useQuery({
    queryKey: ['plugin-detail', selectedPlugin],
    queryFn: () => api<{ data: PluginDetail }>(`/admin/plugins/${selectedPlugin}`),
    enabled: !!selectedPlugin,
  })

  const enableMutation = useMutation({
    mutationFn: (name: string) =>
      api(`/admin/plugins/${name}/enable`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      if (selectedPlugin) queryClient.invalidateQueries({ queryKey: ['plugin-detail', selectedPlugin] })
    },
  })

  const disableMutation = useMutation({
    mutationFn: (name: string) =>
      api(`/admin/plugins/${name}/disable`, { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      if (selectedPlugin) queryClient.invalidateQueries({ queryKey: ['plugin-detail', selectedPlugin] })
    },
  })

  const uninstallMutation = useMutation({
    mutationFn: (name: string) =>
      api(`/admin/plugins/${name}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['plugins'] })
      setSelectedPlugin(null)
    },
  })

  const plugins = data?.data ?? []
  const detail = detailData?.data

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Plugins</h2>
      </div>

      {isLoading && (
        <div className="py-8 text-center text-sm text-gray-500">Loading plugins...</div>
      )}

      {!isLoading && plugins.length === 0 && (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <Puzzle size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-sm font-medium text-gray-900">No plugins installed</p>
          <p className="mt-1 text-sm text-gray-500">
            Install plugins via the CLI:
          </p>
          <code className="mt-2 inline-block rounded bg-gray-100 px-3 py-1.5 text-xs text-gray-700">
            cms plugin:install @cms-plugin/newsletter
          </code>
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
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-gray-900">{plugin.name}</h3>
                  </div>
                  <p className="mt-0.5 text-xs text-gray-500">v{plugin.version} by {plugin.author}</p>
                </div>
                <ChevronRight size={16} className="mt-0.5 shrink-0 text-gray-400" />
              </div>

              <p className="mt-2 line-clamp-2 text-sm text-gray-600">{plugin.description}</p>

              <div className="mt-3 flex flex-wrap items-center gap-1.5">
                {trustBadge(plugin.trust, plugin.source)}
                {officialBadge(plugin.name)}
                {plugin.enabled ? (
                  <Badge variant="success">Enabled</Badge>
                ) : (
                  <Badge variant="danger">Disabled</Badge>
                )}
              </div>

              <div className="mt-3 flex items-center justify-between">
                <button
                  className={cn(
                    'relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors',
                    plugin.enabled ? 'bg-green-500' : 'bg-gray-300',
                  )}
                  onClick={(e) => {
                    e.stopPropagation()
                    if (plugin.enabled) {
                      disableMutation.mutate(plugin.name)
                    } else {
                      enableMutation.mutate(plugin.name)
                    }
                  }}
                >
                  <span
                    className={cn(
                      'inline-block h-4 w-4 rounded-full bg-white shadow transition-transform',
                      plugin.enabled ? 'translate-x-4' : 'translate-x-0.5',
                    )}
                  />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Detail side panel */}
      {selectedPlugin && detail && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30"
            onClick={() => setSelectedPlugin(null)}
          />
          <div className="fixed inset-y-0 right-0 z-50 w-full max-w-md overflow-y-auto bg-white shadow-xl">
            <div className="flex items-center justify-between border-b border-gray-200 px-6 py-4">
              <h3 className="text-lg font-semibold text-gray-900">{detail.name}</h3>
              <button
                onClick={() => setSelectedPlugin(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X size={20} />
              </button>
            </div>

            <div className="space-y-6 px-6 py-5">
              {/* Meta */}
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Version:</span> {detail.version}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Author:</span> {detail.author}
                </div>
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <span className="font-medium text-gray-900">Source:</span> {detail.source}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-gray-900">Trust:</span>
                  {trustBadge(detail.trust, detail.source)}
                </div>
              </div>

              {/* Description */}
              <div>
                <p className="text-sm text-gray-600">{detail.description}</p>
              </div>

              {/* Trust tier explanation */}
              {detail.trust === 'sandboxed' && (
                <div className="flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                  <ShieldAlert size={16} className="mt-0.5 shrink-0 text-amber-600" />
                  <p className="text-xs text-amber-800">
                    This plugin runs in an isolated sandbox. It cannot register admin UI sections,
                    custom field types, API routes, or background jobs.
                  </p>
                </div>
              )}

              {/* Dependencies */}
              {detail.requires.length > 0 && (
                <div>
                  <h4 className="mb-1.5 text-sm font-medium text-gray-900">Dependencies</h4>
                  <div className="space-y-1">
                    {detail.requires.map((dep) => (
                      <div key={dep} className="text-sm text-gray-600">{dep}</div>
                    ))}
                  </div>
                </div>
              )}

              {/* CMS version constraint */}
              {detail.cms && (
                <div>
                  <h4 className="mb-1.5 text-sm font-medium text-gray-900">CMS Compatibility</h4>
                  <p className="text-sm text-gray-600">
                    {detail.cms.minVersion} — {detail.cms.maxVersion || 'latest'}
                  </p>
                </div>
              )}

              {/* Registrations summary */}
              <div>
                <h4 className="mb-2 text-sm font-medium text-gray-900">Registrations</h4>
                <div className="grid grid-cols-2 gap-2 text-sm">
                  {detail.routes.length > 0 && (
                    <div className="text-gray-600">{detail.routes.length} API route(s)</div>
                  )}
                  {detail.hooks.length > 0 && (
                    <div className="text-gray-600">{detail.hooks.length} hook(s)</div>
                  )}
                  {detail.collections.length > 0 && (
                    <div className="text-gray-600">{detail.collections.length} collection(s)</div>
                  )}
                  {detail.fieldTypes.length > 0 && (
                    <div className="text-gray-600">{detail.fieldTypes.length} field type(s)</div>
                  )}
                  {detail.adminSections.length > 0 && (
                    <div className="text-gray-600">{detail.adminSections.length} admin section(s)</div>
                  )}
                  {detail.routes.length === 0 && detail.hooks.length === 0 && detail.collections.length === 0 && detail.fieldTypes.length === 0 && detail.adminSections.length === 0 && (
                    <div className="col-span-2 text-gray-400">No registrations</div>
                  )}
                </div>
              </div>

              {/* Hooks detail */}
              {detail.hooks.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-900">Hooks</h4>
                  <div className="space-y-1">
                    {detail.hooks.map((hook, i) => (
                      <div key={i} className="flex items-center justify-between text-sm">
                        <code className="text-xs text-gray-600">{hook.event}</code>
                        <span className="text-xs text-gray-400">order: {hook.order}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Routes detail */}
              {detail.routes.length > 0 && (
                <div>
                  <h4 className="mb-2 text-sm font-medium text-gray-900">API Routes</h4>
                  <div className="space-y-1">
                    {detail.routes.map((route, i) => (
                      <div key={i} className="text-sm">
                        <code className="text-xs">
                          <span className="font-medium text-gray-700">{route.method}</span>{' '}
                          <span className="text-gray-500">{route.path}</span>
                        </code>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 border-t border-gray-200 pt-5">
                <Button
                  variant={detail.enabled ? 'secondary' : 'primary'}
                  size="sm"
                  onClick={() => {
                    if (detail.enabled) {
                      disableMutation.mutate(detail.name)
                    } else {
                      enableMutation.mutate(detail.name)
                    }
                  }}
                >
                  {detail.enabled ? 'Disable' : 'Enable'}
                </Button>

                {detail.source === 'npm' && (
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => {
                      if (confirm(`Uninstall ${detail.name}? This will remove all plugin data.`)) {
                        uninstallMutation.mutate(detail.name)
                      }
                    }}
                  >
                    Uninstall
                  </Button>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
