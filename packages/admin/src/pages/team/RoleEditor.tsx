import { useState, useEffect } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Permissions {
  [key: string]: boolean | Record<string, boolean> | undefined
}

const PERMISSION_GROUPS = [
  {
    key: 'content',
    label: 'Content',
    actions: [
      { key: 'read', label: 'Read content' },
      { key: 'create', label: 'Create content' },
      { key: 'update', label: 'Edit content' },
      { key: 'publish', label: 'Publish content' },
      { key: 'delete', label: 'Delete content' },
    ],
  },
  {
    key: 'media',
    label: 'Media',
    actions: [
      { key: 'read', label: 'View media' },
      { key: 'upload', label: 'Upload media' },
      { key: 'delete', label: 'Delete media' },
    ],
  },
  {
    key: 'users',
    label: 'Users & Roles',
    actions: [],
  },
  {
    key: 'settings',
    label: 'Settings',
    actions: [],
  },
  {
    key: 'forms',
    label: 'Forms',
    actions: [],
  },
  {
    key: 'redirects',
    label: 'Redirects',
    actions: [],
  },
  {
    key: 'webhooks',
    label: 'Webhooks',
    actions: [],
  },
]

function getActionValue(permissions: Permissions, groupKey: string, actionKey: string): boolean {
  const group = permissions[groupKey]
  if (group === true) return true
  if (typeof group === 'object' && group !== null) {
    return (group as Record<string, boolean>)[actionKey] === true
  }
  return false
}

function getGroupValue(permissions: Permissions, groupKey: string): boolean {
  return permissions[groupKey] === true
}

export function RoleEditor({ id }: { id?: string }) {
  const navigate = useNavigate()
  const isNew = !id

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [permissions, setPermissions] = useState<Permissions>({})
  const [isSystem, setIsSystem] = useState(false)
  const [error, setError] = useState('')

  const { data } = useQuery({
    queryKey: ['role', id],
    queryFn: () => api<{ data: { name: string; description: string; permissions: Permissions; is_system: boolean } }>(`/admin/roles/${id}`),
    enabled: !!id,
  })

  useEffect(() => {
    if (data?.data) {
      setName(data.data.name)
      setDescription(data.data.description || '')
      setPermissions(data.data.permissions)
      setIsSystem(data.data.is_system)
    }
  }, [data])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, description, permissions }
      if (isNew) {
        return api('/admin/roles', { method: 'POST', body })
      }
      return api(`/admin/roles/${id}`, { method: 'PUT', body })
    },
    onSuccess: () => navigate({ to: '/admin/roles' }),
    onError: (err: any) => setError(err.message || 'Failed to save role'),
  })

  function toggleGroupAll(groupKey: string) {
    const current = getGroupValue(permissions, groupKey)
    setPermissions((prev) => ({ ...prev, [groupKey]: !current }))
  }

  function toggleAction(groupKey: string, actionKey: string) {
    const current = getActionValue(permissions, groupKey, actionKey)
    const group = permissions[groupKey]

    if (group === true) {
      // Expanding from boolean true to object — set all true except the toggled one
      const groupDef = PERMISSION_GROUPS.find((g) => g.key === groupKey)
      const actions: Record<string, boolean> = {}
      for (const action of groupDef?.actions ?? []) {
        actions[action.key] = action.key === actionKey ? false : true
      }
      setPermissions((prev) => ({ ...prev, [groupKey]: actions }))
    } else if (typeof group === 'object') {
      setPermissions((prev) => ({
        ...prev,
        [groupKey]: { ...(group as Record<string, boolean>), [actionKey]: !current },
      }))
    } else {
      setPermissions((prev) => ({
        ...prev,
        [groupKey]: { [actionKey]: true },
      }))
    }
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">
        {isNew ? 'Create Role' : `Edit Role: ${name}`}
      </h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5 space-y-4">
        <Input
          label="Role name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. content_manager"
          disabled={isSystem}
        />
        <Input
          label="Description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="What can this role do?"
        />
      </div>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <h2 className="mb-4 text-lg font-medium text-gray-900">Permissions</h2>

        <div className="space-y-6">
          {PERMISSION_GROUPS.map((group) => (
            <div key={group.key}>
              <div className="flex items-center justify-between border-b border-gray-100 pb-2 mb-2">
                <span className="text-sm font-medium text-gray-900">{group.label}</span>
                {group.actions.length === 0 && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={getGroupValue(permissions, group.key)}
                      onChange={() => toggleGroupAll(group.key)}
                      className="rounded border-gray-300"
                    />
                    <span className="text-gray-600">Full access</span>
                  </label>
                )}
              </div>
              {group.actions.length > 0 && (
                <div className="grid grid-cols-2 gap-2 pl-2">
                  {group.actions.map((action) => (
                    <label key={action.key} className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={getActionValue(permissions, group.key, action.key)}
                        onChange={() => toggleAction(group.key, action.key)}
                        className="rounded border-gray-300"
                      />
                      <span className="text-gray-600">{action.label}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="flex gap-3">
        <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
          {saveMutation.isPending ? 'Saving…' : isNew ? 'Create role' : 'Save changes'}
        </Button>
        <Button variant="secondary" onClick={() => navigate({ to: '/admin/roles' })}>
          Cancel
        </Button>
      </div>
    </div>
  )
}
