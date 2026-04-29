# Collections

Collections are the core of Kritano CMS. Each collection defines a content type — articles, pages, projects, or anything your site needs. You define them in `cms.config.ts` and the CMS generates everything else: database tables, API endpoints, admin UI fields, and SDK types.

## Defining a collection

```typescript
import { defineConfig, defineCollection, text, slug, richText, seoBlock } from '@cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'https://mysite.com',
    language: 'en',
  },
  collections: [
    defineCollection('article', {
      fields: {
        title: text().required(),
        slug:  slug().from('title'),
        body:  richText(),
        seo:   seoBlock(),
      },
    }),
  ],
})
```

`defineCollection` takes a name and an object with a `fields` record. The name must start with a letter and contain only letters, numbers, and hyphens (e.g. `article`, `blog-post`, `teamMember`).

## System fields

Every collection automatically gets these fields — you don't define them:

| Field | Type | Description |
|---|---|---|
| `id` | UUID | Primary key, auto-generated |
| `status` | `'draft' \| 'published'` | Document status |
| `createdAt` | Timestamp | Set on creation |
| `updatedAt` | Timestamp | Updated on every save |
| `publishedAt` | Timestamp (nullable) | Set when published, cleared on unpublish |

## Naming conventions

- Collection names are camelCase or kebab-case in config: `blogPost` or `blog-post`
- Database tables are snake_case and pluralised: `blog_posts`
- Field names are camelCase in TypeScript: `featuredImage`
- Column names are snake_case in PostgreSQL: `featured_image`
- API routes use the collection name directly: `/api/blog-post` or `/api/blogPost`

## Field types

All field builders return a chainable object. Every field supports these base methods:

```typescript
text()              // Create a text field
text().required()   // Field must have a value
text().nullable()   // Field can be null
text().default('x') // Default value when creating a document
```

### text

Single-line text input. Stored as `varchar(255)` in PostgreSQL.

```typescript
title: text().required()
subtitle: text().min(3).max(100)
label: text().pattern('^[A-Z]')
```

| Method | Description |
|---|---|
| `.min(n)` | Minimum character length |
| `.max(n)` | Maximum character length |
| `.pattern(regex)` | Regex validation pattern |

### textarea

Multi-line text input. Stored as `text` (unlimited length) in PostgreSQL.

```typescript
excerpt: textarea()
bio: textarea().maxLength(500)
```

| Method | Description |
|---|---|
| `.maxLength(n)` | Maximum character length (shown as counter in admin) |

### richText

Block-based rich text editor with Visual, Markdown, and Split modes. Stored as `jsonb` (TipTap JSON) in PostgreSQL.

```typescript
body: richText()
description: richText().required()
```

The admin renders a TipTap editor with formatting toolbar (bold, italic, headings, lists, blockquote, code, links, images). See [Editor](editor.md) for details on the three modes.

### slug

Auto-generated URL slug. Stored as `varchar(255) UNIQUE` in PostgreSQL.

```typescript
slug: slug().from('title')
```

| Method | Description |
|---|---|
| `.from(fieldName)` | Source field to auto-generate slug from |

In the admin, the slug auto-updates as you type the source field. You can toggle to manual mode to edit it directly.

### url

URL input. Stored as `varchar(2048)` in PostgreSQL.

```typescript
website: url()
externalLink: url().nullable()
```

### number

Numeric input. Stored as `numeric` in PostgreSQL.

```typescript
price: number().min(0).max(9999)
quantity: number().integer()
rating: number().min(1).max(5)
```

| Method | Description |
|---|---|
| `.min(n)` | Minimum value |
| `.max(n)` | Maximum value |
| `.integer()` | Only allow whole numbers |

### boolean

Toggle switch. Stored as `boolean` (default `false`) in PostgreSQL.

```typescript
featured: boolean()
pinned: boolean().default(true)
```

### datetime

Date and time picker. Stored as `timestamptz` in PostgreSQL.

```typescript
eventDate: datetime()
publishedAt: datetime().nullable()
```

### select

Single selection from a list of options. Stored as `varchar(100)` in PostgreSQL.

```typescript
status: select(['draft', 'published']).default('draft')
category: select(['news', 'tutorial', 'review']).required()
```

The constructor takes an array of string options. At least one option is required.

### multiSelect

Multiple selections from a list. Stored as `jsonb` (string array) in PostgreSQL.

