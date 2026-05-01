import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateScript } from '@/components/deployment/ScriptGenerator'
import { generateUpdateScript } from '@/components/deployment/UpdateScriptGenerator'
import { ScriptOutput } from '@/components/deployment/ScriptOutput'
import { api } from '@/lib/api'
import { Download, RotateCcw, Database, HardDrive, Copy, ExternalLink, AlertTriangle, RefreshCw } from 'lucide-react'

type Tab = 'setup' | 'update' | 'backups' | 'updates'

interface Backup {
  filename: string
  size: number
  createdAt: string
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  })
}

export function Deployment() {
  const [tab, setTab] = useState<Tab>('setup')

  const tabs: { value: Tab; label: string }[] = [
    { value: 'setup', label: 'Initial Setup' },
    { value: 'update', label: 'Update Server' },
    { value: 'updates', label: 'Updates' },
    { value: 'backups', label: 'Backups' },
  ]

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Deployment</h2>

      <div className="flex gap-1 border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
              tab === t.value
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'setup' && <InitialSetupTab />}
      {tab === 'update' && <UpdateTab />}
      {tab === 'updates' && <CmsUpdatesTab />}
      {tab === 'backups' && <BackupsTab />}
    </div>
  )
}

function InitialSetupTab() {
  const [serverIp, setServerIp] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [os, setOs] = useState('ubuntu-24.04')
  const [size, setSize] = useState('small')
  const [includeTypesense, setIncludeTypesense] = useState(true)
  const [script, setScript] = useState<string | null>(null)

  const canGenerate = serverIp && domain && email

  return (
    <>
      <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <Input label="Server IP" value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="203.0.113.10" />
        <Input label="SSH user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mysite.com" />
        <Input label="Email (Let's Encrypt)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@mysite.com" />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Operating system</label>
          <select value={os} onChange={(e) => setOs(e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500">
            <option value="ubuntu-24.04">Ubuntu 24.04</option>
            <option value="ubuntu-22.04">Ubuntu 22.04</option>
            <option value="debian-12">Debian 12</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Server size</label>
          <select value={size} onChange={(e) => setSize(e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500">
            <option value="small">Small (1–2 CPU)</option>
            <option value="medium">Medium (2–4 CPU)</option>
            <option value="large">Large (4+ CPU)</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Include full-text search (Typesense)</label>
          <div className="space-y-2">
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="typesense" checked={includeTypesense} onChange={() => setIncludeTypesense(true)} className="h-4 w-4 text-gray-900" />
              <span className="text-sm text-gray-700">Yes — install Typesense on this server (recommended)</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="typesense" checked={!includeTypesense} onChange={() => setIncludeTypesense(false)} className="h-4 w-4 text-gray-900" />
              <span className="text-sm text-gray-700">No — I'll configure search separately</span>
            </label>
          </div>
        </div>

        <Button onClick={() => setScript(generateScript({ serverIp, sshUser, domain, email, os, size, includeTypesense }))} disabled={!canGenerate} className="w-full">
          Generate Setup Script
        </Button>
      </div>
      {script && <ScriptOutput script={script} />}
    </>
  )
}

function UpdateTab() {
  const [serverIp, setServerIp] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [domain, setDomain] = useState('')
  const [includeTypesense, setIncludeTypesense] = useState(true)
  const [script, setScript] = useState<string | null>(null)

  const canGenerate = serverIp && domain

  return (
    <>
      <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-600">
          Generate a zero-downtime update script. This pulls the latest code, runs migrations, rebuilds, and does a rolling restart with automatic rollback on health check failure.
        </p>
        <Input label="Server IP" value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="203.0.113.10" />
        <Input label="SSH user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mysite.com" />

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={includeTypesense} onChange={(e) => setIncludeTypesense(e.target.checked)} className="h-4 w-4 rounded text-gray-900" />
          <span className="text-sm text-gray-700">Re-sync Typesense search indexes after update</span>
        </label>

        <Button onClick={() => setScript(generateUpdateScript({ serverIp, sshUser, domain, includeTypesense }))} disabled={!canGenerate} className="w-full">
          Generate Update Script
        </Button>
      </div>
      {script && <ScriptOutput script={script} />}
    </>
  )
}

interface UpdateCheckResult {
  mode: 'development' | 'release'
  updateAvailable: boolean
  current: { sha?: string; shortSha?: string; committedAt?: string; version?: string }
  latest: { sha?: string; shortSha?: string; committedAt?: string; commitsAhead?: number; version?: string }
  updateType?: string
  recentCommits?: Array<{ sha: string; message: string; date: string }>
  changelogUrl?: string
  checkedAt: string
}

function CmsUpdatesTab() {
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['update-check'],
    queryFn: () => api<UpdateCheckResult>('/admin/updates/check'),
    staleTime: 60 * 60 * 1000,
  })

  const refreshMutation = useMutation({
    mutationFn: () => api<UpdateCheckResult>('/admin/updates/refresh', { method: 'POST' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['update-check'] })
    },
  })

  if (isLoading) {
    return <div className="py-8 text-center text-sm text-gray-500">Checking for updates...</div>
  }

  if (!data) {
    return <div className="py-8 text-center text-sm text-gray-500">Unable to check for updates.</div>
  }

  const isDev = data.mode === 'development'

  const updateCommands = isDev
    ? `bun update @kritano/cms
bun run dev     # test locally first
git add bun.lock && git commit -m "chore: update CMS"
git push        # your GitHub Action handles the server deploy`
    : `bun update @kritano/cms
bun run dev
git add bun.lock && git commit -m "chore: update CMS to ${data.latest.version}"
git push`

  function copyCommands() {
    navigator.clipboard.writeText(updateCommands)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900">CMS Version</h3>
        <button
          onClick={() => refreshMutation.mutate()}
          disabled={refreshMutation.isPending}
          className="inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-700"
        >
          <RefreshCw size={12} className={refreshMutation.isPending ? 'animate-spin' : ''} />
          {refreshMutation.isPending ? 'Checking...' : 'Check now'}
        </button>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        {/* Current version */}
        <div>
          <p className="text-xs font-medium uppercase text-gray-400">Current version</p>
          {isDev ? (
            <p className="mt-1 text-sm text-gray-700">
              Commit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{data.current.shortSha}</code>
              {data.current.committedAt && (
                <span className="ml-2 text-gray-500">
                  — {new Date(data.current.committedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              )}
            </p>
          ) : (
            <p className="mt-1 text-sm text-gray-700">v{data.current.version}</p>
          )}
        </div>

        {/* Latest version */}
        {data.updateAvailable && (
          <div>
            <p className="text-xs font-medium uppercase text-gray-400">Latest available</p>
            {isDev ? (
              <p className="mt-1 text-sm text-gray-700">
                Commit <code className="rounded bg-gray-100 px-1.5 py-0.5 text-xs">{data.latest.shortSha}</code>
                {data.latest.committedAt && (
                  <span className="ml-2 text-gray-500">
                    — {new Date(data.latest.committedAt).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </span>
                )}
                <span className="ml-2 text-blue-600 font-medium">
                  {data.latest.commitsAhead} commit{data.latest.commitsAhead !== 1 ? 's' : ''} ahead
                </span>
              </p>
            ) : (
              <p className="mt-1 text-sm text-gray-700">
                v{data.latest.version}
                {data.updateType && <span className="ml-2 text-gray-500">({data.updateType} update)</span>}
              </p>
            )}
          </div>
        )}

        {!data.updateAvailable && (
          <p className="text-sm text-green-600">You're up to date.</p>
        )}
      </div>

      {/* Major update warning */}
      {data.updateType === 'major' && (
        <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 p-4">
          <AlertTriangle size={16} className="mt-0.5 shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Major update — read the migration guide before updating.</p>
            <a
              href={`https://github.com/Kritano/Kritano-cms/blob/main/MIGRATION.md`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-1 inline-flex items-center gap-1 text-sm text-amber-700 hover:text-amber-900"
            >
              Migration guide <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {/* Recent commits */}
      {data.recentCommits && data.recentCommits.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">Recent changes</p>
          <ul className="space-y-1.5">
            {data.recentCommits.map((commit) => (
              <li key={commit.sha} className="flex items-start gap-2 text-sm">
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-300" />
                <span className="text-gray-700">{commit.message}</span>
              </li>
            ))}
            {data.latest.commitsAhead && data.latest.commitsAhead > (data.recentCommits?.length || 0) && (
              <li className="text-sm text-gray-400 ml-3.5">
                ... {data.latest.commitsAhead - data.recentCommits.length} more
              </li>
            )}
          </ul>
        </div>
      )}

      {/* How to update */}
      {data.updateAvailable && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <p className="mb-3 text-xs font-medium uppercase text-gray-400">How to update</p>
          <p className="mb-3 text-sm text-gray-600">Run these commands in your project locally:</p>
          <pre className="rounded-md bg-gray-900 p-4 text-sm text-gray-100 overflow-x-auto">{updateCommands}</pre>
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={copyCommands}
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Copy size={14} />
              {copied ? 'Copied!' : 'Copy commands'}
            </button>
            <a
              href={data.changelogUrl || `https://github.com/Kritano/Kritano-cms/commits/main`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 text-sm font-medium text-gray-500 hover:text-gray-700"
            >
              View full changelog <ExternalLink size={12} />
            </a>
          </div>
        </div>
      )}

      {data.checkedAt && (
        <p className="text-xs text-gray-400">
          Last checked: {new Date(data.checkedAt).toLocaleString()}
        </p>
      )}
    </div>
  )
}

function BackupsTab() {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['backups'],
    queryFn: () => api<{ data: Backup[] }>('/admin/backups'),
  })

  const backupMutation = useMutation({
    mutationFn: () => api('/admin/backups', { method: 'POST' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['backups'] }),
    onError: (err: any) => alert(err.message || 'Backup failed'),
  })

  const backups = data?.data ?? []
  const isDevMode = backups.length === 0 && !isLoading

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-gray-600">Automatic backups: Daily at 02:00 UTC</p>
          <p className="text-xs text-gray-400">Retention: 30 days</p>
        </div>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => backupMutation.mutate()}
          disabled={backupMutation.isPending}
        >
          <Database size={14} className="mr-1.5" />
          {backupMutation.isPending ? 'Running…' : 'Run backup now'}
        </Button>
      </div>

      {isDevMode && (
        <div className="rounded-md border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500">
          <HardDrive size={16} className="inline mr-1.5" />
          No backups found. In local development, backups are stored at <code className="bg-gray-100 px-1 rounded">/var/backups/cms/</code> which only exists on production servers.
        </div>
      )}

      {backups.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Size</th>
                <th className="px-4 py-3 text-right text-xs font-medium uppercase text-gray-500">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {backups.map((backup) => (
                <tr key={backup.filename} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-900">{formatDate(backup.createdAt)}</td>
                  <td className="px-4 py-3 text-gray-600">{formatSize(backup.size)}</td>
                  <td className="px-4 py-3 text-right space-x-2">
                    <a
                      href={`/api/admin/backups/${backup.filename}`}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                    >
                      <Download size={12} />
                    </a>
                    <button
                      onClick={() => {
                        const script = `# Restore backup script
systemctl stop cms-api cms-worker
pg_restore -U cms -d cms /var/backups/cms/${backup.filename}
systemctl start cms-api cms-worker`
                        navigator.clipboard.writeText(script)
                        alert('Restore script copied to clipboard')
                      }}
                      className="inline-flex items-center gap-1 rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-gray-600 hover:bg-gray-50"
                      title="Copy restore script"
                    >
                      <RotateCcw size={12} />
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
