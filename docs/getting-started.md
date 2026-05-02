# Getting Started

Set up a new site using Kritano CMS.

---

## Prerequisites

- [Bun](https://bun.sh) — install with `curl -fsSL https://bun.sh/install | bash`
- [Docker Desktop](https://docker.com/products/docker-desktop) — must be running before you start

---

## Quick start

### 1. Create your project

```bash
mkdir my-site && cd my-site
git init
```

### 2. Create `package.json`

```json
{
  "name": "my-site",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "cms dev",
    "build": "cms build",
    "migrate": "cms migrate",
    "generate": "cms generate"
  },
  "dependencies": {
    "@kritano/cms": "github:Kritano/Kritano-cms#main"
  }
}
```

### 3. Create `cms.config.ts`

This is the source of truth for your content model. Define your collections here:

```typescript
import {
  defineConfig,
  defineCollection,
  text, slug, richText, textarea,
  select, media, datetime, seoBlock,
} from '@kritano/cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'http://localhost:3006',
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
      },
    }),
    defineCollection('article', {
      fields: {
        title:         text().required(),
        slug:          slug().from('title'),
        body:          richText(),
        excerpt:       textarea().maxLength(300),
        featuredImage: media(),
        publishedAt:   datetime().nullable(),
        status:        select(['draft', 'published']).default('draft'),
        seo:           seoBlock(),
      },
    }),
  ],
})
```

### 4. Create `.env`

```env
DATABASE_URL=postgresql://cms:cms@localhost:5432/cms
REDIS_URL=redis://localhost:6379
JWT_SECRET=CHANGE_ME_run_openssl_rand_base64_32
REFRESH_TOKEN_SECRET=CHANGE_ME_run_openssl_rand_base64_32
SITE_URL=http://localhost:3006
ADMIN_URL=http://localhost:3006/admin
MEDIA_PATH=./media
CMS_UPDATE_CHANNEL=development
```

Generate real secrets:

```bash
openssl rand -base64 32
```

Run that twice — one for `JWT_SECRET`, one for `REFRESH_TOKEN_SECRET`. Paste the output into `.env`.

### 5. Create `.gitignore`

```
node_modules/
dist/
.env
media/
*.local
```

### 6. Install and run

```bash
bun install
bun run dev
```

The CMS handles everything from here:

- Starts Postgres and Redis via Docker Compose
- Runs database migrations from your schema
- Seeds an admin user
- Generates TypeScript types
- Starts the API server, admin UI, and frontend

### 7. Open the admin

Go to **http://localhost:3006/admin**

```
Email:    cms-admin@kritano.com
Password: admin
```

Change this immediately after first login.

---

## What's running

| Service | URL | Description |
|---------|-----|-------------|
| Admin | http://localhost:3006/admin | Content management UI |
| Frontend | http://localhost:3006 | Your site (default theme) |
| API | http://localhost:3005/api | REST API |
| GraphQL | http://localhost:3005/api/graphql | GraphQL endpoint |
| Health | http://localhost:3005/api/health | Health check |

---

## Your project structure

```
my-site/
├── cms.config.ts       ← Your content schema — the main file you edit
├── package.json        ← CMS as a dependency
├── .env                ← Environment config (never commit this)
├── .gitignore
├── bun.lock            ← Commit this — pins your CMS version
├── migrations/         ← Auto-generated SQL (commit these)
├── media/              ← Uploaded files (not committed)
└── node_modules/       ← CMS lives here — never edit
```

Your files are yours. A CMS update (`bun update @kritano/cms`) only changes `node_modules` and `bun.lock` — your schema, theme, and content are never touched.

---

## Available field types

| Field | Import | Example |
|-------|--------|---------|
| `text()` | `text` | `text().required().min(3).max(100)` |
| `textarea()` | `textarea` | `textarea().maxLength(300)` |
| `richText()` | `richText` | `richText()` |
| `slug()` | `slug` | `slug().from('title')` |
| `url()` | `url` | `url().nullable()` |
| `number()` | `number` | `number().min(0).integer()` |
| `boolean()` | `boolean` | `boolean().default(false)` |
| `datetime()` | `datetime` | `datetime().nullable()` |
| `select()` | `select` | `select(['draft', 'published']).default('draft')` |
| `multiSelect()` | `multiSelect` | `multiSelect(['a', 'b', 'c'])` |
| `media()` | `media` | `media()` |
| `relation()` | `relation` | `relation('author')` |
| `array()` | `array` | `array(text())` |
| `colour()` | `colour` | `colour()` |
| `blocks()` | `blocks, block` | See below |
| `seoBlock()` | `seoBlock` | `seoBlock()` |

All fields are chainable: `text().required().min(3).max(100)`

---

## Adding collections

Add a new collection to `cms.config.ts`:

```typescript
defineCollection('project', {
  fields: {
    title:       text().required(),
    slug:        slug().from('title'),
    description: richText(),
    url:         url().nullable(),
    tags:        array(text()),
    images:      array(media()),
    status:      select(['draft', 'published']).default('draft'),
  },
}),
```

Save and run `bun run dev` — the migration runs automatically, the new collection appears in the admin and API.

---

## Using the API

```typescript
import { CMSClient } from '@kritano/cms/sdk'

const cms = new CMSClient({ url: 'http://localhost:3005/api' })

// List published articles
const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  limit: 10,
})

// Get by slug
const article = await cms.collection('article').findOne({
  where: { slug: 'hello-world' },
})
```

Or use REST directly:

```bash
curl http://localhost:3005/api/articles?status=published
curl http://localhost:3005/api/articles/slug/hello-world
```

---

## Updating the CMS

```bash
bun update @kritano/cms
bun run dev                # runs any new migrations automatically
git add bun.lock && git commit -m "chore: update cms"
git push
```

The admin shows a notification at **Deployment → Updates** when a new version is available.

---

## Day-to-day workflow

1. Edit `cms.config.ts` to add or change collections
2. Run `bun run dev` — migrations and types update automatically
3. Create and publish content in the admin
4. Push to deploy

---

## Troubleshooting

**Docker not running:** Docker Desktop must be open before `bun run dev`. The CMS needs Postgres and Redis.

**Port already in use:** Set `PORT=3010` and `DEV_PORT=3011` in `.env`.

**Migrations failed:** Run `bun run migrate` manually. To fully reset: `docker compose down -v` then `bun run dev` again.

**"Cannot find module":** Run `bun install` to ensure dependencies are installed.

**Admin not loading:** Clear browser cache. Check the terminal for errors.

---

## Next steps

- [Installation paths](installation.md) — developer, browser installer, manual
- [Updating](updating.md) — keeping the CMS up to date
- [Collections](collections.md) — all field types and the schema DSL
- [Editor](editor.md) — visual, markdown, and split modes
- [API reference](api.md) — REST and GraphQL documentation
- [Themes](themes.md) — build an Astro theme
- [Deployment](deployment.md) — deploy to a production server
- [Plugins](plugins/using-plugins.md) — extend the CMS
- [Search](search.md) — full-text search with Typesense
- [OAuth](oauth.md) — Google and GitHub login
- [Live preview](preview.md) — preview draft content
