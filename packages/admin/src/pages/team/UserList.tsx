import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { UserPlus, Trash2 } from 'lucide-react'

interface User {
  id: string
  email: string
  name: string | null
  two_factor_enabled: boolean
  created_at: string
  roles: { id: string; name: string }[]
}

export function UserList() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['users'],
    queryFn: () => api<{ data: User[]; total: number }>('/admin/users'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/users/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['users'] }),
  })

  const users = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Users</h1>
        <Link to="/admin/users/invite">
          <Button size="sm">
            <UserPlus size={16} className="mr-2" />
            Create user
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : users.length === 0 ? (
        <p className="text-sm text-gray-500">No users found.</p>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Email</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Roles</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">2FA</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Joined</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {users.map((user) => (
                <tr key={user.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link to="/admin/users/$id" params={{ id: user.id }} className="hover:underline">
                      {user.name || '—'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{user.email}</td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {user.roles.map((role) => (
                        <Badge key={role.id} variant={role.name === 'super_admin' ? 'warning' : 'default'}>
                          {role.name}
                        </Badge>
                      ))}
                      {user.roles.length === 0 && <span className="text-xs text-gray-400">No roles</span>}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {user.two_factor_enabled ? (
                      <Badge variant="success">Enabled</Badge>
                    ) : (
                      <span className="text-gray-400">Off</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{formatDate(user.created_at)}</td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm('Deactivate this user? This cannot be undone.')) {
                          deleteMutation.mutate(user.id)
                        }
                      }}
                      className="text-gray-400 hover:text-red-600"
                      title="Deactivate user"
                    >
                      <Trash2 size={16} />
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
