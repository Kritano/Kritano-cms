import { describe, expect, test } from 'bun:test'
import { buildGraphQLSchema } from '../graphql/schema-builder'
import { defineConfig } from '../../schema/defineConfig'
import { defineCollection } from '../../schema/defineCollection'
import { text, slug, richText, select, seoBlock, media, number, boolean, datetime, textarea, relation, array } from '../../schema/fields'

describe('buildGraphQLSchema', () => {
  test('generates types and queries for a collection', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('article', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
            excerpt: textarea(),
            views: number(),
            featured: boolean(),
            publishedAt: datetime(),
            status: select(['draft', 'published']).default('draft'),
            seo: seoBlock(),
          },
        }),
      ],
    })

    const schema = buildGraphQLSchema(config)

    // Type definition
    expect(schema).toContain('type Article {')
    expect(schema).toContain('id: ID!')
    expect(schema).toContain('title: String!')
    expect(schema).toContain('slug: String')
    expect(schema).toContain('body: JSON')
    expect(schema).toContain('excerpt: String')
    expect(schema).toContain('views: Float')
    expect(schema).toContain('featured: Boolean')
    expect(schema).toContain('seo: JSON')
    expect(schema).toContain('createdAt: String!')
    expect(schema).toContain('updatedAt: String!')
    expect(schema).toContain('publishedAt: String')

    // List type
    expect(schema).toContain('type ArticleList {')
    expect(schema).toContain('data: [Article!]!')
    expect(schema).toContain('total: Int!')

    // Queries
    expect(schema).toContain('article(id: ID!): Article')
    expect(schema).toContain('articleBySlug(slug: String!): Article')
    expect(schema).toContain('articleList(page: Int, limit: Int, status: String, sort: String, order: String): ArticleList')
  })

  test('handles multiple collections', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: { title: text().required() },
        }),
        defineCollection('article', {
          fields: { title: text().required() },
        }),
      ],
    })

    const schema = buildGraphQLSchema(config)
    expect(schema).toContain('type Page {')
    expect(schema).toContain('type Article {')
    expect(schema).toContain('page(id: ID!): Page')
    expect(schema).toContain('article(id: ID!): Article')
  })

  test('includes JSON scalar', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('page', {
          fields: { title: text().required() },
        }),
      ],
    })
    const schema = buildGraphQLSchema(config)
    expect(schema).toContain('scalar JSON')
  })

  test('media and relation fields map to ID', () => {
    const config = defineConfig({
      site: { name: 'Test', domain: 'https://test.com', language: 'en' },
      collections: [
        defineCollection('article', {
          fields: {
            title: text().required(),
            featuredImage: media(),
            author: relation('article'),
          },
        }),
      ],
    })

    const schema = buildGraphQLSchema(config)
    expect(schema).toContain('featuredImage: ID')
    expect(schema).toContain('author: ID')
  })
})
