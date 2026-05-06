import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { Plus, Trash2 } from 'lucide-react'

interface Role {
  id: string
  name: string
  description: string | null
  permissions: Record<string, unknown>
  is_system: boolean
  user_count: number
  created_at: string
}

export function RoleList() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ data: Role[] }>('/admin/roles'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/roles/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['roles'] }),
  })

  const roles = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Roles</h1>
        <Link to="/admin/roles/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            Create role
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <>
          {/* Desktop table */}
          <div className="hidden overflow-hidden rounded-lg border border-gray-200 sm:block">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Description</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Users</th>
                  <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Type</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {roles.map((role) => (
                  <tr key={role.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">
                      <Link to="/admin/roles/$id" params={{ id: role.id }} className="hover:underline">
                        {role.name}
                      </Link>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">{role.description || '—'}</td>
                    <td className="px-4 py-3 text-sm text-gray-600">{role.user_count}</td>
                    <td className="px-4 py-3">
                      {role.is_system ? (
                        <Badge variant="warning">System</Badge>
                      ) : (
                        <Badge>Custom</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      {!role.is_system && (
                        <button
                          onClick={() => {
                            if (confirm(`Delete role "${role.name}"?`)) {
                              deleteMutation.mutate(role.id)
                            }
                          }}
                          className="p-2 text-gray-400 hover:text-red-600"
                          title="Delete role"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile cards */}
          <div className="space-y-2 sm:hidden">
            {roles.map((role) => (
              <div key={role.id} className="rounded-lg border border-gray-200 bg-white p-3">
                <div className="flex items-start justify-between gap-2">
                  <Link to="/admin/roles/$id" params={{ id: role.id }} className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="truncate font-medium text-gray-900">{role.name}</p>
                      {role.is_system ? (
                        <Badge variant="warning">System</Badge>
                      ) : (
                        <Badge>Custom</Badge>
                      )}
                    </div>
                    {role.description && (
                      <p className="mt-0.5 text-xs text-gray-500">{role.description}</p>
                    )}
                  </Link>
                  {!role.is_system && (
                    <button
                      onClick={() => {
                        if (confirm(`Delete role "${role.name}"?`)) {
                          deleteMutation.mutate(role.id)
                        }
                      }}
                      className="shrink-0 p-1 text-gray-400 hover:text-red-600"
                      title="Delete role"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
                <p className="mt-1.5 text-xs text-gray-400">{role.user_count} user{role.user_count !== 1 ? 's' : ''}</p>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
