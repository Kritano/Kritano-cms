# Redirects

Kritano CMS includes a redirect manager with server-level redirect enforcement, chain detection, and slug change awareness.

## Creating redirects

Navigate to **System → Redirects** in the admin. Click **Add redirect** to create an inline form row at the top of the table.

| Field | Description |
|---|---|
| From | The old URL path (e.g. `/old-page`) |
| To | The new URL path or full URL (e.g. `/new-page`) |
| Type | 301 (permanent) or 302 (temporary) |

Click a row to edit it inline.

## How redirects work

A Hono middleware checks every incoming non-API request against the redirects table. If a match is found, the server responds with the configured redirect (301 or 302) and increments the hit counter.

## Slug change detection

When you change a document's slug in the editor, the API response includes a `redirectSuggestion`:

```json
{
  "data": { "...updated document..." },
  "redirectSuggestion": {
    "from": "/article/old-title",
    "to": "/article/new-title",
    "type": 301
  }
}
```

The admin UI shows a toast notification prompting you to create the redirect.

## Chain detection

The **check-chains** endpoint scans all redirects and finds chains — where A redirects to B, and B also has a redirect to C. This means a user hitting A would be redirected twice.

The admin shows a warning banner: "3 redirect chains detected" with a **View chains** button. Each chain has a **Fix** button that updates A to point directly to C, eliminating the chain.

## CSV import / export

- **Import:** Click **Import CSV** and paste CSV content in `from_path,to_path,type` format. Duplicates are silently skipped.
- **Export:** Click **Export CSV** to download all redirects.

## API endpoints

```
GET    /api/admin/redirects                 List redirects (paginated, searchable)
POST   /api/admin/redirects                 Create redirect
PUT    /api/admin/redirects/:id             Update redirect
DELETE /api/admin/redirects/:id             Delete redirect
POST   /api/admin/redirects/import          Bulk CSV import
GET    /api/admin/redirects/export          CSV export
POST   /api/admin/redirects/check-chains    Detect redirect chains
```
