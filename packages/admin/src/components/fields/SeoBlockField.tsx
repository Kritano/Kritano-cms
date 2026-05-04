import { cn } from '@/lib/utils'
import { Input } from '@/components/ui/Input'
import { MediaField } from './MediaField'

interface SeoData {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  ogType: string | null
  twitterCard: string | null
  twitterSite: string | null
  robotsIndex: string | null
  robotsFollow: string | null
  focusKeyword: string | null
  secondaryKeywords: string | null
  structuredDataType: string | null
  noIndex?: boolean
}

interface Props {
  label: string
  value: SeoData | null
  onChange: (value: SeoData) => void
}

const defaults: SeoData = {
  metaTitle: null,
  metaDescription: null,
  canonicalUrl: null,
  ogTitle: null,
  ogDescription: null,
  ogImage: null,
  ogType: null,
  twitterCard: 'summary_large_image',
  twitterSite: null,
  robotsIndex: 'index',
  robotsFollow: 'follow',
  focusKeyword: null,
  secondaryKeywords: null,
  structuredDataType: null,
}

export function SeoBlockField({ label, value, onChange }: Props) {
  const seo = { ...defaults, ...value }

  if (seo.noIndex && !seo.robotsIndex) {
    seo.robotsIndex = 'noindex'
  }

  function update(field: keyof SeoData, val: unknown) {
    onChange({ ...seo, [field]: val })
  }

  const titleLen = seo.metaTitle?.length || 0
  const descLen = seo.metaDescription?.length || 0

  return (
    <div className="space-y-4">
      <p className="text-sm font-semibold text-gray-700">{label}</p>

      <div className="space-y-1.5">
        <Input label="Meta title" value={seo.metaTitle || ''} onChange={(e) => update('metaTitle', e.target.value || null)} placeholder="Page title for search engines" />
        <p className={cn('text-xs', titleLen > 60 ? 'text-amber-500' : 'text-gray-400')}>{titleLen}/60</p>
      </div>

      <div className="space-y-1.5">
        <label className="block text-sm font-medium text-gray-700">Meta description</label>
        <textarea value={seo.metaDescription || ''} onChange={(e) => update('metaDescription', e.target.value || null)} rows={3} placeholder="Brief description for search results" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
        <p className={cn('text-xs', descLen > 155 ? 'text-amber-500' : 'text-gray-400')}>{descLen}/155</p>
      </div>

      <Input label="Focus keyword" value={seo.focusKeyword || ''} onChange={(e) => update('focusKeyword', e.target.value || null)} placeholder="Primary keyword for this page" />

      <div className="space-y-1.5">
        <Input label="Secondary keywords" value={seo.secondaryKeywords || ''} onChange={(e) => update('secondaryKeywords', e.target.value || null)} placeholder="keyword one, keyword two, keyword three..." />
        <p className="text-xs text-gray-400">Comma-separated. Added to meta keywords tag alongside focus keyword.</p>
      </div>

      <Input label="Canonical URL" value={seo.canonicalUrl || ''} onChange={(e) => update('canonicalUrl', e.target.value || null)} placeholder="Leave blank to use page URL" />

      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Robots index</label>
          <select value={seo.robotsIndex || 'index'} onChange={(e) => update('robotsIndex', e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="index">Index</option>
            <option value="noindex">No index</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Robots follow</label>
          <select value={seo.robotsFollow || 'follow'} onChange={(e) => update('robotsFollow', e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="follow">Follow</option>
            <option value="nofollow">No follow</option>
          </select>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Open Graph</p>
        <div className="space-y-3">
          <Input label="OG title" value={seo.ogTitle || ''} onChange={(e) => update('ogTitle', e.target.value || null)} placeholder="Defaults to meta title" />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">OG description</label>
            <textarea value={seo.ogDescription || ''} onChange={(e) => update('ogDescription', e.target.value || null)} rows={2} placeholder="Defaults to meta description" className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm shadow-sm focus:border-gray-500 focus:outline-none focus:ring-1 focus:ring-gray-500" />
          </div>
          <MediaField label="OG image" value={seo.ogImage} onChange={(val) => update('ogImage', val)} />
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">OG type</label>
            <select value={seo.ogType || 'website'} onChange={(e) => update('ogType', e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="website">Website</option>
              <option value="article">Article</option>
              <option value="profile">Profile</option>
            </select>
          </div>
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Twitter Card</p>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-gray-700">Card type</label>
            <select value={seo.twitterCard || 'summary_large_image'} onChange={(e) => update('twitterCard', e.target.value)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
              <option value="summary">Summary</option>
              <option value="summary_large_image">Summary with large image</option>
            </select>
          </div>
          <Input label="Twitter @handle" value={seo.twitterSite || ''} onChange={(e) => update('twitterSite', e.target.value || null)} placeholder="@yourhandle" />
        </div>
      </div>

      <div className="border-t border-gray-100 pt-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">Structured Data</p>
        <div className="space-y-1.5">
          <label className="block text-sm font-medium text-gray-700">Schema type</label>
          <select value={seo.structuredDataType || ''} onChange={(e) => update('structuredDataType', e.target.value || null)} className="block w-full rounded-md border border-gray-300 px-3 py-2 text-sm">
            <option value="">Auto-detect</option>
            <option value="Article">Article</option>
            <option value="WebPage">Web Page</option>
            <option value="Product">Product</option>
            <option value="FAQPage">FAQ Page</option>
            <option value="Person">Person</option>
            <option value="Organization">Organisation</option>
          </select>
          <p className="text-xs text-gray-400">Auto-detect chooses based on collection type</p>
        </div>
      </div>
    </div>
  )
}
