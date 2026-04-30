export interface ApiClient {
  baseUrl: string
  apiKey: string
  fetch(path: string, options?: RequestInit): Promise<any>
}

export function createApiClient(baseUrl: string, apiKey: string): ApiClient {
  const url = baseUrl.replace(/\/$/, '')

  return {
    baseUrl: url,
    apiKey,
    async fetch(path: string, options: RequestInit = {}) {
      const res = await globalThis.fetch(`${url}/api${path}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`,
          ...(options.headers || {}),
        },
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: { message: `HTTP ${res.status}` } }))
        throw new Error(body.error?.message || `API request failed: ${res.status}`)
      }

      return res.json()
    },
  }
}

export async function validateAuth(client: ApiClient): Promise<boolean> {
  try {
    await client.fetch('/health')
    return true
  } catch {
    return false
  }
}
