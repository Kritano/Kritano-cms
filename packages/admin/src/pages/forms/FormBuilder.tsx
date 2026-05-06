import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from '@tanstack/react-router'
import { api } from '@/lib/api'
import { formatDate } from '@/lib/utils'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { GripVertical, Trash2, Plus, Settings, Code, Inbox, Download, ChevronLeft, ChevronRight } from 'lucide-react'

interface FormField {
  name: string
  type: string
  label: string
  placeholder?: string
  required?: boolean
  helpText?: string
  options?: string[]
  rows?: number
  acceptedTypes?: string
  maxSizeMb?: number
  minLength?: number
  maxLength?: number
}

interface FormSettings {
  submitLabel?: string
  notificationEmail?: string
  successMessage?: string
  redirectUrl?: string
}

interface Submission {
  id: string
  data: Record<string, unknown>
  ip_address: string | null
  created_at: string
}

const FIELD_TYPES = [
  { type: 'text', label: 'Text' },
  { type: 'email', label: 'Email' },
  { type: 'phone', label: 'Phone' },
  { type: 'textarea', label: 'Textarea' },
  { type: 'select', label: 'Select' },
  { type: 'checkbox', label: 'Checkbox' },
  { type: 'file', label: 'File' },
  { type: 'date', label: 'Date' },
]

