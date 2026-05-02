import { useState } from 'react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

type Step = 'welcome' | 'account' | 'site' | 'starter' | 'complete'

const STARTERS = [
  { id: 'default', label: 'Default', description: 'Pages and articles, clean slate' },
  { id: 'blog', label: 'Blog', description: 'Articles, tags, categories, authors' },
  { id: 'portfolio', label: 'Portfolio', description: 'Projects, case studies, about' },
  { id: 'business', label: 'Business', description: 'Pages, blog, team, services' },
]

function passwordStrength(pw: string): 'weak' | 'good' | 'strong' {
  if (pw.length < 12) return 'weak'
  const hasUpper = /[A-Z]/.test(pw)
  const hasLower = /[a-z]/.test(pw)
  const hasNumber = /\d/.test(pw)
  const hasSpecial = /[^A-Za-z0-9]/.test(pw)
  const score = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length
  if (pw.length >= 16 && score >= 3) return 'strong'
  if (score >= 2) return 'good'
  return 'weak'
}

export function Installer() {
  const [step, setStep] = useState<Step>('welcome')
  const [error, setError] = useState('')

  // Account
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  // Site
  const [siteName, setSiteName] = useState('')
  const [domain, setDomain] = useState('')
  const [language, setLanguage] = useState('en')

  // Starter
  const [starter, setStarter] = useState('default')

  // Complete
  const [setting, setSetting] = useState(false)

  async function handleSetup() {
    setSetting(true)
    setError('')

    try {
      const res = await fetch('/api/install/setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, siteName, domain, language, starter }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error?.message || 'Setup failed')
        setSetting(false)
        return
      }

      // Store tokens
      localStorage.setItem('cms_access_token', data.accessToken)
      localStorage.setItem('cms_refresh_token', data.refreshToken)

      setStep('complete')
    } catch {
      setError('Setup failed. Please try again.')
    }
    setSetting(false)
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">

        {/* Step 1 — Welcome */}
        {step === 'welcome' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <h1 className="text-2xl font-bold text-gray-900">Welcome to Kritano CMS</h1>
            <p className="mt-2 text-sm text-gray-500">Let's get your site set up. This takes about two minutes.</p>
            <Button onClick={() => setStep('account')} className="mt-6 w-full">
              Get started
            </Button>
          </div>
        )}

        {/* Step 2 — Account */}
        {step === 'account' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Create your admin account</h2>
            <div className="space-y-4">
              <Input label="Your name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Chris Smith" required autoFocus />
              <Input label="Email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="chris@example.com" required />
              <div>
                <Input label="Password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Minimum 12 characters" required />
                {password && (
                  <div className="mt-1.5 flex items-center gap-2">
                    <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                      <div
                        className={`h-full rounded-full transition-all ${
                          passwordStrength(password) === 'strong' ? 'w-full bg-green-500' :
                          passwordStrength(password) === 'good' ? 'w-2/3 bg-amber-500' :
                          'w-1/3 bg-red-500'
                        }`}
                      />
                    </div>
                    <span className="text-xs text-gray-500 capitalize">{passwordStrength(password)}</span>
                  </div>
                )}
              </div>
              <Input label="Confirm password" type="password" value={confirmPassword} onChange={(e) => setConfirmPassword(e.target.value)} placeholder="Confirm password" required />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <Button
                onClick={() => {
                  setError('')
                  if (!name || !email || !password) { setError('All fields are required'); return }
                  if (password.length < 12) { setError('Password must be at least 12 characters'); return }
                  if (password !== confirmPassword) { setError('Passwords do not match'); return }
                  if (!email.includes('@')) { setError('Enter a valid email address'); return }
                  setStep('site')
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 3 — Site */}
        {step === 'site' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Tell us about your site</h2>
            <div className="space-y-4">
              <Input label="Site name" value={siteName} onChange={(e) => setSiteName(e.target.value)} placeholder="My Site" required autoFocus />
              <Input label="Your domain" value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="https://example.com" />
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-gray-700">Language</label>
                <select value={language} onChange={(e) => setLanguage(e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
                  <option value="en">English</option>
                  <option value="fr">French</option>
                  <option value="de">German</option>
                  <option value="es">Spanish</option>
                  <option value="it">Italian</option>
                  <option value="pt">Portuguese</option>
                  <option value="nl">Dutch</option>
                  <option value="ja">Japanese</option>
                </select>
              </div>
              <Button
                onClick={() => {
                  if (!siteName) { setError('Site name is required'); return }
                  setError('')
                  setStep('starter')
                }}
                className="w-full"
              >
                Continue
              </Button>
            </div>
          </div>
        )}

        {/* Step 4 — Starter */}
        {step === 'starter' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <h2 className="mb-6 text-lg font-semibold text-gray-900">Choose how to start</h2>
            <div className="grid grid-cols-2 gap-3">
              {STARTERS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStarter(s.id)}
                  className={`rounded-lg border-2 p-4 text-left transition-colors ${
                    starter === s.id
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <p className="text-sm font-semibold text-gray-900">{s.label}</p>
                  <p className="mt-1 text-xs text-gray-500">{s.description}</p>
                </button>
              ))}
            </div>
            {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
            <Button onClick={handleSetup} disabled={setting} className="mt-6 w-full">
              {setting ? 'Setting up…' : 'Set up my site'}
            </Button>
          </div>
        )}

        {/* Step 5 — Complete */}
        {step === 'complete' && (
          <div className="rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <div className="space-y-2">
              <p className="text-sm text-green-600">&#10003; Account created</p>
              <p className="text-sm text-green-600">&#10003; Site configured</p>
              <p className="text-sm text-green-600">&#10003; Content schema ready</p>
            </div>
            <h2 className="mt-6 text-lg font-semibold text-gray-900">Your site is ready.</h2>
            <Button onClick={() => { window.location.href = '/admin' }} className="mt-6 w-full">
              Open the admin
            </Button>

            <div className="mt-8 border-t border-gray-200 pt-6">
              <p className="text-sm text-gray-600">
                Want site health scoring, SEO analysis and AI visibility tracking?
              </p>
              <div className="mt-3 flex justify-center gap-3">
                <a
                  href="/admin/site/health"
                  className="rounded-md bg-gray-900 px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
                >
                  Connect Kritano
                </a>
                <button
                  onClick={() => { window.location.href = '/admin' }}
                  className="rounded-md px-4 py-2 text-sm text-gray-500 hover:text-gray-700"
                >
                  Skip for now
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Step indicator */}
        {step !== 'welcome' && step !== 'complete' && (
          <div className="mt-4 flex justify-center gap-1.5">
            {['account', 'site', 'starter'].map((s) => (
              <div
                key={s}
                className={`h-1.5 w-8 rounded-full ${
                  s === step ? 'bg-gray-900' : 'bg-gray-200'
                }`}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
