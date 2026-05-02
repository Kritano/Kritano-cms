import { useState, useRef, type DragEvent } from 'react'
import { Upload } from 'lucide-react'
import { api } from '@/lib/api'

interface Props {
  onUploadComplete: () => void
}

export function MediaUploader({ onUploadComplete }: Props) {
  const [dragging, setDragging] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)

  async function uploadFiles(files: FileList | File[]) {
    setUploading(true)
    const fileArray = Array.from(files)
    const msgs: string[] = []

    for (const file of fileArray) {
      msgs.push(`Uploading ${file.name}…`)
      setProgress([...msgs])
      const form = new FormData()
      form.append('file', file)
      try {
        await api('/media/upload', { method: 'POST', body: form })
        msgs[msgs.length - 1] = `✓ ${file.name}`
      } catch {
        msgs[msgs.length - 1] = `✗ ${file.name} — failed`
      }
      setProgress([...msgs])
    }

    setUploading(false)
    setTimeout(() => { setProgress([]); onUploadComplete() }, 1500)
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault()
    setDragging(false)
    if (e.dataTransfer.files.length) uploadFiles(e.dataTransfer.files)
  }

  function handleDragOver(e: DragEvent) {
    e.preventDefault()
    setDragging(true)
  }

  return (
    <div>
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onDragLeave={() => setDragging(false)}
        onClick={() => inputRef.current?.click()}
        className={`flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed px-6 py-8 transition-colors ${
          dragging ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400'
        }`}
      >
        <Upload size={24} className="mb-2 text-gray-400" />
        <p className="text-sm text-gray-600">
          {uploading ? 'Uploading…' : 'Drop files here or click to upload'}
        </p>
        <p className="mt-1 text-xs text-gray-400">JPG, PNG, GIF, WebP, SVG, PDF</p>
      </div>
      <input
        ref={inputRef}
        type="file"
        multiple
        accept="image/*,.pdf"
        className="hidden"
        onChange={(e) => e.target.files && uploadFiles(e.target.files)}
      />
      {progress.length > 0 && (
        <div className="mt-2 space-y-1">
          {progress.map((msg, i) => (
            <p key={i} className="text-xs text-gray-500">{msg}</p>
          ))}
        </div>
      )}
    </div>
  )
}
