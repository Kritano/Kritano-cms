# Kritano CMS — API Surface

## Authentication
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/auth/login` | POST | No | Email + password → JWT + refresh token |
| `/api/auth/refresh` | POST | No | Refresh token → new JWT + refresh token |
| `/api/auth/logout` | POST | Yes | Invalidate session (client-side for v0.1) |
| `/api/auth/me` | GET | Yes | Current user profile |

## Collection Routes (auto-generated per collection)
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/:collection` | GET | Optional | List — paginated, filterable, sortable. Public sees published only |
| `/api/:collection/:id` | GET | Optional | Single by ID. Public sees published only |
| `/api/:collection/slug/:slug` | GET | Optional | Single by slug. Public sees published only |
| `/api/:collection` | POST | Yes | Create document (status: draft) |
| `/api/:collection/:id` | PUT | Yes | Full update |
| `/api/:collection/:id` | PATCH | Yes | Partial update |
| `/api/:collection/:id` | DELETE | Yes | Delete document |
| `/api/:collection/:id/publish` | POST | Yes | Set status=published, publishedAt=now() |
| `/api/:collection/:id/unpublish` | POST | Yes | Set status=draft, publishedAt=null |

### List Query Params
- `?page=1&limit=20` — pagination (max 100)
- `?status=published` — filter by status
- `?sort=publishedAt&order=desc` — sorting (field name, asc/desc)
- `?search=keyword` — basic title ILIKE search

## Media
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/media/upload` | POST | Yes | Multipart upload. Auto WebP + thumbnail via Sharp |
| `/api/media` | GET | Yes | List all media, paginated |
| `/api/media/:id` | PATCH | Yes | Update alt text |
| `/api/media/:id` | DELETE | Yes | Delete file + record |

## System
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/health` | GET | No | `{ ok: true, version: "0.1.0" }` |
| `/api/sitemap.xml` | GET | No | Auto-generated XML sitemap of published content |

## Kritano
| Route | Method | Auth | Description |
|---|---|---|---|
| `/api/kritano/webhook` | POST | No | Receives audit.completed events from Kritano |
| `/api/kritano/status` | GET | No | Connection state + latest scores |

## GraphQL
| Route | Method | Description |
|---|---|---|
| `/api/graphql` | GET/POST | GraphQL Yoga endpoint. Schema auto-derived from collections |

### Generated Query Types
Per collection (e.g., `article`):
- `article(id: ID!): Article`
- `articleBySlug(slug: String!): Article`
- `articleList(page: Int, limit: Int, status: String, sort: String, order: String): ArticleList`

## Response Shapes

### Success (single)
```json
{ "data": { ... } }
```

### Success (list)
```json
{ "data": [...], "total": 42, "page": 1, "limit": 20, "totalPages": 3 }
```

### Error
```json
{ "error": { "code": "NOT_FOUND", "message": "Document not found" } }
```

### Error Codes
- `UNAUTHORIZED` — Missing/invalid JWT
- `NOT_FOUND` — Resource not found
- `VALIDATION` — Invalid input
- `INTERNAL_ERROR` — Server error
