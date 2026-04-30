import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { MediaGrid } from '@/components/media/MediaGrid'
import { MediaUploader } from '@/components/media/MediaUploader'
import { MediaDetail } from '@/components/media/MediaDetail'
import { Button } from '@/components/ui/Button'
import { FolderPlus, Folder, FolderOpen, Trash2, Image } from 'lucide-react'

interface MediaFolder {
  id: string
  name: string
  parent_id: string | null
  file_count: number
}

export function Media() {
  const queryClient = useQueryClient()
  const [selectedMedia, setSelectedMedia] = useState<any>(null)
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null) // null = all media
  const [newFolderName, setNewFolderName] = useState('')
  const [showNewFolder, setShowNewFolder] = useState(false)

  // Folders
  const { data: foldersData } = useQuery({
    queryKey: ['media-folders'],
    queryFn: () => api<{ data: MediaFolder[] }>('/admin/media/folders'),
  })

  // Media items (filtered by folder)
  const folderQuery = activeFolderId ? `?limit=200&folderId=${activeFolderId}` : '?limit=200'
  const { data: mediaData, refetch } = useQuery({
    queryKey: ['media', activeFolderId],
    queryFn: () => api<any>(`/media${folderQuery}`),
  })

  const createFolderMutation = useMutation({
    mutationFn: () => api('/admin/media/folders', { method: 'POST', body: { name: newFolderName } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] })
      setNewFolderName('')
      setShowNewFolder(false)
    },
  })

  const deleteFolderMutation = useMutation({
    mutationFn: (id: string) => api(`/admin/media/folders/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media-folders'] })
      if (activeFolderId) setActiveFolderId(null)
    },
    onError: (err: any) => alert(err.message || 'Cannot delete folder'),
  })

  const moveMutation = useMutation({
    mutationFn: ({ mediaId, folderId }: { mediaId: string; folderId: string | null }) =>
      api(`/media/${mediaId}/folder`, { method: 'PATCH', body: { folderId } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['media'] })
      queryClient.invalidateQueries({ queryKey: ['media-folders'] })
    },
  })

  const folders = foldersData?.data ?? []
  const items = (mediaData?.data || []) as any[]

  function handleFolderDrop(e: React.DragEvent, folderId: string | null) {
    e.preventDefault()
    const mediaId = e.dataTransfer.getData('text/media-id')
    if (mediaId) {
      moveMutation.mutate({ mediaId, folderId })
    }
  }

  return (
    <div className="flex gap-6">
      {/* Folder sidebar */}
      <div className="w-48 shrink-0 space-y-1">
        <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Folders</p>

        <button
          onClick={() => setActiveFolderId(null)}
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => handleFolderDrop(e, null)}
          className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
            activeFolderId === null ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
          }`}
        >
          <Image size={14} />
          All media
        </button>

        {folders.map((folder) => (
          <div
            key={folder.id}
            className="group flex items-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => handleFolderDrop(e, folder.id)}
          >
            <button
              onClick={() => setActiveFolderId(folder.id)}
              className={`flex flex-1 items-center gap-2 rounded-md px-2 py-1.5 text-sm ${
                activeFolderId === folder.id ? 'bg-gray-100 font-medium text-gray-900' : 'text-gray-600 hover:bg-gray-50'
              }`}
            >
              {activeFolderId === folder.id ? <FolderOpen size={14} /> : <Folder size={14} />}
              <span className="truncate">{folder.name}</span>
              <span className="ml-auto text-xs text-gray-400">{folder.file_count}</span>
            </button>
            <button
              onClick={() => {
                if (confirm(`Delete folder "${folder.name}"?`)) deleteFolderMutation.mutate(folder.id)
              }}
              className="hidden group-hover:block px-1 text-gray-400 hover:text-red-600"
            >
              <Trash2 size={12} />
            </button>
          </div>
        ))}

        {showNewFolder ? (
          <div className="flex gap-1">
            <input
              autoFocus
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newFolderName) createFolderMutation.mutate()
                if (e.key === 'Escape') setShowNewFolder(false)
              }}
              placeholder="Folder name"
              className="flex-1 rounded border border-gray-300 px-2 py-1 text-xs"
            />
            <Button
              size="sm"
              onClick={() => newFolderName && createFolderMutation.mutate()}
              disabled={!newFolderName}
              className="!h-7 !px-2 !text-xs"
            >
              Add
            </Button>
          </div>
        ) : (
          <button
            onClick={() => setShowNewFolder(true)}
            className="flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-sm text-gray-500 hover:bg-gray-50 hover:text-gray-700"
          >
            <FolderPlus size={14} />
            New folder
          </button>
        )}
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-4">
        <h2 className="text-lg font-semibold text-gray-900">Media Library</h2>

        <MediaUploader onUploadComplete={() => refetch()} />

        <MediaGrid
          items={items}
          selectedId={selectedMedia?.id}
          onSelect={(media) => setSelectedMedia(media)}
          draggable
        />

        {selectedMedia && (
          <MediaDetail
            media={selectedMedia}
            onClose={() => setSelectedMedia(null)}
          />
        )}
      </div>
    </div>
  )
}
