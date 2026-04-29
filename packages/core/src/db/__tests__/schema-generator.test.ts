import { describe, expect, test } from 'bun:test'
import {
  fieldToColumn,
  fieldToColumnName,
  collectionToTableName,
  collectionToTable,
  generateCreateTableSQL,
  generateFullSchemaSQL,
  generateMediaTableSQL,
  generateUsersTableSQL,
} from '../schema-generator'
import { defineConfig } from '../../schema/defineConfig'
import { defineCollection, defineCollection as defCol } from '../../schema/defineCollection'
import {
  text, textarea, richText, slug, url, number, boolean, datetime,
  select, multiSelect, media, relation, seoBlock, blocks, block, array, colour,
} from '../../schema/fields'

describe('fieldToColumnName', () => {
  test('converts camelCase to snake_case', () => {
    expect(fieldToColumnName('featuredImage')).toBe('featured_image')
    expect(fieldToColumnName('publishedAt')).toBe('published_at')
    expect(fieldToColumnName('title')).toBe('title')
    expect(fieldToColumnName('ctaUrl')).toBe('cta_url')
  })
})

describe('collectionToTableName', () => {
  test('pluralises and converts to snake_case', () => {
    expect(collectionToTableName('page')).toBe('pages')
    expect(collectionToTableName('article')).toBe('articles')
    expect(collectionToTableName('project')).toBe('projects')
  })

  test('handles kebab-case', () => {
    expect(collectionToTableName('blog-post')).toBe('blog_posts')
  })

  test('does not double-pluralise', () => {
    expect(collectionToTableName('news')).toBe('news')
  })
})

describe('fieldToColumn', () => {
  test('text → varchar(255)', () => {
    const col = fieldToColumn('title', text().required().toDefinition())
    expect(col.sqlType).toBe('varchar(255)')
    expect(col.nullable).toBe(false)
  })

  test('textarea → text', () => {
    const col = fieldToColumn('excerpt', textarea().toDefinition())
    expect(col.sqlType).toBe('text')
  })

  test('richText → jsonb', () => {
    const col = fieldToColumn('body', richText().toDefinition())
    expect(col.sqlType).toBe('jsonb')
  })

  test('slug → varchar(255) UNIQUE', () => {
    const col = fieldToColumn('slug', slug().from('title').toDefinition())
    expect(col.sqlType).toBe('varchar(255)')
    expect(col.unique).toBe(true)
  })

  test('url → varchar(2048)', () => {
    const col = fieldToColumn('website', url().toDefinition())
    expect(col.sqlType).toBe('varchar(2048)')
  })

  test('number → numeric', () => {
    const col = fieldToColumn('count', number().toDefinition())
    expect(col.sqlType).toBe('numeric')
  })

  test('boolean → boolean with default false', () => {
    const col = fieldToColumn('active', boolean().toDefinition())
    expect(col.sqlType).toBe('boolean')
    expect(col.defaultValue).toBe('false')
  })

  test('datetime → timestamptz', () => {
    const col = fieldToColumn('publishedAt', datetime().toDefinition())
    expect(col.sqlType).toBe('timestamptz')
  })

  test('select → varchar(100)', () => {
    const col = fieldToColumn('status', select(['draft', 'published']).toDefinition())
    expect(col.sqlType).toBe('varchar(100)')
  })

  test('multiSelect → jsonb', () => {
    const col = fieldToColumn('tags', multiSelect(['a', 'b']).toDefinition())
    expect(col.sqlType).toBe('jsonb')
  })

  test('media → uuid with FK to media table', () => {
    const col = fieldToColumn('featuredImage', media().toDefinition())
    expect(col.sqlType).toBe('uuid')
    expect(col.references).toEqual({ table: 'media', column: 'id' })
  })

  test('relation → uuid with FK to target table', () => {
    const col = fieldToColumn('author', relation('user').toDefinition())
    expect(col.sqlType).toBe('uuid')
    expect(col.references).toEqual({ table: 'users', column: 'id' })
  })

  test('seoBlock → jsonb', () => {
    const col = fieldToColumn('seo', seoBlock().toDefinition())
    expect(col.sqlType).toBe('jsonb')
  })

  test('blocks → jsonb', () => {
    const col = fieldToColumn('content', blocks([block('hero', { heading: text() })]).toDefinition())
    expect(col.sqlType).toBe('jsonb')
  })

  test('array → jsonb', () => {
    const col = fieldToColumn('tags', array(text()).toDefinition())
    expect(col.sqlType).toBe('jsonb')
  })

  test('colour → varchar(20)', () => {
    const col = fieldToColumn('primary', colour().toDefinition())
    expect(col.sqlType).toBe('varchar(20)')
  })

  test('nullable field', () => {
    const col = fieldToColumn('website', url().nullable().toDefinition())
    expect(col.nullable).toBe(true)
  })

  test('field with default value', () => {
    const col = fieldToColumn('status', select(['draft', 'published']).default('draft').toDefinition())
    expect(col.defaultValue).toBe("'draft'")
  })

  test('converts camelCase field name to snake_case column', () => {
    const col = fieldToColumn('featuredImage', media().toDefinition())
    expect(col.name).toBe('featured_image')
  })
})

