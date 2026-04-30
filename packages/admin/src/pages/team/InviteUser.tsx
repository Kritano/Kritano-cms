import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Trash2 } from 'lucide-react'

interface Role {
  id: string
  name: string
}

interface Invitation {
  id: string
  email: string
  role_name: string
  invited_by_name: string | null
  accepted_at: string | null
  expires_at: string
  created_at: string
}

export function InviteUser() {
  const queryClient = useQueryClient()
  const [email, setEmail] = useState('')
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ data: Role[] }>('/admin/roles'),
  })

  const { data: invitationsData } = useQuery({
    queryKey: ['invitations'],
    queryFn: () => api<{ data: Invitation[] }>('/admin/invitations'),
  })

  const sendInvite = useMutation({
    mutationFn: () => api('/admin/invitations', { method: 'POST', body: { email, roleId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['invitations'] })
      setEmail('')
      setRoleId('')
      setError('')
      setSuccess(`Invitation sent to ${email}`)
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to send invitation')
      setSuccess('')
    },
  })

  const revokeMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/invitations/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['invitations'] }),
  })

  const roles = rolesData?.data ?? []
  const invitations = invitationsData?.data ?? []
  const pending = invitations.filter((i) => !i.accepted_at)

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Invite User</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            if (!email || !roleId) {
              setError('Email and role are required')
              return
            }
            sendInvite.mutate()
          }}
          className="space-y-4"
        >
          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            >
              <option value="">Select a role…</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}
          {success && <p className="text-sm text-green-600">{success}</p>}

          <Button type="submit" disabled={sendInvite.isPending}>
            {sendInvite.isPending ? 'Sending…' : 'Send invitation'}
          </Button>
        </form>
      </div>

      {pending.length > 0 && (
        <div className="rounded-lg border border-gray-200 bg-white p-5">
          <h2 className="mb-4 text-lg font-medium text-gray-900">Pending Invitations</h2>

          <div className="space-y-2">
            {pending.map((inv) => (
              <div key={inv.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
                <div className="space-y-0.5">
                  <p className="text-sm font-medium text-gray-900">{inv.email}</p>
                  <p className="text-xs text-gray-500">
                    <Badge>{inv.role_name}</Badge>
                    <span className="ml-2">Sent {formatDate(inv.created_at)}</span>
                    <span className="ml-2">Expires {formatDate(inv.expires_at)}</span>
                  </p>
                </div>
                <button
                  onClick={() => revokeMutation.mutate(inv.id)}
                  className="text-gray-400 hover:text-red-600"
                  title="Revoke invitation"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
