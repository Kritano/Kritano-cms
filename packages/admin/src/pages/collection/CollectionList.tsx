import { useState } from 'react'
import { Link } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Plus, Search, Trash2, ArrowUpCircle, ArrowDownCircle } from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'

interface Props {
  collection: string
}

export function CollectionList({ collection }: Props) {
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['collection', collection],
    queryFn: () => api<any>(`/${collection}?limit=100`),
  })

  const deleteMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api(`/${collection}/${id}`, { method: 'DELETE' })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      setSelected(new Set())
    },
  })

  const publishMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api(`/${collection}/${id}/publish`, { method: 'POST' })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      setSelected(new Set())
    },
  })

  const unpublishMutation = useMutation({
    mutationFn: async (ids: string[]) => {
      await Promise.all(ids.map((id) => api(`/${collection}/${id}/unpublish`, { method: 'POST' })))
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      setSelected(new Set())
    },
  })

  const items = (data?.data || []) as any[]
  const filtered = search
    ? items.filter((item: any) => item.title?.toLowerCase().includes(search.toLowerCase()))
    : items

  function toggleAll() {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((i: any) => i.id)))
    }
  }

  function toggleItem(id: string) {
    const next = new Set(selected)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelected(next)
  }

  function handleBulkDelete() {
    if (confirm(`Delete ${selected.size} document(s)? This cannot be undone.`)) {
      deleteMutation.mutate(Array.from(selected))
    }
  }

  function handleBulkPublish() {
    publishMutation.mutate(Array.from(selected))
  }

  function handleBulkUnpublish() {
    unpublishMutation.mutate(Array.from(selected))
  }

  const bulkLoading = deleteMutation.isPending || publishMutation.isPending || unpublishMutation.isPending
  const title = collection.charAt(0).toUpperCase() + collection.slice(1) + 's'

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <Link to="/admin/$collection/new" params={{ collection }}>
          <Button size="sm">
            <Plus size={16} className="mr-1.5" />
            New {collection}
          </Button>
        </Link>
      </div>

      {/* Search + bulk actions */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search…"
            className="w-full rounded-md border border-gray-300 py-2 pl-9 pr-3 text-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
          />
        </div>
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex items-center gap-2 rounded-md border border-gray-200 bg-gray-50 px-4 py-2.5">
          <span className="text-sm font-medium text-gray-700">{selected.size} selected</span>
          <div className="ml-auto flex gap-2">
            <Button variant="secondary" size="sm" onClick={handleBulkPublish} disabled={bulkLoading}>
              <ArrowUpCircle size={14} className="mr-1" />
              Publish
            </Button>
            <Button variant="secondary" size="sm" onClick={handleBulkUnpublish} disabled={bulkLoading}>
              <ArrowDownCircle size={14} className="mr-1" />
              Unpublish
            </Button>
            <Button variant="danger" size="sm" onClick={handleBulkDelete} disabled={bulkLoading}>
              <Trash2 size={14} className="mr-1" />
              Delete
            </Button>
            <Button variant="ghost" size="sm" onClick={() => setSelected(new Set())}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      {/* Table */}
      {isLoading ? (
        <div className="py-12 text-center text-sm text-gray-400">Loading…</div>
      ) : filtered.length === 0 ? (
        <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
          <p className="text-sm text-gray-500">No {collection}s yet.</p>
          <Link to="/admin/$collection/new" params={{ collection }} className="mt-2 inline-block">
            <Button variant="secondary" size="sm">
              <Plus size={16} className="mr-1" />
              Create your first {collection}
            </Button>
          </Link>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="w-10 px-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleAll}
                    className="rounded border-gray-300"
                  />
                </th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Title</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Status</th>
                <th className="px-3 py-2.5 text-left font-medium text-gray-600">Updated</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item: any) => (
                <tr
                  key={item.id}
                  className="border-b border-gray-100 last:border-0 hover:bg-gray-50"
                >
                  <td className="px-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selected.has(item.id)}
                      onChange={() => toggleItem(item.id)}
                      className="rounded border-gray-300"
                    />
                  </td>
                  <td className="px-3 py-2.5">
                    <Link
                      to="/admin/$collection/$id"
                      params={{ collection, id: item.id }}
                      className="font-medium text-gray-900 hover:text-gray-600"
                    >
                      {item.title || 'Untitled'}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5">
                    <Badge
                      variant={
                        item.status === 'published' ? 'success' :
                        item.status === 'scheduled' ? 'warning' : 'default'
                      }
                    >
                      {item.status}
                    </Badge>
                  </td>
                  <td className="px-3 py-2.5 text-gray-500">
                    {formatDate(item.updated_at)}
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
