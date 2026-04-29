import { useState } from 'react'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { generateScript } from '@/components/deployment/ScriptGenerator'
import { ScriptOutput } from '@/components/deployment/ScriptOutput'

export function Deployment() {
  const [serverIp, setServerIp] = useState('')
  const [sshUser, setSshUser] = useState('root')
  const [domain, setDomain] = useState('')
  const [email, setEmail] = useState('')
  const [os, setOs] = useState('ubuntu-24.04')
  const [size, setSize] = useState('small')
  const [script, setScript] = useState<string | null>(null)

  function handleGenerate() {
    setScript(generateScript({ serverIp, sshUser, domain, email, os, size }))
  }

  const canGenerate = serverIp && domain && email

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Deployment</h2>

      <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <Input label="Server IP" value={serverIp} onChange={(e) => setServerIp(e.target.value)} placeholder="203.0.113.10" required />
        <Input label="SSH user" value={sshUser} onChange={(e) => setSshUser(e.target.value)} />
        <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="mysite.com" required />
        <Input label="Email (Let's Encrypt)" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="admin@mysite.com" required />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Operating system</label>
          <select
            value={os}
            onChange={(e) => setOs(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="ubuntu-24.04">Ubuntu 24.04</option>
            <option value="ubuntu-22.04">Ubuntu 22.04</option>
            <option value="debian-12">Debian 12</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Server size</label>
          <select
            value={size}
            onChange={(e) => setSize(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            <option value="small">Small (1–2 CPU)</option>
            <option value="medium">Medium (2–4 CPU)</option>
            <option value="large">Large (4+ CPU)</option>
          </select>
        </div>

        <Button onClick={handleGenerate} disabled={!canGenerate} className="w-full">
          Generate Script
        </Button>
      </div>

      {script && <ScriptOutput script={script} />}
    </div>
  )
}
