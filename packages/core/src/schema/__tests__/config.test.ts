import { describe, expect, test } from 'bun:test'
import { defineConfig } from '../defineConfig'
import { defineCollection } from '../defineCollection'
import { text, slug, richText, media, select, seoBlock, textarea, relation, array, datetime, blocks, block, url } from '../fields'

describe('defineConfig and defineCollection', () => {
  test('produces a valid CmsConfig', () => {
    const config = defineConfig({
      site: {
        name: 'My Site',
        domain: 'https://mysite.com',
        language: 'en',
      },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
            featuredImage: media(),
            status: select(['draft', 'published']).default('draft'),
            seo: seoBlock(),
          },
        }),
      ],
    })

    expect(config.site.name).toBe('My Site')
    expect(config.collections).toHaveLength(1)
    expect(config.collections[0].name).toBe('page')
    expect(config.collections[0].fields.title).toEqual({ type: 'text', required: true })
    expect(config.collections[0].fields.slug).toEqual({ type: 'slug', from: 'title' })
    expect(config.collections[0].fields.status).toEqual({
      type: 'select',
      options: ['draft', 'published'],
      default: 'draft',
    })
  })

  test('handles the full blueprint example config', () => {
    const config = defineConfig({
      site: {
        name: 'My Site',
        domain: 'https://mysite.com',
        language: 'en',
      },
      collections: [
        defineCollection('page', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
            content: blocks([
              block('hero', {
                heading: text().required(),
                subheading: text(),
                image: media(),
                ctaLabel: text(),
                ctaUrl: url(),
              }),
              block('text-block', {
                body: richText(),
              }),
              block('image-gallery', {
                images: array(media()),
                caption: text().nullable(),
              }),
            ]),
            featuredImage: media(),
            status: select(['draft', 'published']).default('draft'),
            seo: seoBlock(),
          },
        }),
        defineCollection('article', {
          fields: {
            title: text().required(),
            slug: slug().from('title'),
            body: richText(),
            excerpt: textarea().maxLength(300),
            author: relation('user'),
            tags: array(text()),
            featuredImage: media(),
            publishedAt: datetime().nullable(),
            status: select(['draft', 'published']).default('draft'),
            seo: seoBlock(),
          },
        }),
      ],
    })

    expect(config.collections).toHaveLength(2)
    expect(config.collections[0].name).toBe('page')
    expect(config.collections[1].name).toBe('article')

    // Verify blocks resolved correctly
    const contentField = config.collections[0].fields.content
    expect(contentField.type).toBe('blocks')
    if (contentField.type === 'blocks') {
      expect(contentField.blocks).toHaveLength(3)
      expect(contentField.blocks[0].name).toBe('hero')
      expect(contentField.blocks[2].fields.images).toEqual({
        type: 'array',
        of: { type: 'media' },
      })
    }
  })
})
