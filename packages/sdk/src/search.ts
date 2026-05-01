export interface SearchOptions {
  q: string
  collections?: string[]
  limit?: number
  page?: number
}

export interface CollectionSearchOptions {
  q: string
  filter?: string
  sort?: string
  limit?: number
  page?: number
}

export interface SuggestOptions {
  q: string
  collection?: string
  limit?: number
}

export interface SearchHit {
  id: string
  collection: string
  title: string
  slug?: string
  excerpt?: string
  publishedAt?: string
  score: number
}

export interface CollectionSearchResult {
  total: number
  hits: SearchHit[]
}

export interface SearchResult {
  query: string
  took_ms: number
  results: Record<string, CollectionSearchResult>
  search_unavailable?: boolean
}

export interface SuggestResult {
  suggestions: string[]
  search_unavailable?: boolean
}

export class SearchClient {
  constructor(
    private baseUrl: string,
    private headers: Record<string, string>,
  ) {}

  /** Global search across all collections */
  async search(options: SearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams()
    params.set('q', options.q)
    if (options.collections) params.set('collections', options.collections.join(','))
    if (options.limit) params.set('limit', String(options.limit))
    if (options.page) params.set('page', String(options.page))

    const res = await fetch(`${this.baseUrl}/search?${params}`, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching`)
    }

    return res.json() as Promise<SearchResult>
  }

  /** Collection-scoped search */
  async searchCollection(collection: string, options: CollectionSearchOptions): Promise<SearchResult> {
    const params = new URLSearchParams()
    params.set('q', options.q)
    if (options.filter) params.set('filter', options.filter)
    if (options.sort) params.set('sort', options.sort)
    if (options.limit) params.set('limit', String(options.limit))
    if (options.page) params.set('page', String(options.page))

    const res = await fetch(`${this.baseUrl}/search/${collection}?${params}`, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} searching ${collection}`)
    }

    return res.json() as Promise<SearchResult>
  }

  /** Autocomplete suggestions */
  async suggest(options: SuggestOptions): Promise<SuggestResult> {
    const params = new URLSearchParams()
    params.set('q', options.q)
    if (options.collection) params.set('collection', options.collection)

    const res = await fetch(`${this.baseUrl}/search/suggest?${params}`, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching suggestions`)
    }

    return res.json() as Promise<SuggestResult>
  }
}
