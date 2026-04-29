import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Props {
  onConnected: () => void
}

export function KritanoConnect({ onConnected }: Props) {
  const [mode, setMode] = useState<'idle' | 'create' | 'connect'>('idle')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      // In production this calls: POST https://app.kritano.com/api/forge/register
      // For dev, we mock the flow
      const res = await fetch('/api/kritano/webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          event: 'audit.completed',
          site_id: 'mock-site-id',
          scores: { overall: 0, seo: 0, accessibility: 0, performance: 0, ai_visibility: null },
          audit_id: 'initial',
          completed_at: new Date().toISOString(),
        }),
      })
      onConnected()
    } catch (err: any) {
      setError(err.message || 'Connection failed')
    } finally {
      setLoading(false)
    }
  }

  if (mode === 'idle') {
    return (
      <div className="rounded-lg border border-gray-200 bg-white p-6 text-center">
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-gray-100">
          <span className="text-lg font-bold text-gray-600">K</span>
        </div>
        <h3 className="text-base font-semibold text-gray-900">
          Unlock SEO auditing, accessibility scoring and AI visibility
        </h3>
        <p className="mt-2 text-sm text-gray-500">
          Powered by Kritano — the site health platform built into this CMS.
          Connect your free account to see your site health score here
          and get inline SEO suggestions as you write.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <Button onClick={() => setMode('create')}>Create free account</Button>
          <Button variant="secondary" onClick={() => setMode('connect')}>Connect existing account</Button>
        </div>
      </div>
    )
  }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-6">
      <h3 className="mb-4 text-sm font-semibold text-gray-900">
        {mode === 'create' ? 'Create Kritano account' : 'Connect to Kritano'}
      </h3>
      <div className="space-y-3">
        <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
        <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error && <p className="text-sm text-red-600">{error}</p>}
        <div className="flex gap-2">
          <Button onClick={handleCreate} disabled={loading || !email || !password}>
            {loading ? 'Connecting…' : mode === 'create' ? 'Create & connect' : 'Connect'}
          </Button>
          <Button variant="ghost" onClick={() => setMode('idle')}>Cancel</Button>
        </div>
      </div>
    </div>
  )
}
