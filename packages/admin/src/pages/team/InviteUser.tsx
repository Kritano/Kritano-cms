import { useState } from 'react'
import { useQuery, useMutation } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'

interface Role {
  id: string
  name: string
}

export function InviteUser() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [error, setError] = useState('')

  const { data: rolesData } = useQuery({
    queryKey: ['roles'],
    queryFn: () => api<{ data: Role[] }>('/admin/roles'),
  })

  const createUser = useMutation({
    mutationFn: () =>
      api('/admin/users', {
        method: 'POST',
        body: { name, email, password, roleId: roleId || undefined },
      }),
    onSuccess: () => {
      navigate({ to: '/admin/users' })
    },
    onError: (err: any) => {
      setError(err.message || 'Failed to create user')
    },
  })

  const roles = rolesData?.data ?? []

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold text-gray-900">Create User</h1>

      <div className="rounded-lg border border-gray-200 bg-white p-5">
        <form
          onSubmit={(e) => {
            e.preventDefault()
            setError('')
            if (!email || !password) {
              setError('Email and password are required')
              return
            }
            if (password.length < 8) {
              setError('Password must be at least 8 characters')
              return
            }
            createUser.mutate()
          }}
          className="space-y-4"
        >
          <Input
            label="Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Full name"
          />

          <Input
            label="Email address"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="user@example.com"
          />

          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Minimum 8 characters"
          />

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Role</label>
            <select
              value={roleId}
              onChange={(e) => setRoleId(e.target.value)}
              className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
            >
              <option value="">No role</option>
              {roles.map((role) => (
                <option key={role.id} value={role.id}>{role.name}</option>
              ))}
            </select>
          </div>

          {error && <p className="text-sm text-red-600">{error}</p>}

          <Button type="submit" disabled={createUser.isPending}>
            {createUser.isPending ? 'Creating...' : 'Create user'}
          </Button>
        </form>
      </div>

      <p className="text-sm text-gray-500">
        The user will be able to log in immediately with these credentials.
      </p>
    </div>
  )
}