```typescript
tags: multiSelect(['javascript', 'typescript', 'react', 'node'])
```

In the admin, each option renders as a pill button that toggles on/off.

### media

Reference to an uploaded media file. Stored as `uuid` with a foreign key to the `media` table.

```typescript
featuredImage: media()
avatar: media().required()
```

In the admin, this renders a button that opens the media picker modal. You can upload new files or select from the existing library.

### relation

Reference to a document in another collection. Stored as `uuid` with a foreign key to the target collection's table.

```typescript
author: relation('author')
category: relation('category').required()
```

The constructor takes the target collection name. The target collection must exist in your config — schema validation checks this on startup.

### seoBlock

Compound SEO metadata field. Stored as `jsonb` in PostgreSQL.

```typescript
seo: seoBlock()
```

This renders a dedicated SEO panel in the editor sidebar with:

| Sub-field | Description |
|---|---|
| Meta title | With character counter (60 char target) |
| Meta description | With character counter (155 char target) |
| OG title | Open Graph title |
| OG description | Open Graph description |
| OG image | Media picker for social sharing image |
| No index | Toggle to exclude from search engines |

### blocks

Flexible content field — an ordered list of typed blocks. Stored as `jsonb` (array of `Block` objects) in PostgreSQL.

```typescript
import { blocks, block, text, richText, media, url, array } from '@cms/core'

content: blocks([
  block('hero', {
    heading:    text().required(),
    subheading: text(),
    image:      media(),
    ctaLabel:   text(),
    ctaUrl:     url(),
  }),
  block('text-block', {
    body: richText(),
  }),
  block('image-gallery', {
    images:  array(media()),
    caption: text().nullable(),
  }),
])
```

Each block definition has a name and its own set of fields. In the admin, this renders the block builder — users can add blocks, drag to reorder, expand to edit, duplicate, or delete. See [Editor](editor.md) for details.

Data is stored as:

```json
[
  {
    "id": "a1b2c3d4-...",
    "type": "hero",
    "fields": {
      "heading": "Welcome",
      "subheading": "Get started",
      "image": "media-uuid-here"
    }
  },
  {
    "id": "e5f6g7h8-...",
    "type": "text-block",
    "fields": {
      "body": { "type": "doc", "content": [...] }
    }
  }
]
```

### array

Array of another field type. Stored as `jsonb` in PostgreSQL.

```typescript
tags: array(text())
images: array(media())
relatedArticles: array(relation('article'))
```

In the admin, this renders a list with an "Add item" button. Each item can be removed individually.

### colour

Colour picker. Stored as `varchar(20)` in PostgreSQL.

```typescript
brandColour: colour()
accentColour: colour().default('#c84b2f')
```

Renders a native colour picker input in the admin.

## Schema validation

When the CMS starts, it validates your schema and throws a descriptive error if anything is wrong. Validation checks:

- Site config has `name`, `domain`, and `language`
- At least one collection is defined
- Collection names match `^[a-zA-Z][a-zA-Z0-9-]*$` with no duplicates
- Each collection has at least one field
- No duplicate field names within a collection
- Field types are valid
- `select` and `multiSelect` have at least one option
- `relation` targets reference existing collections
- `blocks` fields have at least one block type with unique names
- `array` fields specify an element type
- `text` and `number` fields with both `min` and `max` have `min <= max`

## Migrations

When you change your schema, generate and apply a migration:

```bash
bun run packages/cli/src/commands/migrate-create.ts   # Generate SQL diff
bun run packages/cli/src/commands/migrate.ts           # Apply pending migrations
```

The migration system stores a schema snapshot after each migration. When you run `migrate:create`, it diffs the current config against the last snapshot and generates the correct SQL — `CREATE TABLE` for new collections, `ALTER TABLE` for new or changed fields.

Migration files are timestamped and stored in the migrations directory. They are never modified after creation and are applied in order within transactions.

## Type generation

After changing your schema, regenerate SDK types:

```bash
bun run packages/cli/src/commands/generate.ts
```

This reads `cms.config.ts` and writes typed interfaces to `packages/sdk/src/generated/collections.ts`:

```typescript
// Auto-generated — do not edit
export interface Article extends Document {
  title: string
  slug: string
  body: Record<string, unknown>
  excerpt: string | null
  tags: unknown[]
  featuredImage: string | null
  publishedAt: string | null
  status: string
  seo: SeoBlock | null
}

export type CollectionName = 'page' | 'article' | 'project'
```
