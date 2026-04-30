import { useState } from 'react'
import { cn } from '@/lib/utils'
import { PublishPanel } from './PublishPanel'
import { SeoPanel } from './SeoPanel'
import { HistoryPanel } from './HistoryPanel'

interface Props {
  status: string
  createdAt: string | null
  updatedAt: string | null
  publishedAt: string | null
  onPublish: () => void
  onUnpublish: () => void
  publishLoading?: boolean
  hasSeo: boolean
  seoValue: any
  onSeoChange: (value: any) => void
  previewUrl?: string | null
  // Revision history props
  collection?: string
  documentId?: string | null
  onRestore?: () => void
}

type Tab = 'publish' | 'seo' | 'history'

export function EditorSidebar(props: Props) {
  const [tab, setTab] = useState<Tab>('publish')
  const tabs: { value: Tab; label: string }[] = [
    { value: 'publish', label: 'Publish' },
    ...(props.hasSeo ? [{ value: 'seo' as Tab, label: 'SEO' }] : []),
    ...(props.documentId ? [{ value: 'history' as Tab, label: 'History' }] : []),
  ]

  return (
    <div className="w-80 shrink-0 border-l border-gray-200 bg-white">
      {/* Tab switcher */}
      <div className="flex border-b border-gray-200">
        {tabs.map((t) => (
          <button
            key={t.value}
            onClick={() => setTab(t.value)}
            className={cn(
              'flex-1 px-4 py-2.5 text-sm font-medium transition-colors',
              tab === t.value
                ? 'border-b-2 border-gray-900 text-gray-900'
                : 'text-gray-500 hover:text-gray-700',
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="p-4">
        {tab === 'publish' && (
          <PublishPanel
            status={props.status}
            createdAt={props.createdAt}
            updatedAt={props.updatedAt}
            publishedAt={props.publishedAt}
            onPublish={props.onPublish}
            onUnpublish={props.onUnpublish}
            loading={props.publishLoading}
            previewUrl={props.previewUrl}
            collection={props.collection}
            documentId={props.documentId}
          />
        )}
        {tab === 'seo' && props.hasSeo && (
          <SeoPanel value={props.seoValue} onChange={props.onSeoChange} />
        )}
        {tab === 'history' && props.collection && props.documentId && (
          <HistoryPanel
            collection={props.collection}
            documentId={props.documentId}
            onRestore={props.onRestore || (() => {})}
          />
        )}
      </div>
    </div>
  )
}
