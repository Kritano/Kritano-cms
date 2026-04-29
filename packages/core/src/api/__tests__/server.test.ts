import { describe, expect, test } from 'bun:test'
import { createServer } from '../server'
import { defineConfig } from '../../schema/defineConfig'
import { defineCollection } from '../../schema/defineCollection'
import { text, slug, richText, select, seoBlock } from '../../schema/fields'

const config = defineConfig({
  site: { name: 'Test', domain: 'https://test.com', language: 'en' },
  collections: [
    defineCollection('page', {
      fields: {
        title: text().required(),
        slug: slug().from('title'),
        body: richText(),
        status: select(['draft', 'published']).default('draft'),
        seo: seoBlock(),
      },
    }),
  ],
})

describe('createServer', () => {
  test('returns a Hono app', () => {
    const app = createServer(config)
    expect(app).toBeDefined()
    expect(typeof app.fetch).toBe('function')
  })

  test('health endpoint returns ok', async () => {
    const app = createServer(config)
    const res = await app.request('/api/health')
    expect(res.status).toBe(200)
    const body = await res.json()
    expect(body).toEqual({ ok: true, version: '0.1.0' })
  })

  test('auth endpoints exist (login returns 400 without body)', async () => {
    const app = createServer(config)
    const res = await app.request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
    // Should return 400 (validation error) or 500 (no DB) — not 404
    expect(res.status).not.toBe(404)
  })

  test('collection GET route exists', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page')
    // Will fail with DB error but should not be 404
    expect(res.status).not.toBe(404)
  })

  test('protected routes return 401 without auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: 'Test' }),
    })
    expect(res.status).toBe(401)
  })

  test('protected routes return 401 with invalid token', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer invalid-token',
      },
      body: JSON.stringify({ title: 'Test' }),
    })
    expect(res.status).toBe(401)
  })

  test('DELETE requires auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page/some-id', { method: 'DELETE' })
    expect(res.status).toBe(401)
  })

  test('publish requires auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page/some-id/publish', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('unpublish requires auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/page/some-id/unpublish', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('media upload requires auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/media/upload', { method: 'POST' })
    expect(res.status).toBe(401)
  })

  test('media list requires auth', async () => {
    const app = createServer(config)
    const res = await app.request('/api/media')
    expect(res.status).toBe(401)
  })

  test('graphql endpoint exists', async () => {
    const app = createServer(config)
    const res = await app.request('/api/graphql', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
    })
    expect(res.status).toBe(200)
    const body = await res.json()
    expect((body as any).data.__typename).toBe('Query')
  })
})
