# Live preview

Live preview lets editors see draft content rendered on the actual site before publishing. It works with any frontend framework — Astro, Next.js, Nuxt, SvelteKit, or anything that can read a URL parameter.

## How it works

1. Editor opens a document in the admin and clicks **Preview**
2. The admin generates a signed preview token (valid for 2 hours)
3. A new tab opens: `https://mysite.com/article/my-draft?cms_preview=<token>`
4. The frontend detects `cms_preview` in the URL, validates it, fetches draft content
5. The page renders with unpublished content and a preview banner

## Preview token

The token is a signed JWT containing:

```typescript
{
  documentId: string   // the document UUID
  collection: string   // the collection name
  type: 'preview'      // token type marker
  exp: number          // expiry — 2 hours from generation
}
```

Signed with the same `JWT_SECRET` as auth tokens — not forgeable.

## API endpoints

### Generate a preview token

```
POST /api/preview/token
Authorization: Bearer <access-token>
```

```json
{ "documentId": "uuid-here", "collection": "article" }
```

**Response:**

```json
{ "token": "eyJhbGci..." }
```

### Validate a preview token

```
GET /api/preview/validate?token=eyJhbGci...
```

**Response (valid):**

```json
{ "valid": true, "documentId": "uuid-here", "collection": "article" }
```

**Response (expired):**

```json
{ "valid": false, "error": "Preview token has expired" }
```

### Fetch draft content

```
GET /api/article/uuid-here/preview?cms_preview=eyJhbGci...
```

Returns the document regardless of status (draft, published, etc.). This is the **only public endpoint** that returns draft content. The token must match the requested document.

## Astro integration

The `@cms/astro` package handles preview automatically:

```typescript
import { getCMSClient, getPreviewToken, getPreviewBannerHtml } from '@cms/astro'

// In your page template:
const previewToken = await getPreviewToken(Astro.url)
const cms = getCMSClient(previewToken || undefined)

// If previewing, fetch draft; otherwise fetch published
const article = previewToken
  ? await cms.collection('article').findPreview(id, previewToken)
  : await cms.collection('article').findOne({ where: { slug } })
```

Add the preview banner when in preview mode:

```astro
---
const previewToken = await getPreviewToken(Astro.url)
---
{previewToken && <Fragment set:html={getPreviewBannerHtml()} />}
```

The banner shows "Preview mode — viewing unpublished content" with an "Exit preview" link.

## Next.js integration

```typescript
// app/[collection]/[slug]/page.tsx
import { CMSClient } from '@cms/sdk'

export default async function Page({ params, searchParams }) {
  const previewToken = searchParams.cms_preview
  const cms = new CMSClient({
    url: process.env.CMS_URL,
    previewToken,
  })

  const doc = previewToken
    ? await cms.collection(params.collection).findPreview(params.id, previewToken)
    : await cms.collection(params.collection).findOne({ where: { slug: params.slug } })

  return (
    <>
      {previewToken && (
        <div style={{ background: '#1e1b4b', color: '#fff', textAlign: 'center', padding: '8px' }}>
          Preview mode — viewing unpublished content
        </div>
      )}
      <h1>{doc.title}</h1>
      {/* render content */}
    </>
  )
}
```

## Nuxt integration

```typescript
// pages/[collection]/[slug].vue
<script setup>
const route = useRoute()
const previewToken = route.query.cms_preview

const cms = new CMSClient({
  url: useRuntimeConfig().public.cmsUrl,
  previewToken,
})

const doc = previewToken
  ? await cms.collection(route.params.collection).findPreview(route.params.id, previewToken)
  : await cms.collection(route.params.collection).findOne({ where: { slug: route.params.slug } })
</script>

<template>
  <div v-if="previewToken" class="preview-banner">
    Preview mode — viewing unpublished content
  </div>
  <h1>{{ doc.title }}</h1>
</template>
```

## SvelteKit integration

```typescript
// src/routes/[collection]/[slug]/+page.server.ts
import { CMSClient } from '@cms/sdk'

export async function load({ params, url }) {
  const previewToken = url.searchParams.get('cms_preview')
  const cms = new CMSClient({
    url: import.meta.env.CMS_URL,
    previewToken: previewToken ?? undefined,
  })

  const doc = previewToken
    ? await cms.collection(params.collection).findPreview(params.id, previewToken)
    : await cms.collection(params.collection).findOne({ where: { slug: params.slug } })

  return { doc, isPreview: !!previewToken }
}
```

## Security notes

- Preview tokens expire after **2 hours** — expired tokens return 401
- Tokens are scoped to a specific document and collection — a token for `article/abc` cannot preview `page/xyz`
- The preview endpoint is public but requires a valid token — it cannot be used for fishing
- Preview tokens cannot be refreshed — generate a new one after expiry
- The token is passed as a URL parameter, not a cookie — preview links can be shared within the team for the token's lifetime
