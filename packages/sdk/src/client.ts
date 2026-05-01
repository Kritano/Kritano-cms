import type { Document } from '@kritano/cms/types'
import { CollectionClient } from './collection'
import { MediaClient } from './media'
import { SearchClient, type SearchOptions, type SearchResult } from './search'

export interface CMSClientOptions {
  url: string
  apiKey?: string
  previewToken?: string
}

export class CMSClient {
  private baseUrl: string
  private headers: Record<string, string>
  public media: MediaClient
  public search: SearchClient

  constructor(options: CMSClientOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.headers = {}
    if (options.apiKey) {
      this.headers['Authorization'] = `Bearer ${options.apiKey}`
    }
    if (options.previewToken) {
      this.headers['X-CMS-Preview'] = options.previewToken
    }
    this.media = new MediaClient(this.baseUrl, this.headers)
    this.search = new SearchClient(this.baseUrl, this.headers)
  }

  collection<T extends Document = Document>(name: string): CollectionClient<T> {
    return new CollectionClient<T>(this.baseUrl, name, this.headers)
  }
}
