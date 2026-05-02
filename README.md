# Kritano CMS

A schema-first, open source CMS built for developers who want TypeScript end-to-end, and content teams who want an editor that feels like Notion. Built by [Kritano](https://kritano.com).

[![MIT License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![Built with Bun](https://img.shields.io/badge/runtime-Bun-f9f1e1.svg)](https://bun.sh)
[![TypeScript](https://img.shields.io/badge/lang-TypeScript-3178c6.svg)](https://typescriptlang.org)
[![Built by Kritano](https://img.shields.io/badge/built%20by-Kritano-c84b2f.svg)](https://kritano.com)

---

## Why?

Every existing CMS is either too rigid, too slow, or built on a stack that makes developers fight the tooling instead of building their site. Kritano CMS is what a CMS looks like when designed today — schema-as-code, zero-JS frontend by default, a block editor that works, and deployment to any server you own.

## Quick start

```bash
git clone https://github.com/kritano/cms.git my-site && cd my-site
cp .env.example .env
bun run packages/cli/src/index.ts dev
```

> Requires [Bun](https://bun.sh) and [Docker Desktop](https://docker.com/products/docker-desktop) running.

That's it. One command starts Postgres, Redis, runs migrations, seeds an admin user, and launches the API + admin UI.

Open **http://localhost:3001/admin** and log in:

```
Email:    cms-admin@kritano.com
Password: admin
```

## How it works

**1. Define your schema in `cms.config.ts`:**

```typescript
import { defineConfig, defineCollection, text, slug, richText, select, seoBlock } from '@cms/core'

export default defineConfig({
  site: { name: 'My Site', domain: 'https://mysite.com', language: 'en' },
  collections: [
    defineCollection('article', {
      fields: {
        title:    text().required(),
        slug:     slug().from('title'),
        body:     richText(),
        status:   select(['draft', 'published']).default('draft'),
        seo:      seoBlock(),
      }
    }),
  ]
})
```

**2. The CMS generates everything from that definition:**

- PostgreSQL tables + migrations
- REST API (`GET /api/articles`, `POST /api/articles`, etc.)
- GraphQL endpoint
- Admin UI with the correct fields and editor
- TypeScript SDK types
- Sitemap

**3. Use the typed SDK from any frontend:**

```typescript
import { CMSClient } from '@cms/sdk'

const cms = new CMSClient({ url: 'https://mysite.com/api' })
const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  limit: 10,
})
```

## Tech stack

| Layer | Technology |
|---|---|
| Runtime | [Bun](https://bun.sh) |
| API | [Hono](https://hono.dev) |
| Database | PostgreSQL + [Drizzle ORM](https://orm.drizzle.team) |
| Admin UI | React 19 + TanStack Router/Query + Tailwind CSS |
| Editor | [TipTap](https://tiptap.dev) (Visual, Markdown, Split modes) |
| Frontend | [Astro](https://astro.build) (zero JS by default) |
| Auth | JWT + OAuth (Google, GitHub) |
| Search | [Typesense](https://typesense.org) (typo-tolerant full-text) |
| Media | [Sharp](https://sharp.pixelplumbing.com) (auto WebP + thumbnails) |
| Content API | REST + [GraphQL Yoga](https://the-guild.dev/graphql/yoga-server) |

## Admin features

- **Collection list** — search, bulk select, bulk publish/unpublish/delete
- **Document editor** — schema-driven fields, three-mode rich text editor (Visual / Markdown / Split), flexible content blocks with drag-to-reorder
- **Revision history** — automatic snapshots on every save, preview and restore any version
- **Scheduled publishing** — publish at a future date/time with timezone support
- **Content calendar** — month view of published and scheduled content across all collections
- **Media library** — folders, drag-and-drop upload, auto WebP conversion, usage tracking
- **Forms builder** — 8 field types, drag-to-reorder, zero-JS rendering on Astro, progressive enhancement, third-party embed
- **Users and roles** — 6 built-in roles, custom roles with per-collection permissions, invitation flow, 2FA
- **Webhooks** — 9 events, HMAC signing, retry with backoff, delivery log
- **Redirects** — 301/302 with hit tracking, chain detection, CSV import/export
- **API keys** — scoped access for headless frontends and integrations
- **MCP server** — connect Claude Desktop or Cursor to manage content via AI
- **Plugin system** — extensible plugin API with hooks, routes, admin UI injection, custom fields, trust tiers, sandboxing
- **Full-text search** — Typesense-powered, auto-synced on publish, Cmd+K in admin, zero-JS Astro component
- **OAuth login** — Google and GitHub alongside email/password, linked accounts management
- **Live preview** — signed preview tokens, draft content rendering, works with any frontend framework
- **Update notifications** — check for new CMS versions, copy-paste update commands
- **Site health** — Kritano integration for SEO, accessibility, and performance scoring
- **Deployment** — setup script with optional Typesense, zero-downtime update script, backup management

## Field types

`text` `textarea` `richText` `slug` `url` `number` `boolean` `datetime` `select` `multiSelect` `media` `relation` `seoBlock` `blocks` `array` `colour`

All fields are chainable: `text().required().min(3).max(100)`

## Documentation

| Topic | Link |
|---|---|
| Getting started | [docs/getting-started.md](docs/getting-started.md) |
| Installation paths | [docs/installation.md](docs/installation.md) |
| Updating | [docs/updating.md](docs/updating.md) |
| Collections & field types | [docs/collections.md](docs/collections.md) |
| Editor modes & blocks | [docs/editor.md](docs/editor.md) |
| REST & GraphQL API | [docs/api.md](docs/api.md) |
| Themes | [docs/themes.md](docs/themes.md) |
| Deployment | [docs/deployment.md](docs/deployment.md) |
| Kritano integration | [docs/kritano.md](docs/kritano.md) |
| Users and roles | [docs/users-and-roles.md](docs/users-and-roles.md) |
| Revision history | [docs/revisions.md](docs/revisions.md) |
| Scheduled publishing | [docs/scheduling.md](docs/scheduling.md) |
| Forms | [docs/forms.md](docs/forms.md) |
| Redirects | [docs/redirects.md](docs/redirects.md) |
| Webhooks | [docs/webhooks.md](docs/webhooks.md) |
| API keys | [docs/api-keys.md](docs/api-keys.md) |
| MCP server | [docs/mcp.md](docs/mcp.md) |
| Plugins | [docs/plugins/using-plugins.md](docs/plugins/using-plugins.md) |
| Building plugins | [docs/plugins/building-plugins.md](docs/plugins/building-plugins.md) |
| Plugin security | [docs/plugins/security.md](docs/plugins/security.md) |
| Search | [docs/search.md](docs/search.md) |
| OAuth | [docs/oauth.md](docs/oauth.md) |
| Live preview | [docs/preview.md](docs/preview.md) |

## Project structure

```
kritano-cms/
├── packages/
│   ├── types/          Shared TypeScript types
│   ├── core/           Schema DSL, database, API server
│   ├── admin/          React admin SPA
│   ├── sdk/            Typed API client
│   ├── astro/          Astro integration
│   └── cli/            CLI commands
├── themes/default/     Default Astro theme
├── cms.config.ts       Schema definition (source of truth)
├── server.ts           API entry point
└── docker-compose.yml  Local Postgres + Redis
```

## Development commands

```bash
bun run packages/cli/src/index.ts dev          # Start everything
bun run packages/cli/src/commands/migrate.ts    # Apply migrations
bun run packages/cli/src/commands/generate.ts   # Regenerate types
cd packages/core && bun test                    # Run tests
cd packages/admin && bun run build              # Build admin
```

## Deployment

The admin includes a deployment page that generates a single bash script for any Linux server (Ubuntu 22.04/24.04, Debian 12). The script installs Bun, PostgreSQL, Redis, nginx, SSL via Let's Encrypt, systemd services, firewall rules, and daily backups.

No Docker in production. No vendor lock-in. You own the server.

See [docs/deployment.md](docs/deployment.md) for the full guide.

## Roadmap

- **v0.1** (current) — Schema-first CMS, admin UI, API, default theme, single-script deployment
- **v0.2** — Roles & permissions, revision history, scheduled publishing, forms, redirects, webhooks
- **v0.3** — Plugin system, real-time collab, full-text search, multi-site, multilingual
- **v1.0** — WordPress migration, newsletter, comments, membership, plugin registry

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md).

## License

MIT. See [LICENSE](LICENSE).

---

Built by [Kritano](https://kritano.com)