describe('collectionToTable', () => {
  test('generates system columns + field columns', () => {
    const collection = defCol('article', {
      fields: {
        title: text().required(),
        slug: slug().from('title'),
        body: richText(),
        status: select(['draft', 'published']).default('draft'),
      },
    })
    const table = collectionToTable(collection)

    expect(table.name).toBe('articles')
    // System columns: id, status, created_at, updated_at, published_at
    // Field columns: title, slug, body (status is skipped — system column)
    const colNames = table.columns.map((c) => c.name)
    expect(colNames).toContain('id')
    expect(colNames).toContain('status')
    expect(colNames).toContain('created_at')
    expect(colNames).toContain('updated_at')
    expect(colNames).toContain('published_at')
    expect(colNames).toContain('title')
    expect(colNames).toContain('slug')
    expect(colNames).toContain('body')
  })

  test('does not duplicate status column', () => {
    const collection = defCol('page', {
      fields: {
        title: text().required(),
        status: select(['draft', 'published']).default('draft'),
      },
    })
    const table = collectionToTable(collection)
    const statusCols = table.columns.filter((c) => c.name === 'status')
    expect(statusCols).toHaveLength(1)
  })
})

describe('generateCreateTableSQL', () => {
  test('produces valid SQL', () => {
    const collection = defCol('page', {
      fields: {
        title: text().required(),
        slug: slug().from('title'),
        body: richText(),
      },
    })
    const table = collectionToTable(collection)
    const sql = generateCreateTableSQL(table)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "pages"')
    expect(sql).toContain('"id" uuid PRIMARY KEY')
    expect(sql).toContain('"title" varchar(255) NOT NULL')
    expect(sql).toContain('"slug" varchar(255) UNIQUE')
    expect(sql).toContain('"body" jsonb')
    expect(sql).toContain('"status" varchar(20) NOT NULL')
    expect(sql).toContain('"created_at" timestamptz NOT NULL DEFAULT now()')
  })

  test('includes foreign key constraints', () => {
    const collection = defCol('article', {
      fields: {
        title: text().required(),
        featuredImage: media(),
      },
    })
    const table = collectionToTable(collection)
    const sql = generateCreateTableSQL(table)

    expect(sql).toContain('CONSTRAINT "fk_articles_featured_image"')
    expect(sql).toContain('REFERENCES "media"')
  })
})

describe('generateFullSchemaSQL', () => {
  test('includes system tables and collection tables', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defCol('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
          },
        }),
      ],
    })
    const sql = generateFullSchemaSQL(config)

    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "users"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "media"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "site_settings"')
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS "pages"')
    expect(sql).toContain('update_updated_at_column')
  })
})

describe('generateMediaTableSQL', () => {
  test('includes all required columns', () => {
    const sql = generateMediaTableSQL()
    expect(sql).toContain('"filename" varchar(500) NOT NULL')
    expect(sql).toContain('"original_filename" varchar(500) NOT NULL')
    expect(sql).toContain('"mime_type" varchar(100) NOT NULL')
    expect(sql).toContain('"size" integer NOT NULL')
    expect(sql).toContain('"width" integer')
    expect(sql).toContain('"height" integer')
    expect(sql).toContain('"alt" text')
    expect(sql).toContain('"url" varchar(2048) NOT NULL')
    expect(sql).toContain('"thumbnail_url" varchar(2048)')
  })
})

describe('generateUsersTableSQL', () => {
  test('includes all required columns', () => {
    const sql = generateUsersTableSQL()
    expect(sql).toContain('"email" varchar(255) NOT NULL UNIQUE')
    expect(sql).toContain('"password_hash" varchar(255) NOT NULL')
    expect(sql).toContain('"name" varchar(255)')
  })
})
