import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Link } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Plus, Trash2, Inbox } from 'lucide-react'

interface Form {
  id: string
  name: string
  slug: string
  fields: unknown[]
  submission_count: number
  last_submission_at: string | null
  created_at: string
}

export function FormList() {
  const queryClient = useQueryClient()
  const { data, isLoading } = useQuery({
    queryKey: ['forms'],
    queryFn: () => api<{ data: Form[] }>('/admin/forms'),
  })

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/forms/${id}`, { method: 'DELETE' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['forms'] }),
  })

  const forms = data?.data ?? []

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">Forms</h1>
        <Link to="/admin/forms/new">
          <Button size="sm">
            <Plus size={16} className="mr-2" />
            New form
          </Button>
        </Link>
      </div>

      {isLoading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : forms.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">No forms yet.</p>
          <Link to="/admin/forms/new" className="mt-2 inline-block">
            <Button variant="secondary" size="sm">
              <Plus size={16} className="mr-1" />
              Create your first form
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Name</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Fields</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submissions</th>
                <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Last Submission</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200 bg-white">
              {forms.map((form) => (
                <tr key={form.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    <Link to="/admin/forms/$id" params={{ id: form.id }} className="hover:underline">
                      {form.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">{form.slug}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{(form.fields as unknown[]).length}</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    <Link
                      to="/admin/forms/$id/submissions"
                      params={{ id: form.id }}
                      className="inline-flex items-center gap-1 hover:underline"
                    >
                      <Inbox size={14} />
                      {form.submission_count}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {form.last_submission_at ? formatDate(form.last_submission_at) : '—'}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        if (confirm(`Delete form "${form.name}"? All submissions will be lost.`)) {
                          deleteMutation.mutate(form.id)
                        }
                      }}
                      className="text-gray-400 hover:text-red-600"
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
