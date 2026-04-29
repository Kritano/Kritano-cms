import { getAccessToken, refreshTokens, clearTokens } from './auth'

const API_BASE = '/api'

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown
  auth?: boolean
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, auth = true, ...init } = options

  const headers: Record<string, string> = {
    ...(init.headers as Record<string, string>),
  }

  if (body && !(body instanceof FormData)) {
    headers['Content-Type'] = 'application/json'
  }

  if (auth) {
    let token = getAccessToken()
    if (!token) {
      const refreshed = await refreshTokens()
      if (!refreshed) {
        clearTokens()
        window.location.href = '/admin/login'
        throw new Error('Not authenticated')
      }
      token = getAccessToken()
    }
    if (token) {
      headers['Authorization'] = `Bearer ${token}`
    }
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
  })

  if (res.status === 401 && auth) {
    // Try refresh once
    const refreshed = await refreshTokens()
    if (refreshed) {
      headers['Authorization'] = `Bearer ${getAccessToken()}`
      const retryRes = await fetch(`${API_BASE}${path}`, {
        ...init,
        headers,
        body: body instanceof FormData ? body : body ? JSON.stringify(body) : undefined,
      })
      if (!retryRes.ok) {
        const err = await retryRes.json().catch(() => ({ error: { message: 'Request failed' } }))
        throw err.error || err
      }
      return retryRes.json()
    }
    clearTokens()
    window.location.href = '/admin/login'
    throw new Error('Not authenticated')
  }

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: { message: 'Request failed' } }))
    throw err.error || err
  }

  return res.json()
}
