# Webhooks

Kritano CMS supports outbound webhooks — when content events occur, the CMS sends a POST request to your configured endpoints.

## Creating a webhook

Navigate to **System → Webhooks → Add webhook**. Configure:

- **Name** — a label for your reference (e.g. "Deploy trigger")
- **URL** — the endpoint to POST to
- **Secret** (optional) — HMAC signing secret for payload verification
- **Events** — which events trigger this webhook

## Available events

| Event | When it fires |
|---|---|
| `content.created` | A new document is created |
| `content.updated` | A document is updated |
| `content.published` | A document is published |
| `content.unpublished` | A document is unpublished |
| `content.deleted` | A document is deleted |
| `media.uploaded` | A media file is uploaded |
| `media.deleted` | A media file is deleted |
| `form.submitted` | A form submission is received |
| `user.created` | A new user joins via invitation |

## Payload format

```json
{
  "event": "content.published",
  "timestamp": "2025-06-01T12:00:00Z",
  "site": "https://mysite.com",
  "data": {
    "id": "abc-123",
    "collection": "article",
    "document": { "title": "My Article", "slug": "my-article", "..." }
  }
}
```

## HMAC signing

If you configure a secret, every delivery includes an `X-CMS-Signature` header:

```
X-CMS-Signature: sha256=a1b2c3d4e5f6...
```

To verify the signature in your endpoint:

```javascript
const crypto = require('crypto')
const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex')
const valid = signature === `sha256=${expected}`
```

## Retry logic

- Deliveries that fail (non-2xx or network error) are retried with exponential backoff
- Retry schedule: 1 minute, 5 minutes, 30 minutes, 2 hours, 8 hours (5 attempts total)
- After 5 permanent failures: delivery is marked as permanently failed
- After 10 consecutive permanent failures: the webhook is automatically disabled

## Delivery log

Each webhook has a delivery log accessible by clicking the webhook in the admin. Every attempt is recorded with:

- Event name
- HTTP response code (or "error" for network failures)
- Response body (truncated to 1,000 characters)
- Duration in milliseconds
- Attempt number

Click a delivery entry to expand and see the full request payload and response body.

## Test delivery

Click **Test** on any webhook to send a test payload immediately. The result (status code, duration) is shown inline.

## API endpoints

```
GET    /api/admin/webhooks                  List webhooks
POST   /api/admin/webhooks                  Create webhook
GET    /api/admin/webhooks/:id              Get webhook
PUT    /api/admin/webhooks/:id              Update webhook
DELETE /api/admin/webhooks/:id              Delete webhook
GET    /api/admin/webhooks/:id/deliveries   Delivery log (paginated)
POST   /api/admin/webhooks/:id/test         Send test delivery
```
