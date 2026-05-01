import { getSearchClient, isSearchAvailable } from './client'

export interface SearchParams {
  q: string
  collections?: string[]
  limit?: number
  page?: number
  filter?: string
  sort?: string
  facets?: string[]
}

export interface SearchHit {
  id: string
  collection: string
  title: string
  slug?: string
  excerpt?: string
  publishedAt?: string
  score: number
  highlights: Record<string, string>
}

export interface CollectionSearchResult {
  total: number
  hits: SearchHit[]
}

export interface GlobalSearchResult {
  query: string
  took_ms: number
  results: Record<string, CollectionSearchResult>
  search_unavailable?: boolean
}

export interface SuggestResult {
  suggestions: string[]
  search_unavailable?: boolean
}

const UNAVAILABLE_GLOBAL: GlobalSearchResult = {
  query: '',
  took_ms: 0,
  results: {},
  search_unavailable: true,
}

const UNAVAILABLE_SUGGEST: SuggestResult = {
  suggestions: [],
  search_unavailable: true,
}

/** Search across one or more collections */
export async function searchCollections(params: SearchParams): Promise<GlobalSearchResult> {
  if (!isSearchAvailable()) return { ...UNAVAILABLE_GLOBAL, query: params.q }

  const client = getSearchClient()
  if (!client) return { ...UNAVAILABLE_GLOBAL, query: params.q }

  const { q, collections, limit = 5, page = 1, filter, sort } = params

  if (!q.trim()) {
    return { query: q, took_ms: 0, results: {} }
  }

  const start = Date.now()
  const results: Record<string, CollectionSearchResult> = {}

  // Get all available Typesense collections
  let targetCollections: string[]

  if (collections && collections.length > 0) {
    targetCollections = collections.map((c) => `cms_${c}`)
  } else {
    try {
      const allCollections = await client.collections().retrieve()
      targetCollections = allCollections
        .map((c: any) => c.name)
        .filter((name: string) => name.startsWith('cms_'))
    } catch {
      return { ...UNAVAILABLE_GLOBAL, query: q }
    }
  }

  for (const tsCollection of targetCollections) {
    const collectionName = tsCollection.replace(/^cms_/, '')

    try {
      const searchParams: Record<string, unknown> = {
        q,
        query_by: 'title,*',
        per_page: Math.min(limit, 20),
        page,
        highlight_full_fields: 'title',
      }

      if (filter) searchParams.filter_by = filter
      if (sort) searchParams.sort_by = sort

      const result = await client.collections(tsCollection).documents().search(searchParams as any)

      const hits: SearchHit[] = (result.hits ?? []).map((hit: any) => {
        const doc = hit.document
        const highlights: Record<string, string> = {}

        for (const hl of hit.highlights ?? []) {
          highlights[hl.field] = hl.snippet ?? hl.value ?? ''
        }

        return {
          id: doc.id,
          collection: collectionName,
          title: doc.title ?? '',
          slug: doc.slug,
          excerpt: highlights.title || highlights.body || highlights.description || '',
          publishedAt: doc.publishedAt
            ? new Date(doc.publishedAt * 1000).toISOString()
            : undefined,
          score: hit.text_match_info?.score ?? 0,
          highlights,
        }
      })

      results[collectionName] = {
        total: result.found ?? 0,
        hits,
      }
    } catch {
      // Skip collections that fail — don't break the whole search
      results[collectionName] = { total: 0, hits: [] }
    }
  }

  return {
    query: q,
    took_ms: Date.now() - start,
    results,
  }
}

/** Autocomplete suggestions */
export async function searchSuggest(params: {
  q: string
  collection?: string
  limit?: number
}): Promise<SuggestResult> {
  if (!isSearchAvailable()) return UNAVAILABLE_SUGGEST

  const client = getSearchClient()
  if (!client) return UNAVAILABLE_SUGGEST

  const { q, collection, limit = 5 } = params

  if (!q || q.length < 2) {
    return { suggestions: [] }
  }

  const tsCollection = collection ? `cms_${collection}` : null
  const suggestions: string[] = []

  try {
    // If specific collection, search just that
    if (tsCollection) {
      const result = await client.collections(tsCollection).documents().search({
        q,
        query_by: 'title',
        per_page: limit,
      } as any)

      for (const hit of result.hits ?? []) {
        suggestions.push((hit.document as any).title)
      }
    } else {
      // Search across all CMS collections
      const allCollections = await client.collections().retrieve()
      const cmsCollections = allCollections
        .map((c: any) => c.name)
        .filter((name: string) => name.startsWith('cms_'))

      for (const col of cmsCollections.slice(0, 5)) {
        try {
          const result = await client.collections(col).documents().search({
            q,
            query_by: 'title',
            per_page: 3,
          } as any)

          for (const hit of result.hits ?? []) {
            suggestions.push((hit.document as any).title)
          }
        } catch {
          // Skip
        }
      }
    }
  } catch {
    return UNAVAILABLE_SUGGEST
  }

  // Deduplicate and limit
  const unique = [...new Set(suggestions)].slice(0, limit)
  return { suggestions: unique }
}
