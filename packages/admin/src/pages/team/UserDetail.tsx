import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Badge } from '@/components/ui/Badge'
import { Check } from 'lucide-react'

interface Role {
  id: string
  name: string
}

interface UserDetail {
  id: string
  email: string
  name: string | null
  two_factor_enabled: boolean
  created_at: string
  updated_at: string
  roles: Role[]
}

export function UserDetail({ id }: { id: string }) {
  const queryClient = useQueryClient()
  const [selectedRoleId, setSelectedRoleId] = useState('')
  const [editName, setEditName] = useState('')
  const [editEmail, setEditEmail] = useState('')
  const [saveSuccess, setSaveSuccess] = useState(false)

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api<{ data: UserDetail }>(`/admin/users/${id}`),
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ data: Role[] }>('/admin/roles'),
  })

  const user = userData?.data

  useEffect(() => {
    if (user) {
      setEditName(user.name || '')
      setEditEmail(user.email)
    }
  }, [user])

  const updateUser = useMutation({
    mutationFn: (data: { name?: string; email?: string }) =>
      api(`/admin/users/${id}`, { method: 'PATCH', body: data }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      queryClient.invalidateQueries({ queryKey: ['users'] })
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 2000)
    },
  })

  const assignRole = useMutation({
    mutationFn: (roleId: string) =>
      api(`/admin/users/${id}/roles`, { method: 'POST', body: { roleId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user', id] })
      setSelectedRoleId('')
    },
  })

  const removeRole = useMutation({
    mutationFn: (roleId: string) =>
      api(`/admin/users/${id}/roles/${roleId}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['user', id] }),
  })

  if (isLoading) return <p className="text-sm text-gray-500">Loading...</p>
  if (!user) return <p className="text-sm text-gray-500">User not found.</p>

  const allRoles = rolesData?.data ?? []
  const assignedRoleIds = new Set(user.roles.map((r) => r.id))
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id))

  const hasProfileChanges = editName !== (user.name || '') || editEmail !== user.email

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault()
    const updates: { name?: string; email?: string } = {}
    if (editName !== (user?.name || '')) updates.name = editName
    if (editEmail !== user?.email) updates.email = editEmail
    if (Object.keys(updates).length > 0) {
      updateUser.mutate(updates)
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{user.name || user.email}</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Profile</h2>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <Input
            label="Name"
            value={editName}
            onChange={(e) => setEditName(e.target.value)}
            placeholder="Full name"
          />

          <Input
            label="Email"
            type="email"
            value={editEmail}
            onChange={(e) => setEditEmail(e.target.value)}
            placeholder="Email address"
          />

          <div className="flex items-center gap-3">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="font-medium text-gray-500">2FA</span>
                <span className="ml-2">
                  {user.two_factor_enabled ? (
                    <Badge variant="success">Enabled</Badge>
                  ) : (
                    <Badge>Disabled</Badge>
                  )}
                </span>
              </div>
              <div>
                <span className="font-medium text-gray-500">Joined</span>
                <span className="ml-2 text-gray-900">{formatDate(user.created_at)}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="submit"
              size="sm"
              disabled={!hasProfileChanges || updateUser.isPending}
            >
              {updateUser.isPending ? 'Saving...' : 'Save changes'}
            </Button>
            {saveSuccess && (
              <span className="flex items-center gap-1 text-sm text-green-600">
                <Check size={14} />
                Saved
              </span>
            )}
            {updateUser.isError && (
              <span className="text-sm text-red-600">
                {(updateUser.error as any)?.message || 'Failed to save'}
              </span>
            )}
          </div>
        </form>
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Roles</h2>

        <div className="space-y-2">
          {user.roles.map((role) => (
            <div key={role.id} className="flex items-center justify-between rounded-md border border-gray-200 px-3 py-2">
              <Badge variant={role.name === 'super_admin' ? 'warning' : 'default'}>{role.name}</Badge>
              <button
                onClick={() => removeRole.mutate(role.id)}
                className="text-xs text-red-600 hover:underline"
              >
                Remove
              </button>
            </div>
          ))}
          {user.roles.length === 0 && (
            <p className="text-sm text-gray-400">No roles assigned.</p>
          )}
        </div>

        {availableRoles.length > 0 && (
          <div className="mt-4 flex items-center gap-2">
            <select
              value={selectedRoleId}
              onChange={(e) => setSelectedRoleId(e.target.value)}
              className="rounded-md border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Select role...</option>
              {availableRoles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
            <Button
              size="sm"
              disabled={!selectedRoleId || assignRole.isPending}
              onClick={() => selectedRoleId && assignRole.mutate(selectedRoleId)}
            >
              Assign
            </Button>
          </div>
        )}
      </div>
    </div>
  )
}
