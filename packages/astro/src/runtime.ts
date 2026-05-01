import { CMSClient } from '@kritano/cms/sdk'
import type { CMSContext } from './types'

let _client: CMSClient | null = null
let _previewClient: CMSClient | null = null

export function getCMSClient(previewToken?: string): CMSClient {
  if (previewToken) {
    // Preview clients are not cached — each request may have a different token
    return new CMSClient({
      url: process.env.CMS_API_URL || 'http://localhost:3000/api',
      previewToken,
    })
  }

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

export function defineTheme(config: import('@kritano/cms/types').ThemeConfig): import('@kritano/cms/types').ThemeConfig {
  return config
}

/**
 * Check if the current request is a preview request and validate the token.
 * Returns the preview token if valid, null otherwise.
 */
export async function getPreviewToken(url: URL): Promise<string | null> {
  const token = url.searchParams.get('cms_preview')
  if (!token) return null

  const apiUrl = process.env.CMS_API_URL || 'http://localhost:3000/api'

  try {
    const res = await fetch(`${apiUrl}/preview/validate?token=${encodeURIComponent(token)}`)
    const data = await res.json() as { valid: boolean }
    return data.valid ? token : null
  } catch {
    return null
  }
}

/**
 * Generate the preview banner HTML to inject into preview pages.
 */
export function getPreviewBannerHtml(): string {
  return `<div style="position:fixed;top:0;left:0;right:0;z-index:9999;background:#1e1b4b;color:#fff;text-align:center;padding:8px 16px;font-size:13px;font-family:system-ui,sans-serif">
  Preview mode — viewing unpublished content
  <a href="?" style="color:#a5b4fc;margin-left:12px;text-decoration:underline">Exit preview</a>
</div>
<div style="height:36px"></div>`
}
