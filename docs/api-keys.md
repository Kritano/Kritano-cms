# API keys

API keys provide authenticated access to the CMS API for headless frontends, the MCP server, and external integrations — without requiring a user login.

## Creating an API key

Navigate to **System → Site** (or your admin settings area). API key management requires the `settings` permission.

```
POST /api/admin/api-keys
```

```json
{
  "name": "Frontend build",
  "permissions": ["content:read", "media:read"],
  "expiresAt": null
}
```

The response includes the full API key **exactly once**. It is never stored or retrievable again:

```json
{
  "data": {
    "id": "key-uuid",
    "name": "Frontend build",
    "key": "cms_live_a1b2c3d4e5f6...",
    "key_prefix": "cms_live_a1b2c3d"
  }
}
```

Store the key securely. The admin only shows the prefix for identification.

## Using an API key

Include the key as a Bearer token:

```bash
curl https://mysite.com/api/article \
  -H "Authorization: Bearer cms_live_a1b2c3d4e5f6..."
```

The auth middleware detects the `cms_live_` prefix and routes to API key verification automatically. JWT tokens continue to work alongside API keys.

## Scopes

| Scope | Allows |
|---|---|
| `content:read` | Read published and draft content |
| `content:write` | Create and update documents |
| `content:publish` | Publish and unpublish documents |
| `media:read` | List and read media files |
| `media:write` | Upload media |
| `schema:read` | Read collection schemas (needed for MCP) |

A key with `content:read` cannot create or publish documents. Scope enforcement returns 403 with a clear message.

## Key format

```
cms_live_ + 64 hex characters (32 random bytes)
```

Only a bcrypt hash of the key is stored in the database. The `key_prefix` (first 16 characters) is stored for identification and lookup.

## Expiry

Keys can optionally have an `expiresAt` date. Expired keys are silently rejected. Keys with no expiry never expire.

## Revoking a key

```
DELETE /api/admin/api-keys/:id
```

Revoked keys are immediately rejected on the next request.

## API endpoints

```
GET    /api/admin/api-keys          List keys (prefix + metadata only)
POST   /api/admin/api-keys          Create key (returns full key once)
DELETE /api/admin/api-keys/:id      Revoke key
```
