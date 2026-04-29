import type { SeoBlock } from './seo'

export type DocumentStatus = 'draft' | 'published'

export interface DocumentMeta {
  id: string
  status: DocumentStatus
  createdAt: string
  updatedAt: string
  publishedAt: string | null
}

export interface Document extends DocumentMeta {
  [field: string]: unknown
}

export interface Block {
  id: string
  type: string
  fields: Record<string, unknown>
}

export interface DocumentWithSeo extends Document {
  seo: SeoBlock | null
}
