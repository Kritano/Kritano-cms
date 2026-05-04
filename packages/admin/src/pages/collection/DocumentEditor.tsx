import { useState, useEffect, useCallback, useRef } from 'react'
import { useNavigate } from '@tanstack/react-router'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Save } from 'lucide-react'
import type { FieldDefinition, Block } from '@kritano/cms/types'
import { api } from '@/lib/api'
import { FieldRenderer } from '@/components/fields/FieldRenderer'
import { Editor } from '@/components/editor/Editor'
import { BlockBuilder } from '@/components/blocks/BlockBuilder'
import { EditorSidebar } from '@/components/sidebar/EditorSidebar'

interface Props {
  collection: string
  id?: string // undefined = new document
}

export function DocumentEditor({ collection, id }: Props) {
  const navigate = useNavigate({ from: id ? '/admin/$collection/$id' : '/admin/$collection/new' })
  const queryClient = useQueryClient()
  const [fields, setFields] = useState<Record<string, unknown>>({})
  const [dirty, setDirty] = useState(false)
  const [saveState, setSaveState] = useState<'saved' | 'saving' | 'unsaved'>('saved')
  const [docId, setDocId] = useState<string | undefined>(id)
  const autoSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch collection schemas from the API (dynamic — matches consumer's cms.config.ts)
  const { data: schemaData } = useQuery({
    queryKey: ['cms-schema'],
    queryFn: () => api<{ collections: Array<{ name: string; fields: Record<string, FieldDefinition> }> }>('/admin/schema'),
    staleTime: 5 * 60 * 1000,
  })

  const schema = schemaData?.collections?.find((c) => c.name === collection)
  if (!schema) return <div className="py-8 text-center text-sm text-gray-500">Loading...</div>

  const hasSeo = Object.values(schema.fields).some((f) => (f as FieldDefinition).type === 'seoBlock')

  // Load existing document
  const { data: docData } = useQuery({
    queryKey: ['document', collection, id],
    queryFn: () => api<any>(`/${collection}/${id}`),
    enabled: !!id,
  })

  useEffect(() => {
    if (docData?.data) {
      const doc = docData.data
      const vals: Record<string, unknown> = {}
      for (const key of Object.keys(schema.fields)) {
        // Map snake_case DB columns back to camelCase field names
        const snakeKey = key.replace(/([A-Z])/g, '_$1').toLowerCase()
        let value = doc[key] ?? doc[snakeKey] ?? null

        // Parse JSON strings for JSONB fields (blocks, arrays, richText, seo)
        if (typeof value === 'string' && value.startsWith('[') || typeof value === 'string' && value.startsWith('{')) {
          try { value = JSON.parse(value) } catch {}
        }

        vals[key] = value
      }
      setFields(vals)
      setDirty(false)
      setSaveState('saved')
    }
  }, [docData])

  function updateField(name: string, value: unknown) {
    setFields((prev) => ({ ...prev, [name]: value }))
    setDirty(true)
    setSaveState('unsaved')
    scheduleAutoSave()
  }

  // Auto-save (30 second debounce)
  function scheduleAutoSave() {
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current)
    autoSaveTimer.current = setTimeout(() => save(), 30_000)
  }

  // Save
  const saveMutation = useMutation({
    mutationFn: async (data: Record<string, unknown>) => {
      if (docId) {
        return api<any>(`/${collection}/${docId}`, { method: 'PATCH', body: data })
      } else {
        return api<any>(`/${collection}`, { method: 'POST', body: data })
      }
    },
    onSuccess: (result) => {
      if (!docId && result?.data?.id) {
        setDocId(result.data.id)
        navigate({
          to: '/admin/$collection/$id',
          params: { collection, id: result.data.id },
          replace: true,
        })
      }
      queryClient.invalidateQueries({ queryKey: ['document', collection] })
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      setDirty(false)
      setSaveState('saved')
    },
  })

  const save = useCallback(() => {
    if (!dirty && docId) return
    setSaveState('saving')
    saveMutation.mutate(fields)
  }, [fields, dirty, docId])

  // Publish / Unpublish
  const publishMutation = useMutation({
    mutationFn: async (action: 'publish' | 'unpublish') => {
      if (!docId) {
        // Save first, then publish
        const result = await api<any>(`/${collection}`, { method: 'POST', body: fields })
        const newId = result.data.id
        setDocId(newId)
        return api<any>(`/${collection}/${newId}/${action}`, { method: 'POST' })
      }
      // Save current changes first
      await api<any>(`/${collection}/${docId}`, { method: 'PATCH', body: fields })
      return api<any>(`/${collection}/${docId}/${action}`, { method: 'POST' })
    },
    onSuccess: (result) => {
      if (result?.data) {
        const doc = result.data
        setFields((prev) => ({ ...prev, status: doc.status }))
        if (!docId && doc.id) {
          setDocId(doc.id)
          navigate({ to: '/admin/$collection/$id', params: { collection, id: doc.id }, replace: true })
        }
      }
      queryClient.invalidateQueries({ queryKey: ['document', collection] })
      queryClient.invalidateQueries({ queryKey: ['collection', collection] })
      setDirty(false)
      setSaveState('saved')
    },
  })

  // Unsaved changes warning
  useEffect(() => {
    function handleBeforeUnload(e: BeforeUnloadEvent) {
      if (dirty) {
        e.preventDefault()
        e.returnValue = ''
      }
    }
    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => window.removeEventListener('beforeunload', handleBeforeUnload)
  }, [dirty])

  // Cleanup auto-save timer
  useEffect(() => {
    return () => { if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current) }
  }, [])

  const status = (fields.status as string) || (docData?.data?.status) || 'draft'
  const slugValue = fields.slug as string | undefined
  const previewUrl = slugValue ? `${window.location.origin}/${collection}/${slugValue}` : null

  return (
    <div className="flex h-full gap-0">
      {/* Main content area */}
      <div className="flex-1 space-y-5 overflow-y-auto pr-4">
        {/* Save indicator */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {docId ? 'Edit' : 'New'} {collection}
          </h2>
          <div className="flex items-center gap-3">
            <span className="text-xs text-gray-400">
              {saveState === 'saved' && '✓ Saved'}
              {saveState === 'saving' && 'Saving…'}
              {saveState === 'unsaved' && '● Unsaved changes'}
            </span>
            <button
              onClick={save}
              disabled={saveMutation.isPending || (!dirty && !!docId)}
              className="inline-flex items-center gap-1.5 rounded-md bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50"
            >
              <Save size={14} />
              Save
            </button>
          </div>
        </div>

        {/* Wait for document to load before rendering fields (prevents TipTap initialising empty) */}
        {id && !docData?.data ? (
          <div className="py-8 text-center text-sm text-gray-400">Loading...</div>
        ) : Object.entries(schema.fields).map(([name, field]) => {
          const f = field as FieldDefinition
          // Skip status (handled in sidebar), seoBlock (handled in sidebar)
          if (name === 'status') return null
          if (f.type === 'seoBlock') return null

          // Rich text gets the full editor
          if (f.type === 'richText') {
            return (
              <Editor
                key={name}
                label={name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
                content={fields[name]}
                onChange={(val) => updateField(name, val)}
              />
            )
          }

          // Blocks get the block builder
          if (f.type === 'blocks') {
            return (
              <div key={name} className="space-y-2">
                <label className="text-sm font-medium text-gray-700">
                  {name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
                </label>
                <BlockBuilder
                  blockDefs={f.blocks || []}
                  value={(fields[name] || []) as Block[]}
                  onChange={(val) => updateField(name, val)}
                />
              </div>
            )
          }

          return (
            <FieldRenderer
              key={name}
              name={name}
              label={name.charAt(0).toUpperCase() + name.slice(1).replace(/([A-Z])/g, ' $1')}
              field={f}
              value={fields[name]}
              onChange={(val) => updateField(name, val)}
              allValues={fields}
            />
          )
        })
        }
      </div>

      {/* Right sidebar */}
      <EditorSidebar
        status={status}
        createdAt={docData?.data?.created_at || null}
        updatedAt={docData?.data?.updated_at || null}
        publishedAt={docData?.data?.published_at || null}
        onPublish={() => publishMutation.mutate('publish')}
        onUnpublish={() => publishMutation.mutate('unpublish')}
        publishLoading={publishMutation.isPending}
        hasSeo={hasSeo}
        seoValue={fields.seo}
        onSeoChange={(val) => updateField('seo', val)}
        previewUrl={previewUrl}
        collection={collection}
        documentId={docId || null}
        onRestore={() => {
          queryClient.invalidateQueries({ queryKey: ['document', collection, docId] })
        }}
      />
    </div>
  )
}
