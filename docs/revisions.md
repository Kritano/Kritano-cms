# Revision history

Every document save in Kritano CMS automatically creates a revision — a full snapshot of the document's state before the change was applied. This gives you a complete audit trail and the ability to restore any previous version.

## How it works

- A revision is created on every PUT, PATCH, publish, and unpublish
- Each document stores up to **50 revisions** (oldest are pruned automatically)
- Revisions include the full document data as JSON, the timestamp, and who made the change

## Viewing revisions

Open any document in the editor and click the **History** tab in the right sidebar. You'll see a list of revisions sorted newest first, each showing:

- Date and time
- Author name
- A "Latest" badge on the most recent revision

Click the **eye icon** on any revision to preview its content inline.

## Restoring a revision

1. Click the **restore icon** on the revision you want to restore
2. Confirm the action — the current document state is saved as a new revision first, so **restore is never destructive**
3. The document content is replaced with the revision data

## API endpoints

```
GET    /api/:collection/:id/revisions           List revisions (newest first, max 50)
GET    /api/:collection/:id/revisions/:revId    Get full revision data
POST   /api/:collection/:id/revisions/:revId/restore   Restore document to this revision
```

### Example: list revisions

```bash
curl https://mysite.com/api/article/abc-123/revisions \
  -H "Authorization: Bearer <token>"
```

```json
{
  "data": [
    {
      "id": "rev-1",
      "createdAt": "2025-06-01T12:00:00Z",
      "createdBy": { "id": "user-1", "name": "Chris" },
      "label": "Latest revision"
    },
    {
      "id": "rev-2",
      "createdAt": "2025-06-01T11:30:00Z",
      "createdBy": { "id": "user-1", "name": "Chris" },
      "label": "Saved"
    }
  ]
}
```
