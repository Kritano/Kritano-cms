import { describe, expect, test, mock, beforeEach } from 'bun:test'
import { CMSClient } from '../client'

// Mock fetch
const mockFetch = mock(() =>
  Promise.resolve({
    ok: true,
    status: 200,
    json: () => Promise.resolve({ data: [], total: 0, page: 1, limit: 20, totalPages: 0 }),
  } as Response),
)

beforeEach(() => {
  globalThis.fetch = mockFetch as any
  mockFetch.mockClear()
})

describe('CMSClient', () => {
  test('creates client with URL', () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    expect(cms).toBeDefined()
    expect(cms.media).toBeDefined()
  })

  test('collection() returns a CollectionClient', () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    const articles = cms.collection('article')
    expect(articles).toBeDefined()
  })

  test('strips trailing slash from URL', () => {
    const cms = new CMSClient({ url: 'https://example.com/api/' })
    cms.collection('article').findMany()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/article',
      expect.any(Object),
    )
  })
})

describe('CollectionClient.findMany', () => {
  test('fetches collection list', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.collection('article').findMany()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/article',
      expect.any(Object),
    )
  })

  test('passes pagination params', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.collection('article').findMany({ page: 2, limit: 10 })
    const url = (mockFetch.mock.calls as any[][])[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=10')
  })

  test('passes where filters', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.collection('article').findMany({ where: { status: 'published' } })
    const url = (mockFetch.mock.calls as any[][])[0][0] as string
    expect(url).toContain('status=published')
  })

  test('passes orderBy', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.collection('article').findMany({ orderBy: { publishedAt: 'desc' } })
    const url = (mockFetch.mock.calls as any[][])[0][0] as string
    expect(url).toContain('sort=publishedAt')
    expect(url).toContain('order=desc')
  })

  test('passes search', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.collection('article').findMany({ search: 'hello' })
    const url = (mockFetch.mock.calls as any[][])[0][0] as string
    expect(url).toContain('search=hello')
  })

  test('passes apiKey as Authorization header', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api', apiKey: 'secret' })
    await cms.collection('article').findMany()
    const headers = (mockFetch.mock.calls as any[][])[0][1]?.headers as Record<string, string>
    expect(headers['Authorization']).toBe('Bearer secret')
  })
})

describe('CollectionClient.findOne', () => {
  test('fetches by slug', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: '1', slug: 'test' } }),
      } as Response),
    ) as any

    const cms = new CMSClient({ url: 'https://example.com/api' })
    const result = await cms.collection('article').findOne({ where: { slug: 'test' } })
    expect(result).toEqual({ id: '1', slug: 'test' } as any)
  })

  test('fetches by id', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ data: { id: 'abc' } }),
      } as Response),
    ) as any

    const cms = new CMSClient({ url: 'https://example.com/api' })
    const result = await cms.collection('article').findOne({ where: { id: 'abc' } })
    expect(result).toEqual({ id: 'abc' } as any)
  })

  test('returns null on 404', async () => {
    globalThis.fetch = mock(() =>
      Promise.resolve({ ok: false, status: 404 } as Response),
    ) as any

    const cms = new CMSClient({ url: 'https://example.com/api' })
    const result = await cms.collection('article').findOne({ where: { slug: 'missing' } })
    expect(result).toBeNull()
  })

  test('throws without id or slug', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    expect(
      cms.collection('article').findOne({ where: {} }),
    ).rejects.toThrow('requires either id or slug')
  })
})

describe('MediaClient', () => {
  test('list fetches media', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.media.list()
    expect(mockFetch).toHaveBeenCalledWith(
      'https://example.com/api/media',
      expect.any(Object),
    )
  })

  test('list passes pagination', async () => {
    const cms = new CMSClient({ url: 'https://example.com/api' })
    await cms.media.list({ page: 2, limit: 5 })
    const url = (mockFetch.mock.calls as any[][])[0][0] as string
    expect(url).toContain('page=2')
    expect(url).toContain('limit=5')
  })
})
