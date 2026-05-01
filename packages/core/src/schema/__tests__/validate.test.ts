import { describe, expect, test } from 'bun:test'
import { validateSchema, SchemaValidationError } from '../validate'
import { defineConfig } from '../defineConfig'
import { defineCollection } from '../defineCollection'
import { text, slug, richText, select, seoBlock, media, relation, blocks, block, array, number } from '../fields'
import type { CmsConfig } from '@kritano/cms/types'

function validConfig(): CmsConfig {
  return defineConfig({
    site: { name: 'Test', domain: 'https://test.com', language: 'en' },
    collections: [
      defineCollection('page', {
        fields: {
          title: text().required(),
          slug: slug().from('title'),
          body: richText(),
          status: select(['draft', 'published']).default('draft'),
        },
      }),
    ],
  })
}

describe('validateSchema', () => {
  test('passes on valid config', () => {
    expect(() => validateSchema(validConfig())).not.toThrow()
  })

  // Site validation
  test('throws on missing site.name', () => {
    const config = validConfig()
    ;(config.site as any).name = ''
    expect(() => validateSchema(config)).toThrow(SchemaValidationError)
  })

  test('throws on missing site.domain', () => {
    const config = validConfig()
    ;(config.site as any).domain = ''
    expect(() => validateSchema(config)).toThrow(SchemaValidationError)
  })

  // Collection validation
  test('throws on empty collections array', () => {
    const config = validConfig()
    config.collections = []
    expect(() => validateSchema(config)).toThrow('At least one collection')
  })

  test('throws on duplicate collection names', () => {
    const config = validConfig()
    config.collections.push({ ...config.collections[0] })
    expect(() => validateSchema(config)).toThrow('Duplicate collection name')
  })

  test('throws on invalid collection name', () => {
    const config = validConfig()
    config.collections[0].name = '123invalid'
    expect(() => validateSchema(config)).toThrow('must start with a letter')
  })

  test('throws on collection with no fields', () => {
    const config = validConfig()
    config.collections[0].fields = {}
    expect(() => validateSchema(config)).toThrow('must have at least one field')
  })

  // Field validation
  test('throws on select with empty options', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            status: select([]),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('at least one option')
  })

  test('throws on relation to non-existent collection', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('article', {
          fields: {
            title: text().required(),
            author: relation('user'),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('does not match any collection')
  })

  test('passes on relation to existing collection', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('user', {
          fields: {
            name: text().required(),
          },
        }),
        defineCollection('article', {
          fields: {
            title: text().required(),
            author: relation('user'),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).not.toThrow()
  })

  test('throws on slug from non-existent field', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            slug: slug().from('nonexistent'),
            body: richText(),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('does not exist in this collection')
  })

  test('throws on text field with min > max', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().min(100).max(10),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('min (100) cannot be greater than max (10)')
  })

  test('throws on number field with min > max', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            count: number().min(50).max(10),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('min (50) cannot be greater than max (10)')
  })

  test('throws on blocks with no block definitions', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            content: blocks([]),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('at least one block type')
  })

  test('throws on blocks with duplicate block names', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            content: blocks([
              block('hero', { heading: text() }),
              block('hero', { title: text() }),
            ]),
          },
        }),
      ],
    })
    expect(() => validateSchema(config)).toThrow('duplicate block name "hero"')
  })

  test('validates a complex config with multiple collections and blocks', () => {
    const config = defineConfig({
      site: { name: 'Portfolio', domain: 'https://portfolio.dev', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            content: blocks([
              block('hero', {
                heading: text().required(),
                image: media(),
              }),
              block('gallery', {
                images: array(media()),
              }),
            ]),
            seo: seoBlock(),
            status: select(['draft', 'published']).default('draft'),
          },
        }),
        defineCollection('article', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
            author: relation('article'),
            status: select(['draft', 'published']),
          },
        }),
      ],
    })
    // Self-referencing relation is valid
    expect(() => validateSchema(config)).not.toThrow()
  })
})
