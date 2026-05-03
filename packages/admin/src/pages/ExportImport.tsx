import { useState, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { api } from '@/lib/api'
import { getAccessToken } from '@/lib/auth'
import { Button } from '@/components/ui/Button'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils'
import { Download, Upload, Check, AlertTriangle, X } from 'lucide-react'

type Tab = 'export' | 'import'

export function ExportImport() {
  const [tab, setTab] = useState<Tab>('export')

  return (
    <div className="space-y-6">
      <h2 className="text-lg font-semibold text-gray-900">Export / Import</h2>

      <div className="flex gap-1 border-b border-gray-200">
        {(['export', 'import'] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              'px-4 py-2 text-sm font-medium border-b-2 transition-colors capitalize',
              tab === t ? 'border-gray-900 text-gray-900' : 'border-transparent text-gray-500 hover:text-gray-700',
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {tab === 'export' && <ExportTab />}
      {tab === 'import' && <ImportTab />}
    </div>
  )
}

function ExportTab() {
  const [collections, setCollections] = useState<string[]>([])
  const [selectAll, setSelectAll] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | 'published' | 'draft'>('all')
  const [includeMedia, setIncludeMedia] = useState(true)
  const [includeSettings, setIncludeSettings] = useState(false)
  const [exporting, setExporting] = useState(false)

  const { data: schemaData } = useQuery({
    queryKey: ['cms-schema'],
    queryFn: () => api<{ collections: Array<{ name: string }> }>('/admin/schema'),
    staleTime: 5 * 60 * 1000,
  })

  const allCollections = schemaData?.collections?.map((c) => c.name) ?? []

  async function handleExport() {
    setExporting(true)
    try {
      const token = getAccessToken()
      const res = await fetch('/api/plugins/@kritano/cms-plugin-io/export', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          collections: selectAll ? 'all' : collections,
          statusFilter,
          includeMedia,
          includeSettings,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: { message: 'Export failed' } }))
        alert(err.error?.message || 'Export failed')
        return
      }

      // Download the ZIP
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `export-${new Date().toISOString().slice(0, 10)}.zip`
      a.click()
      URL.revokeObjectURL(url)
    } catch (err: any) {
      alert(err.message || 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6 rounded-lg border border-gray-200 bg-white p-6">
      <div>
        <h3 className="mb-3 text-sm font-semibold text-gray-900">Collections to export</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={selectAll} onChange={(e) => setSelectAll(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm font-medium text-gray-700">Select all</span>
          </label>
          {!selectAll && allCollections.map((name) => (
            <label key={name} className="flex items-center gap-2 cursor-pointer ml-6">
              <input
                type="checkbox"
                checked={collections.includes(name)}
                onChange={(e) => setCollections(e.target.checked ? [...collections, name] : collections.filter((c) => c !== name))}
                className="h-4 w-4 rounded"
              />
              <span className="text-sm text-gray-700">{name.charAt(0).toUpperCase() + name.slice(1)}s</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Status filter</h3>
        <div className="space-y-1.5">
          {(['all', 'published', 'draft'] as const).map((s) => (
            <label key={s} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="status" checked={statusFilter === s} onChange={() => setStatusFilter(s)} className="h-4 w-4" />
              <span className="text-sm text-gray-700 capitalize">{s === 'all' ? 'All documents' : `${s} only`}</span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-gray-900">Options</h3>
        <div className="space-y-2">
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeMedia} onChange={(e) => setIncludeMedia(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-gray-700">Include media files</span>
          </label>
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={includeSettings} onChange={(e) => setIncludeSettings(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-gray-700">Include site settings</span>
          </label>
        </div>
      </div>

      <Button onClick={handleExport} disabled={exporting} className="w-full">
        <Download size={16} className="mr-1.5" />
        {exporting ? 'Exporting...' : 'Export now'}
      </Button>
    </div>
  )
}

function ImportTab() {
  const fileRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [validating, setValidating] = useState(false)
  const [importing, setImporting] = useState(false)
  const [validation, setValidation] = useState<any>(null)
  const [conflictStrategy, setConflictStrategy] = useState<'skip' | 'overwrite' | 'duplicate'>('skip')
  const [importMedia, setImportMedia] = useState(true)
  const [result, setResult] = useState<any>(null)

  async function handleFile(file: File) {
    if (!file.name.endsWith('.zip')) {
      alert('Only .zip files are accepted')
      return
    }

    setValidating(true)
    setValidation(null)
    setResult(null)

    const formData = new FormData()
    formData.append('file', file)

    try {
      const token = getAccessToken()
      const res = await fetch('/api/plugins/@kritano/cms-plugin-io/import/validate', {
        method: 'POST',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
        body: formData,
      })

      const data = await res.json()
      setValidation(data)
    } catch (err: any) {
      alert(err.message || 'Validation failed')
    } finally {
      setValidating(false)
    }
  }

  async function handleImport() {
    if (!validation?.uploadId) return
    setImporting(true)

    try {
      const token = getAccessToken()
      const res = await fetch('/api/plugins/@kritano/cms-plugin-io/import/run', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          uploadId: validation.uploadId,
          conflictStrategy,
          importMedia,
        }),
      })

      const data = await res.json()
      setResult(data)
      setValidation(null)
    } catch (err: any) {
      alert(err.message || 'Import failed')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="max-w-lg space-y-6">
      {/* Upload */}
      {!validation && !result && (
        <div
          onDrop={(e) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]) }}
          onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
          onDragLeave={() => setIsDragging(false)}
          onClick={() => fileRef.current?.click()}
          className={cn(
            'cursor-pointer rounded-lg border-2 border-dashed px-6 py-12 text-center transition-colors',
            isDragging ? 'border-gray-900 bg-gray-50' : 'border-gray-300 hover:border-gray-400',
          )}
        >
          <input ref={fileRef} type="file" accept=".zip" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleFile(e.target.files[0]); e.target.value = '' }} />
          <Upload size={24} className="mx-auto mb-2 text-gray-400" />
          {validating ? (
            <p className="text-sm text-gray-600">Validating...</p>
          ) : (
            <>
              <p className="text-sm text-gray-600"><span className="font-medium text-gray-900">Click to upload</span> or drag and drop</p>
              <p className="mt-1 text-xs text-gray-400">Accepts .zip export packages</p>
            </>
          )}
        </div>
      )}

      {/* Validation result */}
      {validation && !result && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <h3 className="text-sm font-semibold text-gray-900">Import Preview</h3>

          {validation.manifest && (
            <div className="text-sm text-gray-600 space-y-1">
              <p>From: {validation.manifest.exportedFrom}</p>
              <p>CMS version: {validation.manifest.cmsVersion}</p>
              <p>Exported: {new Date(validation.manifest.exportedAt).toLocaleDateString()}</p>
            </div>
          )}

          {(validation.warnings?.length ?? 0) > 0 && (
            <div className="space-y-1.5">
              {validation.warnings.map((w: any, i: number) => (
                <div key={i} className="flex items-start gap-2 rounded bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <AlertTriangle size={12} className="mt-0.5 shrink-0" />
                  {w.message}
                </div>
              ))}
            </div>
          )}

          {validation.preview?.collections && (
            <div>
              <h4 className="mb-2 text-xs font-medium uppercase text-gray-400">Collections</h4>
              <table className="w-full text-sm">
                <thead><tr className="text-left text-xs text-gray-500"><th className="pb-1">Collection</th><th>Total</th><th>New</th><th>Conflicts</th></tr></thead>
                <tbody>
                  {Object.entries(validation.preview.collections).map(([name, info]: [string, any]) => (
                    <tr key={name}>
                      <td className="py-0.5 capitalize">{name}</td>
                      <td>{info.total}</td>
                      <td className="text-green-600">{info.new}</td>
                      <td className="text-amber-600">{info.conflicts}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {validation.preview?.media && (
            <p className="text-sm text-gray-600">
              Media: {validation.preview.media.total} files ({(validation.preview.media.totalSizeBytes / 1024 / 1024).toFixed(1)} MB)
            </p>
          )}

          <div>
            <h4 className="mb-1.5 text-xs font-medium uppercase text-gray-400">Conflict resolution</h4>
            <div className="space-y-1.5">
              {(['skip', 'overwrite', 'duplicate'] as const).map((s) => (
                <label key={s} className="flex items-center gap-2 cursor-pointer">
                  <input type="radio" name="conflict" checked={conflictStrategy === s} onChange={() => setConflictStrategy(s)} className="h-4 w-4" />
                  <span className="text-sm text-gray-700">
                    {s === 'skip' && 'Skip conflicts — keep existing'}
                    {s === 'overwrite' && 'Overwrite — replace existing'}
                    {s === 'duplicate' && 'Duplicate — import as new'}
                  </span>
                </label>
              ))}
            </div>
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={importMedia} onChange={(e) => setImportMedia(e.target.checked)} className="h-4 w-4 rounded" />
            <span className="text-sm text-gray-700">Import media files</span>
          </label>

          <div className="flex gap-3">
            <Button onClick={() => setValidation(null)} variant="secondary">Back</Button>
            <Button onClick={handleImport} disabled={importing || !validation.valid}>
              {importing ? 'Importing...' : 'Run import'}
            </Button>
          </div>
        </div>
      )}

      {/* Result */}
      {result && (
        <div className="rounded-lg border border-gray-200 bg-white p-6 space-y-4">
          <div className="flex items-center gap-2">
            {result.success ? <Check size={20} className="text-green-600" /> : <X size={20} className="text-red-600" />}
            <h3 className="text-sm font-semibold text-gray-900">{result.success ? 'Import complete' : 'Import failed'}</h3>
          </div>

          {result.imported && Object.keys(result.imported).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase text-gray-400">Imported</h4>
              {Object.entries(result.imported).map(([col, count]: [string, any]) => (
                <p key={col} className="text-sm text-gray-600 capitalize">{col}: {count} documents</p>
              ))}
            </div>
          )}

          {result.skipped && Object.keys(result.skipped).length > 0 && (
            <div>
              <h4 className="mb-1 text-xs font-medium uppercase text-gray-400">Skipped</h4>
              {Object.entries(result.skipped).map(([col, count]: [string, any]) => (
                <p key={col} className="text-sm text-gray-500 capitalize">{col}: {count} documents</p>
              ))}
            </div>
          )}

          {result.mediaImported > 0 && <p className="text-sm text-gray-600">Media: {result.mediaImported} files</p>}

          {(result.warnings?.length ?? 0) > 0 && (
            <div className="space-y-1">
              {result.warnings.map((w: string, i: number) => (
                <p key={i} className="text-xs text-amber-600">{w}</p>
              ))}
            </div>
          )}

          <Button onClick={() => { setResult(null); setValidation(null) }} variant="secondary">Done</Button>
        </div>
      )}
    </div>
  )
}
