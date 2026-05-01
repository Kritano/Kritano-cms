import type { PaginatedResponse, Document } from '@kritano/cms/types'
import type { CollectionSearchOptions, SearchResult } from './search'

export interface FindManyOptions {
  where?: Record<string, unknown>
  orderBy?: Record<string, 'asc' | 'desc'>
  limit?: number
  page?: number
  search?: string
}

export interface FindOneOptions {
  where: { id?: string; slug?: string }
}

export class CollectionClient<T extends Document = Document> {
  constructor(
    private baseUrl: string,
    private collectionName: string,
    private headers: Record<string, string>,
  ) {}

  async findMany(options: FindManyOptions = {}): Promise<PaginatedResponse<T>> {
    const params = new URLSearchParams()

    if (options.page) params.set('page', String(options.page))
    if (options.limit) params.set('limit', String(options.limit))
    if (options.search) params.set('search', options.search)

    if (options.where) {
      for (const [key, value] of Object.entries(options.where)) {
        params.set(key, String(value))
      }
    }

    if (options.orderBy) {
      const [field, order] = Object.entries(options.orderBy)[0]
      params.set('sort', field)
      params.set('order', order)
    }

    const query = params.toString()
    const url = `${this.baseUrl}/${this.collectionName}${query ? `?${query}` : ''}`
    const res = await fetch(url, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching ${this.collectionName} list`)
    }

    return res.json() as Promise<PaginatedResponse<T>>
  }

  async findOne(options: FindOneOptions): Promise<T | null> {
    let url: string

    if (options.where.slug) {
      url = `${this.baseUrl}/${this.collectionName}/slug/${options.where.slug}`
    } else if (options.where.id) {
      url = `${this.baseUrl}/${this.collectionName}/${options.where.id}`
    } else {
      throw new Error('SDK: findOne requires either id or slug')
    }

    const res = await fetch(url, { headers: this.headers })

    if (res.status === 404) return null
    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching ${this.collectionName}`)
    }

    const body = await res.json() as { data: T }
    return body.data
  }

  /** Fetch a draft document using a preview token */
  async findPreview(id: string, previewToken: string): Promise<T | null> {
    const url = `${this.baseUrl}/${this.collectionName}/${id}/preview?cms_preview=${encodeURIComponent(previewToken)}`
    const res = await fetch(url, { headers: this.headers })

    if (res.status === 404) return null
    if (res.status === 401) throw new Error('SDK: Invalid or expired preview token')
    if (!res.ok) throw new Error(`SDK: ${res.status} fetching preview`)

    const body = await res.json() as { data: T; preview: boolean }
    return body.data
  }

  async search(options: CollectionSearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams()
    params.set('q', options.q)
    if (options.filter) params.set('filter', options.filter)
    if (options.sort) params.set('sort', options.sort)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.page) params.set('page', String(options.page))

    const res = await fetch(
      `${this.baseUrl}/search/${this.collectionName}?${params}`,
      { headers: this.headers },
    )

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching ${this.collectionName}`)
    }

    return res.json() as Promise<SearchResult>
  }
}
