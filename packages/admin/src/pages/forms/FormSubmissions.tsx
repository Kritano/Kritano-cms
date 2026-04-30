import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Trash2, Download, X } from 'lucide-react'

interface Submission {
  id: string
  data: Record<string, unknown>
  ip_address: string | null
  user_agent: string | null
  created_at: string
}

export function FormSubmissions({ formId }: { formId: string }) {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [selectedSub, setSelectedSub] = useState<Submission | null>(null)

  const { data: formData } = useQuery({
    queryKey: ['form', formId],
    queryFn: () => api<{ data: { name: string; slug: string; fields: { name: string; label: string }[] } }>(`/admin/forms/${formId}`),
  })

  const { data, isLoading } = useQuery({
    queryKey: ['form-submissions', formId, page],
    queryFn: () =>
      api<{ data: Submission[]; total: number; totalPages: number }>(
        `/admin/forms/${formId}/submissions?page=${page}&limit=20`,
      ),
  })

  const deleteMutation = useMutation({
    mutationFn: (subId: string) =>
      api(`/admin/forms/${formId}/submissions/${subId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] })
      if (selectedSub) setSelectedSub(null)
    },
  })

  const form = formData?.data
  const submissions = data?.data ?? []
  const totalPages = data?.totalPages ?? 1
  const fields = form?.fields ?? []

  function handleExport() {
    window.open(`/api/admin/forms/${formId}/export`, '_blank')
  }

  // Get first few field values for table summary
  function getSummary(sub: Submission): string {
    const vals = fields.slice(0, 3).map((f) => {
      const val = sub.data[f.name]
      if (val === null || val === undefined) return ''
      return String(val)
    }).filter(Boolean)
    return vals.join(' · ') || '—'
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Submissions</h1>
          {form && <p className="text-sm text-gray-500">{form.name}</p>}
        </div>
        <Button variant="secondary" size="sm" onClick={handleExport}>
          <Download size={14} className="mr-1.5" />
          Export CSV
        </Button>
      </div>

      <div className="flex gap-6">
        {/* Table */}
        <div className="flex-1 min-w-0">
          {isLoading ? (
            <p className="text-sm text-gray-500">Loading…</p>
          ) : submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
              <p className="text-sm text-gray-500">No submissions yet.</p>
            </div>
          ) : (
            <>
              <div className="overflow-hidden rounded-lg border border-gray-200">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Date</th>
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Summary</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {submissions.map((sub) => (
                      <tr
                        key={sub.id}
                        onClick={() => setSelectedSub(sub)}
                        className={`cursor-pointer hover:bg-gray-50 ${selectedSub?.id === sub.id ? 'bg-gray-50' : ''}`}
                      >
                        <td className="px-4 py-3 text-sm text-gray-600 whitespace-nowrap">
                          {formatDate(sub.created_at)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-900 truncate max-w-xs">
                          {getSummary(sub)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              if (confirm('Delete this submission?')) deleteMutation.mutate(sub.id)
                            }}
                            className="text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {totalPages > 1 && (
                <div className="mt-4 flex items-center justify-center gap-2">
                  <Button variant="secondary" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">Page {page} of {totalPages}</span>
                  <Button variant="secondary" size="sm" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>

        {/* Detail slide-out */}
        {selectedSub && (
          <div className="w-80 shrink-0 rounded-lg border border-gray-200 bg-white p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-gray-900">Submission Detail</h3>
              <button onClick={() => setSelectedSub(null)} className="text-gray-400 hover:text-gray-600">
                <X size={16} />
              </button>
            </div>

            <dl className="space-y-3">
              {fields.map((field) => (
                <div key={field.name}>
                  <dt className="text-xs font-medium text-gray-500">{field.label}</dt>
                  <dd className="mt-0.5 text-sm text-gray-900 break-words">
                    {selectedSub.data[field.name] !== undefined
                      ? String(selectedSub.data[field.name])
                      : '—'}
                  </dd>
                </div>
              ))}

              <div className="border-t border-gray-200 pt-3">
                <dt className="text-xs font-medium text-gray-500">Submitted</dt>
                <dd className="mt-0.5 text-sm text-gray-700">{formatDate(selectedSub.created_at)}</dd>
              </div>
              {selectedSub.ip_address && (
                <div>
                  <dt className="text-xs font-medium text-gray-500">IP Address</dt>
                  <dd className="mt-0.5 text-sm text-gray-700">{selectedSub.ip_address}</dd>
                </div>
              )}
            </dl>

            <div className="mt-4">
              <Button
                variant="danger"
                size="sm"
                className="w-full"
                onClick={() => {
                  if (confirm('Delete this submission?')) deleteMutation.mutate(selectedSub.id)
                }}
              >
                <Trash2 size={14} className="mr-1" />
                Delete submission
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