export function FormBuilder({ id }: { id?: string }) {
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const isNew = !id

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [fields, setFields] = useState<FormField[]>([])
  const [settings, setSettings] = useState<FormSettings>({})
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [activeTab, setActiveTab] = useState<'fields' | 'settings' | 'embed' | 'submissions'>('fields')
  const [error, setError] = useState('')
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [subPage, setSubPage] = useState(1)

  const { data } = useQuery({
    queryKey: ['form', id],
    queryFn: () => api<{ data: any }>(`/admin/forms/${id}`),
    enabled: !!id,
  })

  useEffect(() => {
    if (data?.data) {
      setName(data.data.name)
      setSlug(data.data.slug)
      const rawFields = data.data.fields
      setFields(Array.isArray(rawFields) ? rawFields : typeof rawFields === 'string' ? JSON.parse(rawFields) : [])
      const rawSettings = data.data.settings
      setSettings(typeof rawSettings === 'string' ? JSON.parse(rawSettings) : rawSettings || {})
    }
  }, [data])

  // Auto-generate slug from name
  useEffect(() => {
    if (isNew && name) {
      setSlug(name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''))
    }
  }, [name, isNew])

  const saveMutation = useMutation({
    mutationFn: async () => {
      const body = { name, slug, fields, settings }
      if (isNew) return api('/admin/forms', { method: 'POST', body })
      return api(`/admin/forms/${id}`, { method: 'PUT', body })
    },
    onSuccess: () => navigate({ to: '/admin/forms' }),
    onError: (err: any) => setError(err.message || 'Failed to save form'),
  })

  // Submissions query
  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['form-submissions', id, subPage],
    queryFn: () =>
      api<{ data: Submission[]; total: number; totalPages: number }>(
        `/admin/forms/${id}/submissions?page=${subPage}&limit=20`,
      ),
    enabled: activeTab === 'submissions' && !!id,
  })

  const deleteSubMutation = useMutation({
    mutationFn: (subId: string) =>
      api(`/admin/forms/${id}/submissions/${subId}`, { method: 'DELETE' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-submissions', id] })
    },
  })

  function addField(type: string) {
    const label = FIELD_TYPES.find((t) => t.type === type)?.label || type
    const fieldName = `${type}_${fields.length + 1}`
    const newField: FormField = { name: fieldName, type, label, required: false }
    if (type === 'select') newField.options = ['Option 1', 'Option 2']
    if (type === 'textarea') newField.rows = 4
    setFields([...fields, newField])
    setSelectedIndex(fields.length)
  }

  function removeField(index: number) {
    setFields(fields.filter((_, i) => i !== index))
    if (selectedIndex === index) setSelectedIndex(null)
    else if (selectedIndex !== null && selectedIndex > index) setSelectedIndex(selectedIndex - 1)
  }

  function updateField(index: number, updates: Partial<FormField>) {
    setFields(fields.map((f, i) => (i === index ? { ...f, ...updates } : f)))
  }

  function handleDragStart(index: number) {
    setDragIndex(index)
  }

  function handleDragOver(e: React.DragEvent, index: number) {
    e.preventDefault()
    if (dragIndex === null || dragIndex === index) return
    const reordered = [...fields]
    const [moved] = reordered.splice(dragIndex, 1)
    reordered.splice(index, 0, moved)
    setFields(reordered)
    setDragIndex(index)
    if (selectedIndex === dragIndex) setSelectedIndex(index)
  }

  function handleDragEnd() {
    setDragIndex(null)
  }

  const selectedField = selectedIndex !== null ? fields[selectedIndex] : null
  const siteUrl = window.location.origin
  const submissions = subsData?.data ?? []
  const subTotalPages = subsData?.totalPages ?? 1
  const displayFields = fields.slice(0, 4)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold text-gray-900">
          {isNew ? 'New Form' : `Edit: ${name}`}
        </h1>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => navigate({ to: '/admin/forms' })}>
            Cancel
          </Button>
          <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
            {saveMutation.isPending ? 'Saving…' : 'Save form'}
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Input label="Form name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Contact Form" />
        <Input label="Slug" value={slug} onChange={(e) => setSlug(e.target.value)} placeholder="contact" />
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-gray-200">
        {[
          { key: 'fields' as const, label: 'Fields', icon: Plus },
          { key: 'settings' as const, label: 'Settings', icon: Settings },
          { key: 'embed' as const, label: 'Embed', icon: Code },
          ...(!isNew ? [{ key: 'submissions' as const, label: 'Submissions', icon: Inbox }] : []),
        ].map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.key
                ? 'border-gray-900 text-gray-900'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <tab.icon size={14} />
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'fields' && (
        <div className="flex flex-col gap-4 lg:flex-row lg:gap-6">
          {/* Field palette */}
          <div className="shrink-0 lg:w-48">
            <p className="mb-2 text-xs font-semibold uppercase text-gray-500">Add field</p>
            <div className="grid grid-cols-4 gap-1.5 sm:grid-cols-4 lg:grid-cols-2">
              {FIELD_TYPES.map((ft) => (
                <button
                  key={ft.type}
                  onClick={() => addField(ft.type)}
                  className="rounded-md border border-gray-200 px-2 py-2 text-xs font-medium text-gray-600 hover:bg-gray-50 hover:border-gray-300 min-h-[36px]"
                >
                  {ft.label}
                </button>
              ))}
            </div>
          </div>

          {/* Form canvas */}
          <div className="flex-1 space-y-2">
            {fields.length === 0 ? (
              <div className="rounded-lg border border-dashed border-gray-300 py-16 text-center">
                <p className="text-sm text-gray-400">Drag fields from the palette or click to add.</p>
              </div>
            ) : (
              fields.map((field, idx) => (
                <div
                  key={idx}
                  draggable
                  onDragStart={() => handleDragStart(idx)}
                  onDragOver={(e) => handleDragOver(e, idx)}
                  onDragEnd={handleDragEnd}
                  onClick={() => setSelectedIndex(idx)}
                  className={`flex items-center gap-2 rounded-md border px-3 py-3 cursor-pointer transition-colors touch-manipulation ${
                    selectedIndex === idx
                      ? 'border-gray-900 bg-gray-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <GripVertical size={14} className="shrink-0 cursor-grab text-gray-400" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900">{field.label}</p>
                    <p className="text-xs text-gray-400">{field.type}{field.required ? ' · required' : ''}</p>
                  </div>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeField(idx) }}
                    className="shrink-0 text-gray-400 hover:text-red-600"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))
            )}
          </div>

          {/* Field settings panel */}
          <div className="shrink-0 lg:w-64">
            {selectedField ? (
              <div className="space-y-3 rounded-lg border border-gray-200 bg-white p-4">
                <p className="text-xs font-semibold uppercase text-gray-500">Field Settings</p>
                <Input
                  label="Label"
                  value={selectedField.label}
                  onChange={(e) => updateField(selectedIndex!, { label: e.target.value })}
                />
                <Input
                  label="Name"
                  value={selectedField.name}
                  onChange={(e) => updateField(selectedIndex!, { name: e.target.value })}
                />
                <Input
                  label="Placeholder"
                  value={selectedField.placeholder || ''}
                  onChange={(e) => updateField(selectedIndex!, { placeholder: e.target.value })}
                />
                <Input
                  label="Help text"
                  value={selectedField.helpText || ''}
                  onChange={(e) => updateField(selectedIndex!, { helpText: e.target.value })}
                />
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={selectedField.required || false}
                    onChange={(e) => updateField(selectedIndex!, { required: e.target.checked })}
                    className="rounded border-gray-300"
                  />
                  <span className="text-gray-600">Required</span>
                </label>

                {selectedField.type === 'select' && (
                  <div className="space-y-1">
                    <label className="text-sm font-medium text-gray-700">Options</label>
                    {(selectedField.options || []).map((opt, i) => (
                      <div key={i} className="flex gap-1">
                        <input
                          value={opt}
                          onChange={(e) => {
                            const opts = [...(selectedField.options || [])]
                            opts[i] = e.target.value
                            updateField(selectedIndex!, { options: opts })
                          }}
                          className="flex-1 rounded-md border border-gray-300 px-2 py-1 text-sm"
                        />
                        <button
                          onClick={() => {
                            const opts = (selectedField.options || []).filter((_, j) => j !== i)
                            updateField(selectedIndex!, { options: opts })
                          }}
                          className="p-2 text-gray-400 hover:text-red-600"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    ))}
                    <button
                      onClick={() => updateField(selectedIndex!, { options: [...(selectedField.options || []), ''] })}
                      className="text-xs text-gray-500 hover:text-gray-700"
                    >
                      + Add option
                    </button>
                  </div>
                )}

                {selectedField.type === 'textarea' && (
                  <Input
                    label="Rows"
                    type="number"
                    value={String(selectedField.rows || 4)}
                    onChange={(e) => updateField(selectedIndex!, { rows: parseInt(e.target.value) || 4 })}
                  />
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-gray-200 p-4 text-center">
                <p className="text-xs text-gray-400">Select a field to edit its settings.</p>
              </div>
            )}
          </div>
        </div>
      )}

      {activeTab === 'settings' && (
        <div className="max-w-lg space-y-4 rounded-lg border border-gray-200 bg-white p-5">
          <Input
            label="Submit button label"
            value={settings.submitLabel || ''}
            onChange={(e) => setSettings({ ...settings, submitLabel: e.target.value })}
            placeholder="Submit"
          />
          <Input
            label="Notification email"
            type="email"
            value={settings.notificationEmail || ''}
            onChange={(e) => setSettings({ ...settings, notificationEmail: e.target.value })}
            placeholder="you@example.com"
          />
          <Input
            label="Success message"
            value={settings.successMessage || ''}
            onChange={(e) => setSettings({ ...settings, successMessage: e.target.value })}
            placeholder="Thanks! We'll be in touch."
          />
          <Input
            label="Redirect URL (optional — overrides success message)"
            value={settings.redirectUrl || ''}
            onChange={(e) => setSettings({ ...settings, redirectUrl: e.target.value })}
            placeholder="https://example.com/thank-you"
          />
          <div className="rounded-md bg-gray-50 p-3 text-xs text-gray-500">
            Honeypot spam protection is always enabled.
          </div>
        </div>
      )}

      {activeTab === 'embed' && slug && (
        <div className="max-w-2xl space-y-6">
          <div className="rounded-lg border border-gray-200 bg-white p-5">
            <h3 className="mb-2 text-sm font-semibold text-gray-900">For Astro (CMS default frontend)</h3>
            <p className="mb-3 text-xs text-gray-500">Use the built-in Form component. Zero JavaScript.</p>
            <pre className="rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">
{`<Form formSlug="${slug}" />`}
            </pre>
            <p className="mt-3 text-xs text-gray-500">Optional inline validation:</p>
            <pre className="rounded-md bg-gray-50 p-3 text-xs text-gray-700 overflow-x-auto">
{`<Form formSlug="${slug}" enhance={true} />`}
            </pre>
          </div>

          <div className="rounded-lg border border-amber-200 bg-amber-50 p-5">
            <h3 className="mb-2 text-sm font-semibold text-amber-900">For non-CMS sites</h3>
            <p className="mb-3 text-xs text-amber-700">
              This embed loads JavaScript on the host page. Use only when the Form component is not available.
            </p>
            <pre className="rounded-md bg-white p-3 text-xs text-gray-700 overflow-x-auto">
{`<div data-cms-form="${slug}"></div>
<script src="${siteUrl}/api/forms/embed.js" async></script>`}
            </pre>
          </div>
        </div>
      )}

      {activeTab === 'submissions' && id && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              {subsData?.total ?? 0} submission{(subsData?.total ?? 0) !== 1 ? 's' : ''}
            </p>
            <a
              href={`/api/admin/forms/${id}/export`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-md border border-gray-200 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              <Download size={14} />
              Export CSV
            </a>
          </div>

          {subsLoading ? (
            <p className="py-8 text-center text-sm text-gray-400">Loading…</p>
          ) : submissions.length === 0 ? (
            <div className="rounded-lg border border-dashed border-gray-300 py-12 text-center">
              <Inbox size={32} className="mx-auto mb-2 text-gray-300" />
              <p className="text-sm text-gray-500">No submissions yet.</p>
            </div>
          ) : (
            <>
              {/* Desktop table */}
              <div className="hidden overflow-x-auto rounded-lg border border-gray-200 sm:block">
                <table className="min-w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50">
                    <tr>
                      {displayFields.map((f) => (
                        <th key={f.name} className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">
                          {f.label}
                        </th>
                      ))}
                      <th className="px-4 py-3 text-left text-xs font-medium uppercase text-gray-500">Submitted</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 bg-white">
                    {submissions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-gray-50">
                        {displayFields.map((f) => (
                          <td key={f.name} className="px-4 py-3 text-gray-900 max-w-[200px] truncate">
                            {sub.data[f.name] !== undefined ? String(sub.data[f.name]) : '—'}
                          </td>
                        ))}
                        <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                          {formatDate(sub.created_at)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => {
                              if (confirm('Delete this submission?')) deleteSubMutation.mutate(sub.id)
                            }}
                            className="p-2 text-gray-400 hover:text-red-600"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="space-y-2 sm:hidden">
                {submissions.map((sub) => (
                  <div key={sub.id} className="rounded-lg border border-gray-200 bg-white p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {displayFields.slice(0, 2).map((f) => (
                          <p key={f.name} className="truncate text-sm text-gray-900">
                            <span className="text-gray-400">{f.label}: </span>
                            {sub.data[f.name] !== undefined ? String(sub.data[f.name]) : '—'}
                          </p>
                        ))}
                      </div>
                      <button
                        onClick={() => {
                          if (confirm('Delete this submission?')) deleteSubMutation.mutate(sub.id)
                        }}
                        className="shrink-0 p-1 text-gray-400 hover:text-red-600"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p className="mt-1.5 text-xs text-gray-400">{formatDate(sub.created_at)}</p>
                  </div>
                ))}
              </div>

              {/* Pagination */}
              {subTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={subPage <= 1}
                    onClick={() => setSubPage(subPage - 1)}
                  >
                    <ChevronLeft size={14} className="mr-1" />
                    Previous
                  </Button>
                  <span className="text-sm text-gray-500">
                    Page {subPage} of {subTotalPages}
                  </span>
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={subPage >= subTotalPages}
                    onClick={() => setSubPage(subPage + 1)}
                  >
                    Next
                    <ChevronRight size={14} className="ml-1" />
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}
