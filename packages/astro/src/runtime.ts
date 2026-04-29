import { CMSClient } from '@cms/sdk'
import type { CMSContext } from './types'

let _client: CMSClient | null = null

export function getCMSClient(): CMSClient {
  if (!_client) {
    const url = process.env.CMS_API_URL || 'http://localhost:3000/api'
    _client = new CMSClient({ url })
  }
  return _client
}

export function useCMS(props: {
  doc?: Record<string, unknown>
  settings?: Record<string, unknown>
  collection?: string
}): CMSContext {
  return {
    doc: props.doc || {},
    settings: props.settings || {},
    collection: props.collection || '',
  }
}

export function defineTheme(config: import('@cms/types').ThemeConfig): import('@cms/types').ThemeConfig {
  return config
}
