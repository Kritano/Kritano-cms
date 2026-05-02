# API reference

Kritano CMS exposes a REST API and a GraphQL endpoint, both auto-generated from your collection schema. The API runs on [Hono](https://hono.dev/) with Bun.

**Base URL:** `http://localhost:3000/api` (development)

## Authentication

Write endpoints (POST, PUT, PATCH, DELETE, publish, unpublish) require authentication via either a JWT token or an API key in the `Authorization` header. Read endpoints for published documents are public. Read endpoints for draft documents require authentication.

API keys use the format `Bearer cms_live_...` — see [API keys](api-keys.md) for details.

```
Authorization: Bearer <access-token>
```

### Login

```
POST /api/auth/login
```

```json
{
  "email": "cms-admin@kritano.com",
  "password": "admin"
}
```

**Response (200):**

```json
{
  "user": {
    "id": "uuid",
    "email": "cms-admin@kritano.com",
    "name": null,
    "createdAt": "2026-04-28T12:00:00.000Z",
    "updatedAt": "2026-04-28T12:00:00.000Z"
  },
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi..."
}
```

The access token expires after 1 hour. The refresh token expires after 30 days.

### Refresh token

```
POST /api/auth/refresh
```

```json
{
  "refreshToken": "eyJhbGciOi..."
}
```

**Response (200):**

```json
{
  "accessToken": "eyJhbGciOi...",
  "refreshToken": "eyJhbGciOi..."
}
```

### Get current user

```
GET /api/auth/me
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "data": {
    "id": "uuid",
    "email": "cms-admin@kritano.com",
    "name": null,
    "createdAt": "2026-04-28T12:00:00.000Z",
    "updatedAt": "2026-04-28T12:00:00.000Z"
  }
}
```

### Logout

```
POST /api/auth/logout
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "ok": true
}
```

JWT is stateless — logout is handled client-side by discarding tokens.

## Collection endpoints

These endpoints are auto-generated for every collection defined in `cms.config.ts`. Replace `{collection}` with your collection name (e.g. `articles`, `pages`, `projects`).

### List documents

```
GET /api/{collection}
```

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page (max 100) |
| `status` | string | — | Filter by status: `draft` or `published` |
| `sort` | string | `created_at` | Field to sort by |
| `order` | string | `desc` | Sort direction: `asc` or `desc` |
| `search` | string | — | Search by title (ILIKE pattern match) |

**Access control:**
- Unauthenticated requests only see published documents.
- Authenticated requests can filter by any status.

**Response (200):**

```json
{
  "data": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "title": "Hello World",
      "slug": "hello-world",
      "status": "published",
      "created_at": "2026-04-28T12:00:00.000Z",
      "updated_at": "2026-04-28T12:30:00.000Z",
      "published_at": "2026-04-28T12:30:00.000Z"
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Get document by ID

```
GET /api/{collection}/{id}
```

Returns a single document. Unauthenticated requests can only access published documents.

**Response (200):**

```json
{
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "title": "Hello World",
    "slug": "hello-world",
    "body": { "type": "doc", "content": [...] },
    "status": "published",
    "created_at": "2026-04-28T12:00:00.000Z",
    "updated_at": "2026-04-28T12:30:00.000Z",
    "published_at": "2026-04-28T12:30:00.000Z"
  }
}
```

### Get document by slug

```
GET /api/{collection}/slug/{slug}
```

Same as get by ID, but looks up the document by its slug field. Unauthenticated requests can only access published documents.

### Create document

```
POST /api/{collection}
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "title": "My New Article",
  "slug": "my-new-article",
  "body": { "type": "doc", "content": [] },
  "excerpt": "A short summary",
  "status": "draft"
}
```

**Response (201):**

```json
{
  "data": {
    "id": "new-uuid",
    "title": "My New Article",
    "slug": "my-new-article",
    "status": "draft",
    ...
  }
}
```

New documents default to `draft` status.

### Update document (full)

```
PUT /api/{collection}/{id}
Authorization: Bearer <access-token>
Content-Type: application/json
```

Send all fields. Omitted fields will be set to their default or null.

### Update document (partial)

```
PATCH /api/{collection}/{id}
Authorization: Bearer <access-token>
Content-Type: application/json
```

Send only the fields you want to update. Other fields remain unchanged.

```json
{
  "title": "Updated Title"
}
```

### Delete document

```
DELETE /api/{collection}/{id}
Authorization: Bearer <access-token>
```

**Response (200):**

```json
{
  "ok": true
}
```

### Publish document

```
POST /api/{collection}/{id}/publish
Authorization: Bearer <access-token>
```

Sets `status` to `published` and records the current timestamp as `published_at`. The document becomes visible to unauthenticated API requests.

### Unpublish document

```
POST /api/{collection}/{id}/unpublish
Authorization: Bearer <access-token>
```

Sets `status` to `draft` and clears `published_at`. The document is no longer visible to unauthenticated requests.

## Media endpoints

### Upload media

```
POST /api/media/upload
Authorization: Bearer <access-token>
Content-Type: multipart/form-data
```

Send a file in the `file` field. Accepted MIME types: `image/jpeg`, `image/png`, `image/gif`, `image/webp`, `image/svg+xml`, `application/pdf`.

On upload, images are:
1. Saved in their original format
2. Converted to WebP (quality 85)
3. Thumbnailed at 400px wide (quality 80)

**Response (201):**

```json
{
  "media": {
    "id": "uuid",
    "filename": "abc123.webp",
    "original_filename": "photo.jpg",
    "mime_type": "image/jpeg",
    "size": 245760,
    "width": 1920,
    "height": 1080,
    "alt": null,
    "url": "/media/abc123.webp",
    "thumbnail_url": "/media/abc123-thumb.webp",
    "created_at": "2026-04-28T12:00:00.000Z",
    "updated_at": "2026-04-28T12:00:00.000Z"
  }
}
```

### List media

```
GET /api/media
Authorization: Bearer <access-token>
```

**Query parameters:**

| Parameter | Type | Default | Description |
|---|---|---|---|
| `page` | number | `1` | Page number |
| `limit` | number | `20` | Items per page (max 100) |

**Response (200):**

```json
{
  "data": [...],
  "total": 42,
  "page": 1,
  "limit": 20,
  "totalPages": 3
}
```

Ordered by `created_at` descending (newest first).

### Update media

```
PATCH /api/media/{id}
Authorization: Bearer <access-token>
Content-Type: application/json
```

```json
{
  "alt": "A sunset over the mountains"
}
```

Currently only `alt` text can be updated.

### Delete media

```
DELETE /api/media/{id}
Authorization: Bearer <access-token>
```

Deletes the original file, WebP version, and thumbnail from disk, then removes the database record.

## Sitemap

```
GET /api/sitemap.xml
```

Returns a valid XML sitemap containing all published documents across all collections. URLs are formatted as `{domain}/{collectionName}/{slug}` (or `{id}` if no slug). The `lastmod` value comes from each document's `updated_at` timestamp.

The sitemap regenerates on every request — no caching in v0.1.

## Health check

```
GET /api/health
```

**Response (200):**

```json
{
  "ok": true,
  "version": "0.1.0"
}
```

## Kritano webhook

```
POST /api/kritano/webhook
```

Receives audit completion events from the Kritano platform. Expects a JSON body with `event: "audit.completed"` and stores the scores in the site settings table. The admin UI reflects updated scores via TanStack Query invalidation.

### Kritano status

```
GET /api/kritano/status
```

Returns the current Kritano connection status and latest audit scores.

**Response (200):**

```json
{
  "connected": true,
  "scores": {
    "overall": 78,
    "seo": 82,
    "accessibility": 71,
    "performance": 89,
    "ai_visibility": null
  },
  "lastAudit": {
    "audit_id": "abc123",
    "completed_at": "2026-04-28T10:00:00.000Z"
  }
}
```

## GraphQL

```
POST /api/graphql
Content-Type: application/json
```

The GraphQL schema is auto-generated from your collection definitions. For each collection, three queries are available.

### Queries

**Single document by ID:**

```graphql
query {
  article(id: "550e8400-e29b-41d4-a716-446655440000") {
    id
    title
    slug
    body
    status
    createdAt
    updatedAt
    publishedAt
  }
}
```

**Single document by slug:**

```graphql
query {
  articleBySlug(slug: "hello-world") {
    id
    title
    body
  }
}
```

**Paginated list:**

```graphql
query {
  articleList(page: 1, limit: 10, status: "published", sort: "publishedAt", order: "desc") {
    data {
      id
      title
      slug
      excerpt
      publishedAt
    }
    total
    page
    limit
    totalPages
  }
}
```

### Query naming

Queries are named after the collection:

| Collection | Single by ID | Single by slug | List |
|---|---|---|---|
| `article` | `article(id: ID!)` | `articleBySlug(slug: String!)` | `articleList(...)` |
| `page` | `page(id: ID!)` | `pageBySlug(slug: String!)` | `pageList(...)` |
| `project` | `project(id: ID!)` | `projectBySlug(slug: String!)` | `projectList(...)` |

### List query arguments

| Argument | Type | Default | Description |
|---|---|---|---|
| `page` | Int | `1` | Page number |
| `limit` | Int | `20` | Items per page (max 100) |
| `status` | String | — | Filter by status |
| `sort` | String | `created_at` | Sort field |
| `order` | String | `desc` | Sort direction |

### Field types in GraphQL

| CMS field | GraphQL type |
|---|---|
| `text`, `textarea`, `slug`, `url`, `select`, `colour` | `String` |
| `richText`, `seoBlock`, `blocks`, `multiSelect`, `array` | `JSON` |
| `number` | `Float` |
| `boolean` | `Boolean` |
| `datetime` | `String` |
| `media`, `relation` | `ID` |

Fields marked `.required()` in the schema become non-nullable in GraphQL.

## Error responses

All error responses follow this format:

```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "Document not found"
  }
}
```

Common error codes:

| Code | HTTP Status | Description |
|---|---|---|
| `UNAUTHORIZED` | 401 | Missing or invalid JWT |
| `NOT_FOUND` | 404 | Document or resource not found |
| `VALIDATION_ERROR` | 400 | Invalid request body |
| `INTERNAL_ERROR` | 500 | Server error |
| `FORBIDDEN` | 403 | Insufficient permissions or API key scope |

## Phase 0.2 endpoints

The following endpoints were added in v0.2. See their dedicated documentation pages for full details.

### Roles and users — [docs](users-and-roles.md)

```
GET/POST/PUT/DELETE  /api/admin/roles
GET/POST/DELETE      /api/admin/users
POST/GET/DELETE      /api/admin/invitations
POST                 /api/auth/accept-invitation
POST                 /api/auth/2fa/setup | /verify | /disable | /challenge
POST                 /api/auth/change-password
GET                  /api/admin/activity
```

### Revision history — [docs](revisions.md)

```
GET    /api/:collection/:id/revisions
GET    /api/:collection/:id/revisions/:revId
POST   /api/:collection/:id/revisions/:revId/restore
```

### Scheduled publishing — [docs](scheduling.md)

```
POST   /api/:collection/:id/schedule
GET    /api/:collection/:id/schedule
DELETE /api/:collection/:id/schedule
```

### Webhooks — [docs](webhooks.md)

```
GET/POST/PUT/DELETE  /api/admin/webhooks
GET                  /api/admin/webhooks/:id/deliveries
POST                 /api/admin/webhooks/:id/test
```

### Redirects — [docs](redirects.md)

```
GET/POST/PUT/DELETE  /api/admin/redirects
POST                 /api/admin/redirects/import
GET                  /api/admin/redirects/export
POST                 /api/admin/redirects/check-chains
```

### API keys — [docs](api-keys.md)

```
GET/POST/DELETE      /api/admin/api-keys
```

### Forms — [docs](forms.md)

```
GET/POST/PUT/DELETE  /api/admin/forms
GET                  /api/admin/forms/:id/submissions
GET                  /api/admin/forms/:id/export
DELETE               /api/admin/forms/:id/submissions/:subId
GET                  /api/forms/:slug              (public)
POST                 /api/forms/:slug/submit       (public)
GET                  /api/forms/embed.js           (public)
GET                  /api/forms/enhance.js         (public)
```

### Media folders

```
GET/POST/PATCH/DELETE  /api/admin/media/folders
PATCH                  /api/media/:id/folder
GET                    /api/media/:id/usage
```

### Search — [docs](search.md)

```
GET                    /api/search                      Global search
GET                    /api/search/:collection           Collection-scoped search
GET                    /api/search/suggest               Autocomplete suggestions
```

### Preview — [docs](preview.md)

```
POST                   /api/preview/token                Generate preview token
GET                    /api/preview/validate              Validate preview token
GET                    /api/:collection/:id/preview       Get draft content via preview token
```

### OAuth — [docs](oauth.md)

```
GET                    /api/auth/oauth/providers          List configured providers
GET                    /api/auth/oauth/:provider          Start OAuth flow
GET                    /api/auth/oauth/:provider/callback  OAuth callback
POST                   /api/auth/oauth/link               Link provider to account
DELETE                 /api/auth/oauth/:provider/unlink   Unlink provider
GET                    /api/auth/oauth/accounts           List linked accounts
```

### Plugins — [docs](plugins/using-plugins.md)

```
GET                    /api/admin/plugins                 List installed plugins
GET                    /api/admin/plugins/registry        Plugin UI registry
GET                    /api/admin/plugins/:name           Plugin detail
PATCH                  /api/admin/plugins/:name/settings  Update plugin settings
POST                   /api/admin/plugins/:name/enable    Enable plugin
POST                   /api/admin/plugins/:name/disable   Disable plugin
DELETE                 /api/admin/plugins/:name           Uninstall plugin
```

### Updates

```
GET                    /api/admin/updates/check           Check for CMS updates
POST                   /api/admin/updates/refresh         Force fresh update check
POST                   /api/admin/updates/dismiss         Dismiss notification (7 days)
```

### Backups — [docs](deployment.md)

```
GET/POST               /api/admin/backups
GET                    /api/admin/backups/:filename
```
