import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'

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

  const { data: userData, isLoading } = useQuery({
    queryKey: ['user', id],
    queryFn: () => api<{ data: UserDetail }>(`/admin/users/${id}`),
  })

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ data: Role[] }>('/admin/roles'),
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

  if (isLoading) return <p className="text-sm text-gray-500">Loading…</p>
  const user = userData?.data
  if (!user) return <p className="text-sm text-gray-500">User not found.</p>

  const allRoles = rolesData?.data ?? []
  const assignedRoleIds = new Set(user.roles.map((r) => r.id))
  const availableRoles = allRoles.filter((r) => !assignedRoleIds.has(r.id))

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">{user.name || user.email}</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <dl className="grid grid-cols-2 gap-4 text-sm">
          <div>
            <dt className="font-medium text-gray-500">Email</dt>
            <dd className="mt-1 text-gray-900">{user.email}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Name</dt>
            <dd className="mt-1 text-gray-900">{user.name || '—'}</dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">2FA</dt>
            <dd className="mt-1">
              {user.two_factor_enabled ? (
                <Badge variant="success">Enabled</Badge>
              ) : (
                <Badge>Disabled</Badge>
              )}
            </dd>
          </div>
          <div>
            <dt className="font-medium text-gray-500">Joined</dt>
            <dd className="mt-1 text-gray-900">{formatDate(user.created_at)}</dd>
          </div>
        </dl>
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
              <option value="">Select role…</option>
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
