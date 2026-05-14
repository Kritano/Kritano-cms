import { defineMiddleware } from 'astro:middleware'

type Redirect = {
  id: string
  fromPath: string
  toPath: string
  type: 301 | 302
}

const API_URL = import.meta.env.CMS_API_URL || 'http://localhost:3000/api'
const REFRESH_INTERVAL_MS = 60_000

let cache = new Map<string, Redirect>()
let lastRefresh = 0
let refreshing: Promise<void> | null = null

async function refreshCache(): Promise<void> {
  try {
    const res = await fetch(`${API_URL}/redirects/all`)
    if (!res.ok) return
    const body = (await res.json()) as { data: Redirect[] }
    const next = new Map<string, Redirect>()
    for (const r of body.data) next.set(r.fromPath, r)
    cache = next
    lastRefresh = Date.now()
  } catch {
    // Keep existing cache on failure
  }
}

async function ensureFresh(): Promise<void> {
  const age = Date.now() - lastRefresh
  if (age < REFRESH_INTERVAL_MS) return
  if (!refreshing) {
    refreshing = refreshCache().finally(() => {
      refreshing = null
    })
  }
  // Block only on the very first load so we don't redirect a user before
  // the cache is populated. After that, serve stale while refreshing.
  if (lastRefresh === 0) await refreshing
}

export const onRequest = defineMiddleware(async (context, next) => {
  const { pathname } = context.url
  const method = context.request.method

  if (method !== 'GET' && method !== 'HEAD') return next()
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/admin/') ||
    pathname.startsWith('/_')
  ) {
    return next()
  }

  await ensureFresh()
  const hit = cache.get(pathname)
  if (!hit) return next()

  fetch(`${API_URL}/redirects/${hit.id}/hit`, { method: 'POST' }).catch(() => {})
  return context.redirect(hit.toPath, hit.type)
})
