# Forms

Kritano CMS includes a visual form builder with zero-JavaScript rendering on Astro sites, a progressive enhancement option, and a third-party embed script.

## Rendering contexts

| Context | Rendering | JavaScript required |
|---|---|---|
| Astro (default frontend) | Server-side rendered HTML at build time | None |
| Non-Astro headless frontend | Developer uses `@cms/sdk` to fetch schema and render | Developer's choice |
| Third-party site (not CMS) | Embed script as progressive enhancement | Async, non-blocking, < 5kb |

**Forms on CMS-built Astro sites ship zero JavaScript.**

## Form builder

Navigate to **Forms → New form** in the admin. The builder has three panels:

- **Field palette** (left) — drag to add: Text, Email, Phone, Textarea, Select, Checkbox, File, Date
- **Form canvas** (centre) — reorder fields by dragging, click to select
- **Field settings** (right) — label, name, placeholder, required toggle, help text, type-specific options

### Form settings tab

- Submit button label
- Notification email (receives an email on each submission)
- Success message (displayed after submit)
- Redirect URL (optional — overrides success message)
- Honeypot spam protection (always enabled)

## Astro rendering (zero JS)

Use the built-in `<Form>` component:

```astro
---
import { Form } from '@cms/astro'
const submitted = Astro.url.searchParams.get('submitted')
const error = Astro.url.searchParams.get('error')
---

{submitted && <p class="success">Thanks! We'll be in touch.</p>}
{error && <p class="error">{Astro.url.searchParams.get('message')}</p>}

<Form formSlug="contact" />
```

This renders as plain HTML `<form>` at build time. No JavaScript is loaded. The form submits via standard POST and redirects back with query parameters for success or error.

### How submission works (no JS)

1. The form POSTs to `/api/forms/:slug/submit`
2. Server validates all fields
3. Checks honeypot — if filled, silently discards and redirects to success
4. On success: 302 redirect to `?submitted=true` (or configured redirect URL)
5. On validation error: 302 redirect to `?error=field_name&message=...`

### Optional inline validation

For sites that want client-side validation without a full page reload:

```astro
<Form formSlug="contact" enhance={true} />
```

This adds a single `<script defer>` tag (under 5kb gzipped) that:
- Intercepts form submit
- Validates required fields and email format client-side
- Shows inline error messages
- Falls back to standard POST if JS is unavailable

## SDK usage (headless frontends)

For Next.js, Nuxt, SvelteKit, or other frameworks:

```typescript
import { CMSClient } from '@cms/sdk'

const cms = new CMSClient({ url: 'https://mysite.com', apiKey: 'cms_live_...' })
const form = await cms.collection('forms').findOne({ slug: 'contact' })

// Render form.fields using your framework's components
// Submit to POST /api/forms/contact/submit
```

## Third-party embed

For embedding a form on a site you don't control (WordPress, Webflow, static HTML):

```html
<div data-cms-form="contact"></div>
<script src="https://mysite.com/api/forms/embed.js" async></script>
```

**This loads JavaScript on the host page.** Use only when the `<Form>` component is not available. The script is:
- Loaded `async` — never blocks the host page
- Under 5kb gzipped
- Renders after `load` event — LCP and FCP unaffected
- Renders semantic HTML (same as Astro component)

The embed snippet is shown on each form's **Embed** tab in the admin, with a clear distinction between the Astro component and the third-party embed.

## Submissions

View submissions at **Forms → [form name] → Submissions**:

- Table showing date and field summary
- Click a row to see full submission detail in a slide-out panel
- Filter by date range
- Export as CSV
- Delete individual submissions

## Field types

| Type | Config options |
|---|---|
| text | label, placeholder, required, min/max length |
| email | label, placeholder, required |
| phone | label, placeholder, required |
| textarea | label, placeholder, required, rows |
| select | label, options (add/remove), required |
| checkbox | label, required |
| file | label, accepted types, max size, required |
| date | label, required |

## API endpoints

```
Admin:
GET    /api/admin/forms                    List forms
POST   /api/admin/forms                    Create form
GET    /api/admin/forms/:id                Get form
PUT    /api/admin/forms/:id                Update form
DELETE /api/admin/forms/:id                Delete form
GET    /api/admin/forms/:id/submissions    List submissions (paginated)
GET    /api/admin/forms/:id/export         CSV export
DELETE /api/admin/forms/:id/submissions/:subId  Delete submission

Public:
GET    /api/forms/:slug                    Get form schema
POST   /api/forms/:slug/submit             Submit form (redirect response)
GET    /api/forms/embed.js                 Third-party embed script
GET    /api/forms/enhance.js               Progressive enhancement script
```
