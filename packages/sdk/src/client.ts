import type { Document } from '@cms/types'
import { CollectionClient } from './collection'
import { MediaClient } from './media'

export interface CMSClientOptions {
  url: string
  apiKey?: string
}

export class CMSClient {
  private baseUrl: string
  private headers: Record<string, string>
  public media: MediaClient

  constructor(options: CMSClientOptions) {
    this.baseUrl = options.url.replace(/\/$/, '')
    this.headers = {}
    if (options.apiKey) {
      this.headers['Authorization'] = `Bearer ${options.apiKey}`
    }
    this.media = new MediaClient(this.baseUrl, this.headers)
  }

  collection<T extends Document = Document>(name: string): CollectionClient<T> {
    return new CollectionClient<T>(this.baseUrl, name, this.headers)
  }
}
