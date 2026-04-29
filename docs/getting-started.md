# Getting started

This guide takes you from zero to a running CMS with content in about 15 minutes.

## Prerequisites

- [Bun](https://bun.sh/) — install with `curl -fsSL https://bun.sh/install | bash`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) — must be running before you start

## Installation

```bash
git clone https://github.com/kritano/cms.git my-site
cd my-site
cp .env.example .env
bun install
```

## Start the dev environment

```bash
bun run packages/cli/src/index.ts dev
```

This single command:

1. Starts PostgreSQL 16 and Redis 7 via Docker Compose
2. Creates and applies database migrations from your schema
3. Seeds an admin user
4. Generates TypeScript types for the SDK
5. Starts the API server on port 3000 (with file watching)
6. Starts the admin UI dev server on port 3001

Once running, you'll see:

```
API       http://localhost:3000
Admin     http://localhost:3001/admin
GraphQL   http://localhost:3000/api/graphql
Health    http://localhost:3000/api/health
```

## Log in to the admin

Open [http://localhost:3001/admin](http://localhost:3001/admin) and log in with:

```
Email:    admin@cms.local
Password: admin
```

You'll see the dashboard with the sidebar listing your collections (Pages, Articles, Projects), Media, Site settings, and Deployment.

## Create your first article

1. Click **Articles** in the sidebar.
2. Click **New document**.
3. Fill in the fields:
   - **Title** — type "Hello World". The slug auto-generates to `hello-world`.
   - **Body** — the rich text editor opens in Visual mode. Type some content, try the formatting toolbar (bold, italic, headings, lists), or switch to Markdown mode with the toolbar toggle.
   - **Excerpt** — a short summary.
   - **Tags** — click "Add item" to add tags.
   - **Featured image** — click "Select media" to open the media picker. Drag an image onto the upload area, then select it.
4. In the right sidebar, click **Publish**.

Your article is now live at `GET http://localhost:3000/api/articles/slug/hello-world`.

## Query the API

With your article published, try these requests:

### List all published articles

```bash
curl http://localhost:3000/api/articles?status=published
```

```json
{
  "data": [
    {
      "id": "abc-123",
      "title": "Hello World",
      "slug": "hello-world",
      "status": "published",
      ...
    }
  ],
  "total": 1,
  "page": 1,
  "limit": 20,
  "totalPages": 1
}
```

### Get a single article by slug

```bash
curl http://localhost:3000/api/articles/slug/hello-world
```

### GraphQL query

```bash
curl -X POST http://localhost:3000/api/graphql \
  -H "Content-Type: application/json" \
  -d '{"query": "{ articleList(status: \"published\") { data { title slug } total } }"}'
```

## Use the SDK

Install the SDK in any frontend project:

```typescript
import { CMSClient } from '@cms/sdk'

const cms = new CMSClient({ url: 'http://localhost:3000/api' })

// List published articles
const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  limit: 10,
})

// Get a single article by slug
const article = await cms.collection('article').findOne({
  where: { slug: 'hello-world' },
})
```

## Create a page with blocks

Pages support flexible content blocks. Try creating one:

1. Click **Pages** in the sidebar.
2. Click **New document**.
3. Fill in the **Title** and note the auto-generated slug.
4. Scroll to the **Content** field — this is the block builder.
5. Click **Add block** and choose **Hero**:
   - Fill in the heading and subheading.
   - Select an image from the media library.
   - Add a CTA label and URL.
6. Click **Add block** again and choose **Text Block**. Write some content in the rich text editor.
7. Drag the grip handle on any block to reorder.
8. Publish the page.

## Edit your schema

Open `cms.config.ts` in your editor. This is the source of truth for your content model. Try adding a new field to the article collection:

```typescript
defineCollection('article', {
  fields: {
    title:         text().required(),
    slug:          slug().from('title'),
    body:          richText(),
    excerpt:       textarea().maxLength(300),
    author:        text(),                    // new field
    tags:          array(text()),
    featuredImage: media(),
    publishedAt:   datetime().nullable(),
    status:        select(['draft', 'published']).default('draft'),
    seo:           seoBlock(),
  },
}),
```

Then generate a migration and apply it:

```bash
bun run packages/cli/src/commands/migrate-create.ts
bun run packages/cli/src/commands/migrate.ts
```

The migration system diffs your schema against the previous snapshot and generates the correct `ALTER TABLE` SQL. The new `author` field will appear in the admin UI and API automatically.

## Environment variables

The `.env` file configures your local environment:

| Variable | Default | Purpose |
|---|---|---|
| `DATABASE_URL` | `postgresql://cms:cms@localhost:5432/cms` | PostgreSQL connection string |
| `REDIS_URL` | `redis://localhost:6379` | Redis connection string |
| `JWT_SECRET` | `change-me-to-a-random-secret` | Secret for signing JWT tokens |
| `MEDIA_PATH` | `./media` | Where uploaded files are stored |
| `SITE_URL` | `http://localhost:4321` | Public URL of the frontend |
| `ADMIN_URL` | `http://localhost:3000/admin` | Admin UI URL (used for CORS) |

## Next steps

- [Collections](collections.md) — learn all 16 field types and the schema DSL
- [Editor](editor.md) — visual, markdown, and split editor modes
- [API reference](api.md) — full REST and GraphQL documentation
- [Themes](themes.md) — build an Astro theme for your frontend
- [Deployment](deployment.md) — deploy to a production server
- [Kritano integration](kritano.md) — site health scoring
