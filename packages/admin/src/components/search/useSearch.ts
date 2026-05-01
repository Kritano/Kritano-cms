import { useState, useEffect, useRef } from 'react'
import { api } from '@/lib/api'

interface SearchHit {
  id: string
  collection: string
  title: string
  slug?: string
  excerpt?: string
  publishedAt?: string
  score: number
}

interface CollectionResult {
  total: number
  hits: SearchHit[]
}

interface SearchResponse {
  query: string
  took_ms: number
  results: Record<string, CollectionResult>
  search_unavailable?: boolean
}

export function useSearch(query: string, debounceMs = 200) {
  const [results, setResults] = useState<SearchResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const abortRef = useRef<AbortController | null>(null)

  useEffect(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (abortRef.current) abortRef.current.abort()

    if (!query.trim()) {
      setResults(null)
      setIsLoading(false)
      return
    }

    setIsLoading(true)

    timerRef.current = setTimeout(async () => {
      const controller = new AbortController()
      abortRef.current = controller

      try {
        const data = await api<SearchResponse>(
          `/search?q=${encodeURIComponent(query)}&limit=5`,
        )
        if (!controller.signal.aborted) {
          setResults(data)
          setIsLoading(false)
        }
      } catch {
        if (!controller.signal.aborted) {
          setResults(null)
          setIsLoading(false)
        }
      }
    }, debounceMs)

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      if (abortRef.current) abortRef.current.abort()
    }
  }, [query, debounceMs])

  return { results, isLoading }
}

export type { SearchHit, CollectionResult, SearchResponse }
