import type { PaginatedResponse, Media } from '@kritano/cms/types'

export class MediaClient {
  constructor(
    private baseUrl: string,
    private headers: Record<string, string>,
  ) {}

  async list(options: { page?: number; limit?: number } = {}): Promise<PaginatedResponse<Media>> {
    const params = new URLSearchParams()
    if (options.page) params.set('page', String(options.page))
    if (options.limit) params.set('limit', String(options.limit))

    const query = params.toString()
    const url = `${this.baseUrl}/media${query ? `?${query}` : ''}`
    const res = await fetch(url, { headers: this.headers })

    if (!res.ok) {
      throw new Error(`SDK: ${res.status} fetching media list`)
    }

    return res.json() as Promise<PaginatedResponse<Media>>
  }

  async get(id: string): Promise<Media | null> {
    const res = await fetch(`${this.baseUrl}/media/${id}`, { headers: this.headers })
    if (res.status === 404) return null
    if (!res.ok) throw new Error(`SDK: ${res.status} fetching media`)
    const body = await res.json() as { data: Media }
    return body.data
  }
}
