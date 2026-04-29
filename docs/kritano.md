# Kritano integration

Kritano CMS includes built-in integration with [Kritano](https://kritano.com), a site health platform that provides SEO auditing, accessibility scoring, and performance monitoring. The integration is optional — the CMS works fully without it.

## What Kritano provides

When connected, the Kritano panel in the admin shows:

- **Overall score** — combined site health rating
- **SEO score** — search engine optimisation assessment
- **Accessibility score** — WCAG compliance rating
- **Performance score** — page speed and loading metrics
- **AI Visibility score** — how well your site performs in AI search (requires Kritano Pro)

Scores are colour-coded: green (80+), amber (50–79), red (below 50).

## Connecting your account

### From the admin UI

1. Open the admin and click **Site** in the sidebar.
2. Scroll to the Kritano panel.
3. If not connected, you'll see:

```
Unlock SEO auditing, accessibility scoring and AI visibility

Powered by Kritano — the site health platform built into this CMS.
Connect your free account to see your site health score here
and get inline SEO suggestions as you write.

[Create free account]  [Connect existing account]
```

4. Click one of the buttons:
   - **Create free account** — enter your email and password to create a new Kritano account
   - **Connect existing account** — enter your existing Kritano credentials

5. On successful connection:
   - Your Kritano API token is stored encrypted in the site settings
   - Your site is registered with Kritano (site name, domain, source: `cms`)
   - The panel updates to show your health scores

### What happens on connection

1. Your credentials are sent to the Kritano API.
2. A connection token is returned and stored in the CMS site settings table.
3. The CMS registers your site with Kritano, sending the site name, domain, and `source: 'cms'`.
4. Kritano returns a `site_id` which is stored for future API calls.
5. The panel switches to the connected state and displays your scores.

## Viewing health scores

Once connected, the Kritano panel shows:

```
● Connected to Kritano                    [Open Kritano Dashboard ↗]

Site Health Score
┌─────────┬─────────────┬───────────────┬────────────┐
│ Overall │ SEO         │ Accessibility │ Performance│
│   78    │    82       │      71       │     89     │
└─────────┴─────────────┴───────────────┴────────────┘

Last audit: 2 hours ago    [Run audit now]

AI Visibility Score — Upgrade to Kritano Pro to unlock
```

- Click **Open Kritano Dashboard** to view the full audit report on the Kritano platform.
- Click **Run audit now** to trigger a fresh audit.

## Webhook updates

When Kritano completes an audit, it sends a webhook to your CMS:

```
POST /api/kritano/webhook
```

The webhook payload includes:

```json
{
  "event": "audit.completed",
  "site_id": "your-site-id",
  "scores": {
    "overall": 78,
    "seo": 82,
    "accessibility": 71,
    "performance": 89,
    "ai_visibility": null
  },
  "audit_id": "audit-uuid",
  "completed_at": "2026-04-28T10:00:00.000Z"
}
```

The CMS stores the updated scores in the site settings table. The admin panel reflects the new scores without a page refresh — TanStack Query automatically invalidates and refetches the data.

## Checking connection status

You can check the Kritano connection status via the API:

```bash
curl http://localhost:3000/api/kritano/status
```

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
    "audit_id": "audit-uuid",
    "completed_at": "2026-04-28T10:00:00.000Z"
  }
}
```

If not connected:

```json
{
  "connected": false,
  "scores": null,
  "lastAudit": null
}
```

## Without Kritano

The CMS works fully without a Kritano account. The only difference is:

- The Site page shows the connection prompt instead of health scores.
- No SEO audit data is available in the admin.
- All other CMS features (editing, publishing, API, media, themes) are unaffected.

You can connect Kritano at any time — there is no setup penalty for connecting later.
