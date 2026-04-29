import { describe, expect, test, beforeEach, afterEach } from 'bun:test'
import { mkdtemp, rm } from 'node:fs/promises'
import { join } from 'node:path'
import { tmpdir } from 'node:os'
import {
  diffSnapshots,
  createMigration,
  listMigrations,
  loadSnapshot,
  type SchemaSnapshot,
} from '../migration-generator'
import {
  collectionToTable,
  type TableDefinition,
} from '../schema-generator'
import { defineConfig } from '../../schema/defineConfig'
import { defineCollection } from '../../schema/defineCollection'
import { text, slug, richText, select, seoBlock, media, textarea } from '../../schema/fields'

function makeSnapshot(tables: Record<string, TableDefinition>): SchemaSnapshot {
  return { tables }
}

describe('diffSnapshots', () => {
  test('detects new table', () => {
    const prev = makeSnapshot({})
    const collection = defineCollection('article', {
      fields: {
        title: text().required(),
        slug: slug().from('title'),
      },
    })
    const curr = makeSnapshot({ articles: collectionToTable(collection) })
    const sql = diffSnapshots(prev, curr)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "articles"')
    expect(sql).toContain('"title" varchar(255)')
    expect(sql).toContain('"slug" varchar(255)')
  })

  test('detects new column', () => {
    const pageBase = defineCollection('page', {
      fields: { title: text().required() },
    })
    const pageExtended = defineCollection('page', {
      fields: {
        title: text().required(),
        excerpt: textarea(),
      },
    })
    const prev = makeSnapshot({ pages: collectionToTable(pageBase) })
    const curr = makeSnapshot({ pages: collectionToTable(pageExtended) })
    const sql = diffSnapshots(prev, curr)

    expect(sql).toContain('ALTER TABLE "pages" ADD COLUMN "excerpt"')
    expect(sql).toContain('text')
  })

  test('detects dropped column', () => {
    const pageWith = defineCollection('page', {
      fields: {
        title: text().required(),
        excerpt: textarea(),
      },
    })
    const pageWithout = defineCollection('page', {
      fields: { title: text().required() },
    })
    const prev = makeSnapshot({ pages: collectionToTable(pageWith) })
    const curr = makeSnapshot({ pages: collectionToTable(pageWithout) })
    const sql = diffSnapshots(prev, curr)

    expect(sql).toContain('DROP COLUMN IF EXISTS "excerpt"')
  })

  test('detects dropped table', () => {
    const collection = defineCollection('article', {
      fields: { title: text().required() },
    })
    const prev = makeSnapshot({ articles: collectionToTable(collection) })
    const curr = makeSnapshot({})
    const sql = diffSnapshots(prev, curr)

    expect(sql).toContain('DROP TABLE IF EXISTS "articles" CASCADE')
  })

  test('returns empty string when no changes', () => {
    const collection = defineCollection('page', {
      fields: { title: text().required() },
    })
    const snapshot = makeSnapshot({ pages: collectionToTable(collection) })
    const sql = diffSnapshots(snapshot, snapshot)

    expect(sql.trim()).toBe('')
  })

  test('returns empty for null previous (handled by createMigration)', () => {
    const collection = defineCollection('page', {
      fields: { title: text().required() },
    })
    const curr = makeSnapshot({ pages: collectionToTable(collection) })
    const sql = diffSnapshots(null, curr)

    expect(sql).toBe('')
  })
})

describe('createMigration', () => {
  let tmpDir: string

  beforeEach(async () => {
    tmpDir = await mkdtemp(join(tmpdir(), 'cms-test-'))
  })

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true })
  })

  test('creates initial migration with full schema', async () => {
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

    const result = await createMigration(config, tmpDir)
    expect(result).not.toBeNull()
    expect(result!.filename).toMatch(/^\d{4}_\d{14}\.sql$/)
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS "users"')
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS "media"')
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS "pages"')

    // Verify files created
    const migrations = await listMigrations(join(tmpDir, 'migrations'))
    expect(migrations).toHaveLength(1)

    // Verify snapshot saved
    const snapshot = await loadSnapshot(join(tmpDir, 'migrations'))
    expect(snapshot).not.toBeNull()
    expect(snapshot!.tables.pages).toBeDefined()
  })

  test('creates diff migration when schema changes', async () => {
    const config1 = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
          },
        }),
      ],
    })

    // Initial migration
    await createMigration(config1, tmpDir)

    // Add a field
    const config2 = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            excerpt: textarea(),
          },
        }),
      ],
    })

    const result = await createMigration(config2, tmpDir)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('ALTER TABLE "pages" ADD COLUMN "excerpt"')

    const migrations = await listMigrations(join(tmpDir, 'migrations'))
    expect(migrations).toHaveLength(2)
  })

  test('returns null when no changes', async () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: { title: text().required() },
        }),
      ],
    })

    await createMigration(config, tmpDir)
    const result = await createMigration(config, tmpDir)
    expect(result).toBeNull()
  })

  test('creates migration for new collection', async () => {
    const config1 = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: { title: text().required() },
        }),
      ],
    })

    await createMigration(config1, tmpDir)

    const config2 = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: { title: text().required() },
        }),
        defineCollection('article', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
          },
        }),
      ],
    })

    const result = await createMigration(config2, tmpDir)
    expect(result).not.toBeNull()
    expect(result!.sql).toContain('CREATE TABLE IF NOT EXISTS "articles"')
    expect(result!.sql).not.toContain('CREATE TABLE IF NOT EXISTS "pages"')
  })
})
