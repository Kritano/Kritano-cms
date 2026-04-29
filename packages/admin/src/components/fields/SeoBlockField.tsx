import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { MediaField } from './MediaField'

interface SeoData {
  metaTitle: string | null
  metaDescription: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  noIndex: boolean
}

interface Props {
  label: string
  value: SeoData | null
  onChange: (value: SeoData) => void
}

const defaults: SeoData = {
  metaTitle: null,
  metaDescription: null,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  noIndex: false,
}

export function SeoBlockField({ label, value, onChange }: Props) {
  const seo = value || defaults

  function update(field: keyof SeoData, val: unknown) {
    onChange({ ...seo, [field]: val })
  }

  const titleLen = seo.metaTitle?.length || 0
  const descLen = seo.metaDescription?.length || 0

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700">{label}</p>

      <div className="space-y-1.5">
        <Input
          label="Meta title"
          value={seo.metaTitle || ''}
          onChange={(e) => update('metaTitle', e.target.value || null)}
        />
        <p className={cn('text-xs', titleLen > 60 ? 'text-amber-500' : 'text-gray-400')}>
          {titleLen}/60
        </p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Meta description</label>
        <textarea
          value={seo.metaDescription || ''}
          onChange={(e) => update('metaDescription', e.target.value || null)}
          rows={3}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
        <p className={cn('text-xs', descLen > 155 ? 'text-amber-500' : 'text-gray-400')}>
          {descLen}/155
        </p>
      </div>

      <Input
        label="OG title"
        value={seo.ogTitle || ''}
        onChange={(e) => update('ogTitle', e.target.value || null)}
      />

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">OG description</label>
        <textarea
          value={seo.ogDescription || ''}
          onChange={(e) => update('ogDescription', e.target.value || null)}
          rows={2}
          className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500"
        />
      </div>

      <MediaField
        label="OG image"
        value={seo.ogImage}
        onChange={(val) => update('ogImage', val)}
      />

      <label className="flex items-center gap-2 cursor-pointer">
        <input
          type="checkbox"
          checked={seo.noIndex}
          onChange={(e) => update('noIndex', e.target.checked)}
          className="h-4 w-4 rounded border-gray-300 text-gray-900 focus:ring-gray-500"
        />
        <span className="text-sm text-gray-700">No index (exclude from search engines)</span>
      </label>
    </div>
  )
}
