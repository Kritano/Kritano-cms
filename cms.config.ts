import {
  defineConfig,
  defineCollection,
  text,
  slug,
  richText,
  textarea,
  select,
  media,
  array,
  datetime,
  url,
  seoBlock,
  blocks,
  block,
} from '@kritano/cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'http://localhost:4321',
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
        tags: array(text()),
        featuredImage: media(),
        publishedAt: datetime().nullable(),
        status: select(['draft', 'published']).default('draft'),
        seo: seoBlock(),
      },
    }),
    defineCollection('project', {
      fields: {
        title: text().required(),
        slug: slug().from('title'),
        description: richText(),
        url: url().nullable(),
        tags: array(text()),
        images: array(media()),
        status: select(['draft', 'published']).default('draft'),
        seo: seoBlock(),
      },
    }),
  ],
})
