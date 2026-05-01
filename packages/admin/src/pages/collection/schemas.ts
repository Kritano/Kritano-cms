import type { CollectionDefinition, FieldDefinition } from '@kritano/cms/types'

// Hardcoded collection schemas for v0.1
// In production, these will come from the CMS config API
export const COLLECTION_SCHEMAS: Record<string, CollectionDefinition> = {
  page: {
    name: 'page',
    fields: {
      title: { type: 'text', required: true },
      slug: { type: 'slug', from: 'title' },
      body: { type: 'richText' },
      content: {
        type: 'blocks',
        blocks: [
          {
            name: 'hero',
            fields: {
              heading: { type: 'text', required: true },
              subheading: { type: 'text' },
              image: { type: 'media' },
              ctaLabel: { type: 'text' },
              ctaUrl: { type: 'url' },
            },
          },
          {
            name: 'text-block',
            fields: {
              body: { type: 'richText' },
            },
          },
          {
            name: 'image-gallery',
            fields: {
              images: { type: 'array', of: { type: 'media' } },
              caption: { type: 'text', nullable: true },
            },
          },
        ],
      },
      featuredImage: { type: 'media' },
      status: { type: 'select', options: ['draft', 'published'], default: 'draft' },
      seo: { type: 'seoBlock' },
    },
  },
  article: {
    name: 'article',
    fields: {
      title: { type: 'text', required: true },
      slug: { type: 'slug', from: 'title' },
      body: { type: 'richText' },
      excerpt: { type: 'textarea', maxLength: 300 },
      tags: { type: 'array', of: { type: 'text' } },
      featuredImage: { type: 'media' },
      publishedAt: { type: 'datetime', nullable: true },
      status: { type: 'select', options: ['draft', 'published'], default: 'draft' },
      seo: { type: 'seoBlock' },
    },
  },
  project: {
    name: 'project',
    fields: {
      title: { type: 'text', required: true },
      slug: { type: 'slug', from: 'title' },
      description: { type: 'richText' },
      url: { type: 'url', nullable: true },
      tags: { type: 'array', of: { type: 'text' } },
      images: { type: 'array', of: { type: 'media' } },
      status: { type: 'select', options: ['draft', 'published'], default: 'draft' },
      seo: { type: 'seoBlock' },
    },
  },
}
