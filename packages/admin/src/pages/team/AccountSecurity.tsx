import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'

export function AccountSecurity() {
  const queryClient = useQueryClient()

  const { data: meData } = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => api<{ data: { twoFactorEnabled: boolean } }>('/auth/me'),
  })

  const twoFactorEnabled = meData?.data?.twoFactorEnabled ?? false

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Account Security</h1>
      <ChangePasswordSection />
      <ConnectedAccountsSection />
      <TwoFactorSection
        enabled={twoFactorEnabled}
        onUpdate={() => queryClient.invalidateQueries({ queryKey: ['auth', 'me'] })}
      />
    </div>
  )
}

function ChangePasswordSection() {
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const mutation = useMutation({
    mutationFn: () =>
      api('/auth/change-password', {
        method: 'POST',
        body: { currentPassword, newPassword },
      }),
    onSuccess: () => {
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
      setError('')
      setSuccess('Password changed successfully')
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to change password')
      setSuccess('')
    },
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-medium text-gray-900">Change Password</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (newPassword !== confirmPassword) {
            setError('New passwords do not match')
            return
          }
          if (newPassword.length < 8) {
            setError('Password must be at least 8 characters')
            return
          }
          mutation.mutate()
        }}
        className="max-w-sm space-y-4"
      >
        <Input
          label="Current password"
          type="password"
          value={currentPassword}
          onChange={(e) => setCurrentPassword(e.target.value)}
        />
        <Input
          label="New password"
          type="password"
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
        />
        <Input
          label="Confirm new password"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
        />
        {error && <p className="text-sm text-red-600">{error}</p>}
        {success && <p className="text-sm text-green-600">{success}</p>}
        <Button type="submit" disabled={mutation.isPending}>
          {mutation.isPending ? 'Changing…' : 'Change password'}
        </Button>
      </form>
    </div>
  )
}

function TwoFactorSection({ enabled, onUpdate }: { enabled: boolean; onUpdate: () => void }) {
  const [setupData, setSetupData] = useState<{ secret: string; qrCode: string } | null>(null)
  const [verifyCode, setVerifyCode] = useState('')
  const [disablePassword, setDisablePassword] = useState('')
  const [error, setError] = useState('')

  const setupMutation = useMutation({
    mutationFn: () => api<{ data: { secret: string; qrCode: string } }>('/auth/2fa/setup', { method: 'POST' }),
    onSuccess: (data) => {
      setSetupData(data.data)
      setError('')
    },
    onError: (err: any) => setError(err.message || 'Failed to start 2FA setup'),
  })

  const verifyMutation = useMutation({
    mutationFn: () => api('/auth/2fa/verify', { method: 'POST', body: { code: verifyCode } }),
    onSuccess: () => {
      setSetupData(null)
      setVerifyCode('')
      setError('')
      onUpdate()
    },
    onError: (err: any) => setError(err.message || 'Invalid code'),
  })

  const disableMutation = useMutation({
    mutationFn: () =>
      api('/auth/2fa/disable', { method: 'POST', body: { password: disablePassword } }),
    onSuccess: () => {
      setDisablePassword('')
      setError('')
      onUpdate()
    },
    onError: (err: any) => setError(err.message || 'Failed to disable 2FA'),
  })

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-medium text-gray-900">Two-Factor Authentication</h2>
        {enabled && <Badge variant="success">Active</Badge>}
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {!enabled && !setupData && (
        <div>
          <p className="mb-4 text-sm text-gray-600">
            Add an extra layer of security to your account with a TOTP authenticator app.
          </p>
          <Button onClick={() => setupMutation.mutate()} disabled={setupMutation.isPending}>
            {setupMutation.isPending ? 'Setting up…' : 'Enable 2FA'}
          </Button>
        </div>
      )}

      {setupData && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            Scan this QR code with your authenticator app, then enter the 6-digit code below.
          </p>
          <div className="flex justify-center">
            <img src={setupData.qrCode} alt="2FA QR Code" className="h-48 w-48" />
          </div>
          <p className="text-center text-xs text-gray-500">
            Manual entry: <code className="rounded bg-gray-100 px-1.5 py-0.5">{setupData.secret}</code>
          </p>
          <div className="flex items-center gap-2 max-w-xs mx-auto">
            <Input
              value={verifyCode}
              onChange={(e) => setVerifyCode(e.target.value)}
              placeholder="6-digit code"
              maxLength={6}
            />
            <Button onClick={() => verifyMutation.mutate()} disabled={verifyMutation.isPending}>
              Verify
            </Button>
          </div>
        </div>
      )}

      {enabled && (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">
            2FA is active. To disable it, enter your password below.
          </p>
          <div className="flex items-center gap-2 max-w-sm">
            <Input
              type="password"
              value={disablePassword}
              onChange={(e) => setDisablePassword(e.target.value)}
              placeholder="Your password"
            />
            <Button
              variant="danger"
              onClick={() => disableMutation.mutate()}
              disabled={disableMutation.isPending || !disablePassword}
            >
              Disable 2FA
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}

function ConnectedAccountsSection() {
  const queryClient = useQueryClient()
  const [error, setError] = useState('')

  const { data: providersData } = useQuery({
    queryKey: ['oauth-providers'],
    queryFn: () => api<{ providers: string[] }>('/auth/oauth/providers', { auth: false }),
  })

  const { data: accountsData } = useQuery({
    queryKey: ['oauth-accounts'],
    queryFn: () => api<{ data: Array<{ provider: string; email: string; created_at: string }> }>('/auth/oauth/accounts'),
  })

  const unlinkMutation = useMutation({
    mutationFn: (provider: string) =>
      api(`/auth/oauth/${provider}/unlink`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['oauth-accounts'] })
      setError('')
    },
    onError: (err: any) => setError(err.message || 'Failed to disconnect'),
  })

  const availableProviders = providersData?.providers ?? []
  const linkedAccounts = accountsData?.data ?? []

  // Only show if at least one provider is configured
  if (availableProviders.length === 0) return null

  const providerLabels: Record<string, string> = { google: 'Google', github: 'GitHub' }

  return (
    <div className="rounded-lg border border-gray-200 bg-white p-5">
      <h2 className="mb-4 text-lg font-medium text-gray-900">Connected Accounts</h2>
      {error && <p className="mb-3 text-sm text-red-600">{error}</p>}

      <div className="space-y-3">
        {availableProviders.map((provider) => {
          const linked = linkedAccounts.find((a) => a.provider === provider)
          return (
            <div key={provider} className="flex items-center justify-between rounded-md border border-gray-100 px-4 py-3">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-gray-900">{providerLabels[provider] || provider}</span>
                {linked ? (
                  <span className="text-sm text-gray-500">connected as {linked.email}</span>
                ) : (
                  <span className="text-sm text-gray-400">not connected</span>
                )}
              </div>
              {linked ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => unlinkMutation.mutate(provider)}
                  disabled={unlinkMutation.isPending}
                >
                  Disconnect
                </Button>
              ) : (
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => { window.location.href = `/api/auth/oauth/${provider}` }}
                >
                  Connect
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
