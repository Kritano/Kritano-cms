import { useState } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Input } from '@/components/ui/Input'
import { Button } from '@/components/ui/Button'
import { MediaField } from '@/components/fields/MediaField'
import { api } from '@/lib/api'

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'French' },
  { value: 'de', label: 'German' },
  { value: 'es', label: 'Spanish' },
  { value: 'it', label: 'Italian' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'nl', label: 'Dutch' },
  { value: 'ja', label: 'Japanese' },
  { value: 'zh', label: 'Chinese' },
  { value: 'ko', label: 'Korean' },
]

export function SiteSettings() {
  const [name, setName] = useState('')
  const [domain, setDomain] = useState('')
  const [language, setLanguage] = useState('en')
  const [logo, setLogo] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)

  const saveMutation = useMutation({
    mutationFn: async () => {
      // Save each setting as a key-value pair
      const settings = { site_name: name, site_domain: domain, site_language: language, site_logo: logo }
      for (const [key, value] of Object.entries(settings)) {
        await api('/kritano/webhook', {
          method: 'POST',
          body: { event: 'settings.update', key, value },
          auth: true,
        }).catch(() => {})
      }
    },
    onSuccess: () => {
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    },
  })

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Site Settings</h2>

      <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-6">
        <Input label="Site name" value={name} onChange={(e) => setName(e.target.value)} placeholder="My Site" />
        <Input label="Domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://mysite.com" />

        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Default language</label>
          <select
            value={language}
            onChange={(e) => setLanguage(e.target.value)}
            className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.value} value={lang.value}>{lang.label}</option>
            ))}
          </select>
        </div>

        <MediaField label="Logo" value={logo} onChange={setLogo} />

        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : saved ? '✓ Saved' : 'Save settings'}
        </Button>
      </div>
    </div>
  )
}
