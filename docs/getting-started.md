# Kritano CMS — Getting Started

Start a new site using Kritano CMS as a dependency.

---

## Prerequisites

- [Bun](https://bun.sh) installed
- [Docker Desktop](https://docker.com) installed and running

---

## 1. Create your project

```bash
mkdir my-site && cd my-site
git init
```

## 2. Create `package.json`

```json
{
  "name": "my-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "cms dev",
    "build": "cms build",
    "migrate": "cms migrate"
  },
  "dependencies": {
    "@kritano/cms": "github:Kritano/Kritano-cms#main"
  }
}
```

## 3. Create `cms.config.ts`

Define your content schema. Here's a minimal example:

```typescript
import {
  defineConfig,
  defineCollection,
  text, slug, richText, datetime,
  select, media, seoBlock
} from '@kritano/cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'https://example.com',
    language: 'en',
  },

  collections: [

    defineCollection('page', {
      fields: {
        title:  text().required(),
        slug:   slug().from('title'),
        body:   richText(),
        status: select(['draft', 'published']).default('draft'),
        seo:    seoBlock(),
      }
    }),

    defineCollection('article', {
      fields: {
        title:         text().required(),
        slug:          slug().from('title'),
        body:          richText(),
        featuredImage: media(),
        publishedAt:   datetime().nullable(),
        status:        select(['draft', 'published']).default('draft'),
        seo:           seoBlock(),
      }
    }),

  ]
})
```

Add as many collections as you need. Available field types:

| Field | Import | Description |
|-------|--------|-------------|
| `text()` | `text` | Single-line text |
| `textarea()` | `textarea` | Multi-line text |
| `richText()` | `richText` | Rich text editor |
| `slug()` | `slug` | URL slug, can auto-generate from another field |
| `url()` | `url` | URL field |
| `select()` | `select` | Single select from options |
| `multiSelect()` | `multiSelect` | Multiple select from options |
| `media()` | `media` | Image/file upload |
| `array()` | `array` | Array of any field type |
| `datetime()` | `datetime` | Date and time |
| `boolean()` | `boolean` | True/false |
| `colour()` | `colour` | Colour picker |
| `blocks()` | `blocks, block` | Block-based content |
| `seoBlock()` | `seoBlock` | SEO meta fields (title, description, image) |

## 4. Create `.env`

```env
# Database
DATABASE_URL=postgresql://cms:cms@localhost:5432/cms

# Redis
REDIS_URL=redis://localhost:6379

# Auth
JWT_SECRET=change-me-to-a-random-string-at-least-32-chars
REFRESH_TOKEN_SECRET=change-me-to-another-random-string

# Site
SITE_URL=http://localhost:3006
ADMIN_URL=http://localhost:3006/admin

# Media
MEDIA_PATH=./media

# Update channel
CMS_UPDATE_CHANNEL=development
```

Generate real secrets:

```bash
openssl rand -base64 32  # run twice, one for each secret
```

## 5. Create `.gitignore`

```
node_modules/
dist/
.env
media/
*.local
```

## 6. Install and run

```bash
bun install
bun run dev
```

The CMS handles everything:

- Starts Postgres and Redis via Docker Compose
- Runs database migrations from your schema
- Generates TypeScript types for your collections
- Starts the API server
- Starts the admin UI
- Starts the frontend (default theme)

## 7. Open the admin

Go to [http://localhost:3006/admin](http://localhost:3006/admin)

Login: `admin@cms.local` / `admin` — change this immediately.

---

## What's running

| Service | URL | Description |
|---------|-----|-------------|
| Admin | `http://localhost:3006/admin` | Content management UI |
| Frontend | `http://localhost:3006` | Your site (default theme) |
| API | `http://localhost:3005/api` | REST API |
| GraphQL | `http://localhost:3005/api/graphql` | GraphQL endpoint |
| Health | `http://localhost:3005/api/health` | Health check |

---

## Adding a custom theme

Optional. The default theme works out of the box. When you're ready to customise the frontend, create a theme:

```
themes/my-theme/
├── theme.config.ts
├── layouts/
│   └── Base.astro
├── components/
├── templates/
│   ├── page.astro
│   └── article.astro
├── pages/
│   ├── index.astro
│   └── 404.astro
└── styles/
    └── global.css
```

Register it in `cms.config.ts`:

```typescript
export default defineConfig({
  theme: './themes/my-theme',
  // ...
})
```

Define the theme:

```typescript
// themes/my-theme/theme.config.ts
import { defineTheme } from '@kritano/cms/astro'

export default defineTheme({
  name: 'my-theme',
  version: '1.0.0',
  templates: {
    page:    './templates/page.astro',
    article: './templates/article.astro',
  },
  settings: {
    siteName: { type: 'text', label: 'Site Name', default: 'My Site' },
  }
})
```

---

## Project structure

```
my-site/
├── cms.config.ts       ← Your content schema
├── package.json        ← CMS as a dependency
├── .env                ← Environment config (not committed)
├── .gitignore
├── bun.lock
├── migrations/         ← Auto-generated, commit these
├── media/              ← Uploaded files (not committed)
└── themes/             ← Custom theme (optional)
```

---

## Day-to-day workflow

**Add a new collection:**
1. Add it to `cms.config.ts`
2. Run `bun run dev` — migrations and types auto-update
3. Create content in the admin
4. Add a template in your theme (if using a custom theme)

**Update the CMS:**
```bash
bun update @kritano/cms
bun run dev
```

---

## Deployment

Go to **Admin → Deployment → Setup**, fill in your server details, and click **Generate Script**. Run the generated script on your server.

For auto-deploy on push, add a GitHub Action:

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: appleboy/ssh-action@v1
        with:
          host: ${{ secrets.SERVER_IP }}
          username: root
          key: ${{ secrets.SSH_KEY }}
          script: |
            cd /var/my-site
            git pull origin main
            bun install
            bun run migrate
            bun run build
            systemctl restart cms-api cms-worker
```

Add `SERVER_IP` and `SSH_KEY` as GitHub secrets.

---

## Next steps

- [Collections](collections.md) — learn all 16 field types and the schema DSL
- [Editor](editor.md) — visual, markdown, and split editor modes
- [API reference](api.md) — full REST and GraphQL documentation
- [Themes](themes.md) — build an Astro theme for your frontend
- [Deployment](deployment.md) — deploy to a production server
- [Plugins](plugins/using-plugins.md) — extend the CMS with plugins
- [Search](search.md) — full-text search with Typesense
- [OAuth](oauth.md) — Google and GitHub login
- [Live preview](preview.md) — preview draft content on your site
- [Kritano integration](kritano.md) — site health scoring
- [Users and roles](users-and-roles.md) — team management, permissions, 2FA
- [Revision history](revisions.md) — document versioning and restore
- [Scheduled publishing](scheduling.md) — publish at a future date
- [Forms](forms.md) — form builder with zero-JS rendering
- [Redirects](redirects.md) — URL redirect management
- [Webhooks](webhooks.md) — outbound event notifications
- [API keys](api-keys.md) — headless API authentication
- [MCP server](mcp.md) — connect AI assistants to your CMS
