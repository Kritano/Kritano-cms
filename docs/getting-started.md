# Getting Started

Kritano CMS is a schema-first content management system. You define your content types in code, and the CMS generates the database, API, admin UI, and frontend from that definition.

## Not a developer?

If you'd rather skip the terminal entirely, the browser installer gets you running with one command on your server.

[Browser installer guide](./installation.md#browser-installer)

---

## Prerequisites

- [Bun](https://bun.sh) — install with `curl -fsSL https://bun.sh/install | bash`
- [Docker Desktop](https://docker.com/products/docker-desktop) — must be running before you start

## Install

```bash
bun install -g @kritano/cms
cms create my-site
cd my-site
bun run dev
```

That's it. Three commands to a running site.

`cms create` scaffolds a new project, installs the CMS as a dependency, generates secure secrets, sets up the database, and seeds sample content. Your site is ready at:

- **Admin** — http://localhost:3006/admin
- **Site** — http://localhost:3006

Login: `admin@cms.local` / `admin` — change this immediately.

### Without global install

```bash
bunx @kritano/create-cms my-site
cd my-site
bun run dev
```

### Starter templates

```bash
cms create my-site --starter default     # Pages + articles (clean slate)
cms create my-site --starter blog        # Blog with categories, tags, authors
cms create my-site --starter portfolio   # Projects, case studies, about
cms create my-site --starter business    # Pages, blog, team, services, testimonials
```

Run `cms create my-site` without `--starter` for an interactive prompt.

## Start

```bash
bun run dev
```

This starts PostgreSQL and Redis via Docker Compose, runs migrations, and launches the API server, admin UI, and frontend through a single proxy at **http://localhost:3006**.

## What you have

```
my-site/
├── cms.config.ts       ← Your content schema — the main file you edit
├── package.json        ← @kritano/cms as a versioned dependency
├── .env                ← Environment config (never committed)
├── .gitignore
├── bun.lock            ← Commit this — it pins your CMS version
├── migrations/         ← Auto-generated SQL — commit these
├── media/              ← Uploaded files (not committed)
└── themes/             ← Custom theme (optional)
```

The CMS lives entirely inside `node_modules/@kritano/cms`. Your files are 100% yours — a CMS update never touches your schema, theme, or content.

## Customise your content types

Open `cms.config.ts`. This is the source of truth for your content model:

```typescript
import {
  defineConfig, defineCollection,
  text, slug, richText, select, media, seoBlock
} from '@kritano/cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'https://example.com',
    language: 'en',
  },
  collections: [
    defineCollection('article', {
      fields: {
        title:  text().required(),
        slug:   slug().from('title'),
        body:   richText(),
        image:  media(),
        status: select(['draft', 'published']).default('draft'),
        seo:    seoBlock(),
      },
    }),
  ],
})
```

Save the file and `bun run dev` automatically applies migrations and regenerates types.

## All field types

| Field | Usage | Description |
|-------|-------|-------------|
| `text()` | `text().required().min(3)` | Single-line text |
| `textarea()` | `textarea().maxLength(300)` | Multi-line text |
| `richText()` | `richText()` | Visual/Markdown/Split editor |
| `slug()` | `slug().from('title')` | URL slug, auto-generates |
| `url()` | `url().nullable()` | URL field |
| `number()` | `number().min(0).integer()` | Numeric value |
| `boolean()` | `boolean().default(false)` | True/false toggle |
| `datetime()` | `datetime().nullable()` | Date and time picker |
| `select()` | `select(['a', 'b'])` | Single select |
| `multiSelect()` | `multiSelect(['a', 'b'])` | Multiple select |
| `media()` | `media()` | Image/file upload |
| `relation()` | `relation('author')` | Link to another collection |
| `array()` | `array(text())` | Array of any field type |
| `colour()` | `colour()` | Colour picker |
| `blocks()` | `blocks([block('hero', {...})])` | Flexible content blocks |
| `seoBlock()` | `seoBlock()` | SEO meta fields |

All fields are chainable: `text().required().min(3).max(100)`

## Page builder blocks

```typescript
content: blocks([
  block('hero', {
    heading: text().required(),
    subheading: text(),
    image: media(),
    ctaUrl: url(),
  }),
  block('text-block', {
    body: richText(),
  }),
])
```

## Build your theme

The default theme works out of the box. To customise, create a theme directory and register it in `cms.config.ts`. See [Themes](themes.md) for the full guide.

## Use the API from any frontend

```typescript
import { CMSClient } from '@kritano/cms/sdk'

const cms = new CMSClient({ url: 'https://mysite.com/api' })

const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
})

const article = await cms.collection('article').findOne({
  where: { slug: 'hello-world' },
})
```

## Connect Kritano

Free site health scoring — SEO, accessibility, performance, and AI visibility. Connect from **Admin → Site Health**.

## Deploy to a live server

Go to **Admin → Deployment → Setup**, fill in your server details, and generate a setup script. See [Deployment](deployment.md).

## Auto-deploy on push

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
            bun install && bun run migrate && bun run build
            systemctl restart cms-api cms-worker
```

## Keeping up to date

```bash
bun update @kritano/cms
bun run migrate
bun run dev                # test locally
git add bun.lock && git commit -m "chore: update cms"
git push
```

The admin shows a notification when updates are available at **Deployment → Updates**.

## Day-to-day workflow

1. Edit `cms.config.ts` to add or change collections
2. Run `bun run dev` — migrations and types auto-update
3. Create content in the admin
4. Push to deploy

## What's running locally

| Port | Service |
|------|---------|
| 3005 | API server (REST + GraphQL) |
| 3006 | Proxy — admin at `/admin`, frontend at `/` |

## Troubleshooting

**Docker not running:** Make sure Docker Desktop is open before running `bun run dev`.

**Port already in use:** Set `PORT=3010 DEV_PORT=3011` in `.env`.

**Migrations failed:** Run `bun run migrate` manually. To reset: `docker compose down -v` and restart.

**"Cannot find module":** Run `bun install`.

## Next steps

- [Installation paths](installation.md) — developer, browser installer, manual
- [Updating](updating.md) — keeping the CMS up to date
- [Collections](collections.md) — field types and schema DSL
- [Editor](editor.md) — visual, markdown, and split modes
- [API reference](api.md) — REST and GraphQL
- [Themes](themes.md) — build an Astro theme
- [Deployment](deployment.md) — deploy to production
- [Plugins](plugins/using-plugins.md) — extend the CMS
- [Search](search.md) — full-text search
- [OAuth](oauth.md) — Google and GitHub login
- [Live preview](preview.md) — preview drafts
