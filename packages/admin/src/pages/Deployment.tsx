import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateScript } from '@/components/deployment/ScriptGenerator'
import { generateUpdateScript } from '@/components/deployment/UpdateScriptGenerator'
import { ScriptOutput } from '@/components/deployment/ScriptOutput'
import { api } from '@/lib/api'
import { Download, RotateCcw, Database, HardDrive } from 'lucide-react'

type Tab = 'setup' | 'update' | 'backups'

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

        <Button onClick={() => setScript(generateScript({ serverIp, sshUser, domain, email, os, size }))} disabled={!canGenerate} className="w-full">
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

        <Button onClick={() => setScript(generateUpdateScript({ serverIp, sshUser, domain }))} disabled={!canGenerate} className="w-full">
          Generate Update Script
        </Button>
      </div>
      {script && <ScriptOutput script={script} />}
    </>
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
