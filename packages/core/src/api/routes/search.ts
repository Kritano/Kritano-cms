import { Hono } from 'hono'
import { optionalAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { searchCollections, searchSuggest } from '../../search/queries'

export const searchRoutes = new Hono<AuthEnv>()

// GET /api/search — global search across all collections
searchRoutes.get('/search', optionalAuth, async (c) => {
  const q = c.req.query('q') || ''
  const collectionsParam = c.req.query('collections')
  const limit = Math.min(parseInt(c.req.query('limit') || '5', 10), 20)
  const page = parseInt(c.req.query('page') || '1', 10)

  const collections = collectionsParam
    ? collectionsParam.split(',').map((s) => s.trim()).filter(Boolean)
    : undefined

  // Published content is public — default filter
  const filter = c.get('user') ? undefined : 'status:=published'

  const result = await searchCollections({
    q,
    collections,
    limit,
    page,
    filter,
  })

  return c.json(result)
})

// GET /api/search/suggest — autocomplete suggestions
// Must be before /search/:collection to avoid matching 'suggest' as a collection name
searchRoutes.get('/search/suggest', optionalAuth, async (c) => {
  const q = c.req.query('q') || ''
  const collection = c.req.query('collection') || undefined

  const result = await searchSuggest({ q, collection })

  return c.json(result)
})

// GET /api/search/:collection — collection-scoped search
searchRoutes.get('/search/:collection', optionalAuth, async (c) => {
  const collection = c.req.param('collection')
  const q = c.req.query('q') || ''
  const limit = Math.min(parseInt(c.req.query('limit') || '5', 10), 20)
  const page = parseInt(c.req.query('page') || '1', 10)
  const filter = c.req.query('filter') || undefined
  const sort = c.req.query('sort') || undefined

  // For unauthenticated users, enforce published-only filter
  const baseFilter = c.get('user') ? filter : (filter ? `status:=published && ${filter}` : 'status:=published')

  const result = await searchCollections({
    q,
    collections: [collection],
    limit,
    page,
    filter: baseFilter,
    sort,
  })

  return c.json(result)
})
