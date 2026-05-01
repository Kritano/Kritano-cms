# Full-text search

Kritano CMS includes full-text search powered by [Typesense](https://typesense.org/) — a fast, typo-tolerant search engine. Search works out of the box: publish a document and it's immediately searchable.

## How it works

1. When you publish a document, the CMS automatically indexes it in Typesense
2. When you unpublish or delete, it's removed from the index
3. Only published documents are searchable — drafts are never indexed

Field types are mapped automatically:

| CMS field type | Typesense type | Notes |
|---|---|---|
| text, textarea, slug, url | string | Full-text searchable |
| richText | string | TipTap JSON converted to plain text |
| number | float | Numeric filtering and sorting |
| boolean | bool | Faceting |
| datetime | int64 | Unix timestamp, sortable |
| select | string (facet) | Faceted filtering |
| multiSelect | string[] (facet) | Array facets |
| media, relation, seoBlock, blocks | — | Not indexed |

## Configuration

Set these environment variables to enable search:

```
TYPESENSE_HOST=localhost
TYPESENSE_PORT=8108
TYPESENSE_PROTOCOL=http
TYPESENSE_API_KEY=your-typesense-api-key
```

If these are not set, search is **gracefully disabled** — no errors, the CMS starts normally. Search endpoints return `{ search_unavailable: true }`.

## Admin global search

Press **Cmd+K** (macOS) or **Ctrl+K** (Windows/Linux) anywhere in the admin to open global search. It searches across all collections with a 200ms debounce, results grouped by collection. Click a result to navigate to the document editor.

## API endpoints

### Global search

```
GET /api/search?q=typescript&collections=article,page&limit=5&page=1
```

| Param | Required | Default | Description |
|---|---|---|---|
| `q` | Yes | — | Search query |
| `collections` | No | All | Comma-separated collection names |
| `limit` | No | 5 | Results per collection (max 20) |
| `page` | No | 1 | Page number |

Published content is public (no auth required). Draft content requires authentication.

### Collection-scoped search

```
GET /api/search/article?q=typescript&filter=tags:=[typescript]&sort=publishedAt:desc
```

Additional params: `filter` (Typesense filter syntax), `sort` (field:direction).

### Autocomplete

```
GET /api/search/suggest?q=type&collection=article
```

Returns an array of suggested document titles. Minimum 2 characters.

## SDK methods

```typescript
import { CMSClient } from '@cms/sdk'

const cms = new CMSClient({ url: 'https://mysite.com/api' })

// Global search
const results = await cms.search.search({
  q: 'typescript',
  collections: ['article', 'page'],
  limit: 10,
})

// Collection-scoped search
const articles = await cms.collection('article').search({
  q: 'typescript',
  filter: 'tags:=[typescript]',
  sort: 'publishedAt:desc',
})

// Autocomplete suggestions
const suggestions = await cms.search.suggest({
  q: 'type',
  collection: 'article',
})
```

## Astro search component

The `@cms/astro` package provides a `renderSearchForm()` helper:

```typescript
import { renderSearchForm } from '@cms/astro'

// Plain HTML form — zero JS, works without JavaScript
const html = renderSearchForm({
  placeholder: 'Search articles...',
  collection: 'article',       // optional — omit for global
  resultsUrl: '/search',
})

// With live search enhancement
const html = renderSearchForm({
  placeholder: 'Search...',
  resultsUrl: '/search',
  enhance: true,   // adds a <5kb defer-loaded script for search-as-you-type
})
```

The default theme includes a search results page at `/search` that displays grouped results with highlighted excerpts.

## CLI commands

```bash
# Re-index all published documents across all collections
bun run packages/cli/src/index.ts search:sync

# Clear all search indexes (useful during development)
bun run packages/cli/src/index.ts search:clear
```

## Graceful degradation

If Typesense becomes unavailable after startup:

- The CMS continues to run normally
- Search endpoints return `{ search_unavailable: true }` instead of errors
- Publishing still works — index operations fail silently
- When Typesense comes back, run `cms search:sync` to re-index
