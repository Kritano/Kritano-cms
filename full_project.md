# [CMS Name TBD] — Full Blueprint
**Built by Kritano · MIT Licensed · Open Source**
**Docs:** `cms.kritano.com` (placeholder until community name chosen)

---

## Table of Contents

1. [Vision & Principles](#1-vision--principles)
2. [Tech Stack](#2-tech-stack)
3. [Core Architecture](#3-core-architecture)
4. [Repo Structure](#4-repo-structure)
5. [Phase 0.1 — MVP](#5-phase-01--mvp)
6. [Phase 0.2 — Operational Layer](#6-phase-02--operational-layer)
7. [Phase 0.3 — Platform Layer](#7-phase-03--platform-layer)
8. [Phase 1.0 — Ecosystem](#8-phase-10--ecosystem)
9. [Theme System](#9-theme-system)
10. [Frontend Flexibility](#10-frontend-flexibility)
11. [Editor — Modes & Behaviour](#11-editor--modes--behaviour)
12. [Plugin System](#12-plugin-system)
13. [Official Plugins](#13-official-plugins)
14. [Kritano Integration](#14-kritano-integration)
15. [Deployment System](#15-deployment-system)
16. [Documentation Site](#16-documentation-site)

---

## 1. Vision & Principles

A ground-up open source CMS built by Kritano. Not WordPress with a new coat of paint — what a CMS would look like if designed today, by people who have spent years frustrated by every limitation of the existing options.

### Core principles

**Schema-first, everything-derived.** Define a content type once in TypeScript. The CMS generates the database migration, GraphQL type, REST endpoint, admin form UI, TypeScript SDK types, and Zod validation schemas automatically. One source of truth.

**Performance is structural, not aspirational.** The default frontend renderer (Astro) ships zero JS by default. A bad Lighthouse score requires deliberate effort to achieve.

**Frontend agnostic.** The CMS is a headless API first. Astro is the default and recommended frontend — but Next.js, Nuxt, SvelteKit, or any framework can consume the API. The CMS does not dictate the frontend.

**Developer joy.** TypeScript end to end. Hot reload everywhere. A CLI that does real work. No PHP, no hook hell, no global state.

**Content teams feel power, not friction.** The editor should feel as natural as Notion. Marketers and non-technical users should be able to manage their entire site without touching code.

**Ownership without ops burden.** Self-hosted on any Linux server with a single generated script. No mandatory cloud, no vendor lock-in.

**Kritano-native.** SEO, accessibility, AI visibility, and site health are part of the editorial workflow from day one, powered by Kritano.

---

## 2. Tech Stack

| Layer | Technology | Rationale |
|---|---|---|
| Runtime | Bun | 3× faster than Node, native TypeScript, built-in bundler and test runner |
| API Framework | Hono | Fastest TypeScript HTTP framework, minimal, edge-ready |
| Default Frontend | Astro 5 | Zero JS by default, partial hydration, Lighthouse 100 structural |
| Admin UI | React + TanStack Router/Query | Best-in-class SPA DX, fully decoupled from frontend |
| Database | PostgreSQL | Best open-source relational DB, fully owned by the user |
| ORM | Drizzle | TypeScript-native schema-as-code, no magic, no reflection |
| Editor | TipTap + ProseMirror | Block-based, extensible, collaborative-ready |
| Real-time collab | Y.js | Industry standard CRDT (Phase 0.3+) |
| Search | Typesense (self-hosted) | Typo-tolerant, fast, zero external dependency (Phase 0.3+) |
| Auth | Better Auth | TypeScript-first, sessions, OAuth, 2FA, API keys |
| Queue | BullMQ + Redis | Background jobs, retryable, observable |
| Media pipeline | Sharp | On-the-fly transforms, WebP/AVIF auto-conversion |
| Content API | GraphQL Yoga + auto-REST | GraphQL primary, REST auto-derived |
| Process management | systemd | Production-grade, survives reboots, no Docker in production |
| Web server | nginx | SSL termination, reverse proxy, static file serving |
| SSL | Let's Encrypt (certbot) | Automatic certificate provisioning and renewal |
| Local dev | Docker Compose | Local development only — Postgres + Redis + app |

---

## 3. Core Architecture

### 3.1 Monorepo structure

```
[cms-name]/
├── packages/
│   ├── core/           # @cms/core — engine, schema DSL, API
│   ├── admin/          # @cms/admin — React dashboard SPA
│   ├── astro/          # @cms/astro — Astro integration and theme runtime
│   ├── sdk/            # @cms/sdk — typed API client (framework agnostic)
│   ├── cli/            # @cms/cli — dev, migrate, deploy commands
│   └── types/          # @cms/types — shared TypeScript types
├── plugins/
│   ├── wordpress-migration/
│   ├── forms/
│   ├── redirects/
│   └── ...
├── themes/
│   └── default/        # Default theme shipping with v0.1
└── docs/               # Documentation source (Astro)
```

### 3.2 Schema-first content modelling

Every content type is defined in `cms.config.ts` at the project root. From this single definition the CMS generates everything else.

```typescript
// cms.config.ts
import { defineConfig, defineCollection } from '@cms/core'

export default defineConfig({
  site: {
    name: 'My Site',
    domain: 'https://mysite.com',
    language: 'en',
  },
  collections: [
    defineCollection('page', {
      fields: {
        title:         text().required(),
        slug:          slug().from('title'),
        body:          richText(),
        featuredImage: media(),
        status:        select(['draft', 'published']).default('draft'),
        seo:           seoBlock(),
      }
    }),
    defineCollection('article', {
      fields: {
        title:         text().required(),
        slug:          slug().from('title'),
        body:          richText(),
        excerpt:       textarea().maxLength(300),
        author:        relation('user'),
        tags:          array(text()),
        featuredImage: media(),
        publishedAt:   datetime().nullable(),
        status:        select(['draft', 'published']).default('draft'),
        seo:           seoBlock(),
      }
    }),
    defineCollection('project', {
      fields: {
        title:       text().required(),
        slug:        slug().from('title'),
        description: richText(),
        url:         url().nullable(),
        tags:        array(text()),
        images:      array(media()),
        status:      select(['draft', 'published']).default('draft'),
        seo:         seoBlock(),
      }
    }),
  ]
})
```

From this definition the CMS automatically produces:

- PostgreSQL table + migration file per collection
- GraphQL type, queries, and mutations
- REST endpoints: `GET /api/articles`, `POST /api/articles`, etc.
- TypeScript types for the SDK
- Zod validation schemas
- Admin UI form with correct field widgets per type
- Sitemap entries on publish

### 3.3 Field types (v0.1)

| Field | Method | Notes |
|---|---|---|
| Single line text | `text()` | Required, min, max, pattern |
| Long text | `textarea()` | maxLength |
| Rich text | `richText()` | TipTap block editor |
| Slug | `slug()` | Auto-generated, unique enforced |
| URL | `url()` | Validated format |
| Number | `number()` | min, max, integer |
| Boolean | `boolean()` | Toggle in admin |
| Date/time | `datetime()` | Timezone aware |
| Select | `select([...])` | Single select dropdown |
| Multi-select | `multiSelect([...])` | Checkbox group |
| Media | `media()` | Single file |
| Media array | `array(media())` | Multiple files |
| Relation | `relation('collection')` | FK to another collection |
| SEO block | `seoBlock()` | Meta title, description, OG — built-in compound field |

### 3.4 API layer

Hono server on Bun. All routes auto-generated from collection schema.

```
GET    /api/:collection              List (paginated, filterable, sortable)
GET    /api/:collection/:id          Single document
POST   /api/:collection              Create
PUT    /api/:collection/:id          Full update
PATCH  /api/:collection/:id          Partial update
DELETE /api/:collection/:id          Delete
POST   /api/:collection/:id/publish  Publish
POST   /api/:collection/:id/unpublish Unpublish

GET    /api/graphql                  GraphQL endpoint
POST   /api/graphql                  GraphQL mutations

POST   /api/media/upload             Upload file
GET    /api/media                    List media
DELETE /api/media/:id                Delete media file

GET    /api/sitemap.xml              Auto-generated sitemap
```

### 3.5 Admin and frontend separation

The admin UI (`/admin`) and the frontend are completely separate concerns:

- Admin is a React SPA, talks to the API, runs at `/admin`
- Frontend is an Astro site (or any framework), talks to the API, runs at `/`
- They share nothing except the API
- In production both are served by nginx on the same server

---

## 4. Repo Structure

```
github.com/kritano/[cms-name]           # Main monorepo (MIT)
github.com/kritano/[cms-name]-plugins   # Official plugins (MIT)
github.com/kritano/[cms-name]-themes    # Official themes (MIT)
```

All under the Kritano GitHub org. Forge as its own distinct product with its own identity, clearly backed by Kritano.

---

## 5. Phase 0.1 — MVP

**Goal:** The CMS works end to end as a real portfolio site. Schema-defined content types, working editor, media, basic SEO, Kritano connected, deployed on a live server with a theme system in place.

**Done when:** You can log in, define multiple content types in config, create content, upload images, publish, and have it appear live on your portfolio URL — with Kritano showing a site health score.

---

### 5.1 Backend — v0.1

**Schema engine**
- `defineCollection` DSL fully working
- All v0.1 field types implemented (see Section 3.3)
- Auto Postgres table generation from schema
- Drizzle migration runner — `cms migrate` creates and runs migrations
- Schema change detection — adding a field to config creates a new migration automatically

**API**
- Hono server on Bun
- Auto-generated REST CRUD per collection
- GraphQL endpoint (GraphQL Yoga) — schema auto-derived
- JWT authentication on all write endpoints
- Public read endpoints for published content (no auth required)
- Pagination on list endpoints (`?page=1&limit=20`)
- Basic filtering (`?status=published`)
- Basic sorting (`?sort=publishedAt&order=desc`)

**Auth**
- Email + password login
- Single admin user for v0.1 (no roles yet)
- JWT session tokens
- Refresh token rotation
- `/api/auth/login`, `/api/auth/logout`, `/api/auth/me`

**Media**
- `POST /api/media/upload` — multipart form upload
- Sharp pipeline — auto WebP conversion on upload
- Resize on demand via URL params (`?w=800&h=600&format=webp`)
- Local storage to `/var/cms/media/` in production, `./media/` in dev
- nginx serves media files directly (not through Bun)

**Sitemap**
- Auto-generated at `/api/sitemap.xml`
- Includes all published documents across all collections
- Regenerated on every publish/unpublish event

---

### 5.2 Admin UI — v0.1

**Tech:** React, TanStack Router, TanStack Query, Tailwind CSS

**Pages and components required:**

```
/admin/login                    Login screen
/admin                          Dashboard (minimal — recent content, quick create)
/admin/:collection              Collection list view
/admin/:collection/new          New document editor
/admin/:collection/:id          Edit document editor
/admin/media                    Media library
/admin/site                     Site settings (name, domain, language)
/admin/site/health              Kritano site health panel
```

**Collection list view**
- Table: title, status, updated date, author
- Search bar (client-side filter for v0.1)
- New document button
- Click row to edit
- Bulk delete

**Document editor**
- Full-width editor — three modes togglable from toolbar (see Section 11)
- Default mode: Visual (TipTap block editor)
- Markdown mode: raw MD input — paste AI output directly
- Split mode: MD left, live preview right
- Block types for v0.1: paragraph, heading (H1–H4), bold, italic, link, image (from media library), blockquote, code block, unordered list, ordered list, divider
- Slash command (`/`) to insert block types
- Right sidebar with two tabs:
  - **Publish** — status toggle, publish button, timestamps
  - **SEO** — meta title, meta description, OG image picker (from seoBlock field)
- Auto-save to draft every 30 seconds
- Unsaved changes warning on navigate away
- Responsive — usable on a laptop, not broken on a smaller screen

**Media library**
- Grid view of uploaded files
- Upload button (drag and drop + click)
- Click to select (for use in editor image picker)
- Delete with confirmation
- Shows filename, dimensions, file size
- Alt text field on each media item

**Site settings**
- Site name, domain, default language
- Basic branding — logo upload (stored as media)

**Kritano panel**
- Connection state UI (see Section 13)
- Site health score once connected
- Link to full Kritano dashboard

**Design:**
- Clean, minimal, dark sidebar navigation
- High contrast, readable typography
- No visual noise
- Feels fast — every interaction under 200ms perceived latency

---

### 5.3 Frontend / Theme — v0.1

**Default theme ships with v0.1.** Clean, minimal, actually looks good. Suitable as a developer portfolio or simple site out of the box.

Full theme system documented in Section 9.

**Default theme pages:**
- Homepage — configurable hero, recent articles, featured projects
- Page template — full width content
- Article template — article with metadata
- Article list — paginated
- Project template
- Project list
- 404 page

---

### 5.4 CLI — v0.1

```bash
cms dev              # Start local dev (Bun + hot reload + Docker Compose for Postgres/Redis)
cms migrate          # Run pending migrations
cms migrate:create   # Create blank migration file
cms build            # Build the Astro frontend
cms generate         # Regenerate types and schema from config (run after config changes)
```

---

### 5.5 Local development — v0.1

`cms dev` spins up:
- Bun API server with hot reload on `localhost:3000`
- Astro dev server with hot reload on `localhost:4321`
- Docker Compose: Postgres on `5432`, Redis on `6379`
- Admin UI served from the API server at `localhost:3000/admin`

`.env` file for local config:
```
DATABASE_URL=postgresql://cms:cms@localhost:5432/cms
REDIS_URL=redis://localhost:6379
JWT_SECRET=your-secret-here
MEDIA_PATH=./media
SITE_URL=http://localhost:4321
ADMIN_URL=http://localhost:3000/admin
```

---

### 5.6 Deployment — v0.1

Single generated bash script. Full detail in Section 14.

For v0.1 the deployment UI in admin is a single page:

- Server IP field
- SSH user field
- Domain field
- Email field (Let's Encrypt)
- OS selector (Ubuntu 22.04 / Ubuntu 24.04)
- Generate Script button → copies script to clipboard

The generated script installs everything from scratch on a clean server and starts the CMS. One copy, one paste, one run.

---

### 5.7 Kritano integration — v0.1

Full detail in Section 13. For v0.1 this means:

- Kritano panel in admin sidebar
- Connection flow (create account / connect existing)
- Site auto-created on Kritano on connection
- Site health score shown in admin
- Basic SEO suggestions in editor sidebar (on demand, not live)

---

### 5.8 v0.1 explicitly excludes

These are not in scope. Do not build them. Do not stub them. Add a GitHub issue for each and move on.

- User roles and permissions (single admin only)
- Multi-site
- Multilingual
- Scheduled publishing
- Revision history
- Real-time collaborative editing
- Forms builder
- Redirects manager
- Webhooks
- Full-text search (Typesense)
- Plugin system
- WordPress migration
- A/B testing
- Newsletter
- Comments
- Membership
- Analytics integration
- Staging environments
- Content calendar view

---

## 6. Phase 0.2 — Operational Layer

**Goal:** The CMS is production-ready for real client sites and agencies.

**Adds:**

**Content operations**
- Revision history — keep last 50 revisions per document, restore any revision
- Scheduled publishing — publish at a future date/time with timezone
- Content locking — prevent two editors overwriting each other
- Duplicate document with one click
- Bulk operations on list view (publish, unpublish, delete)
- Content calendar view — all scheduled and published content across collections

**Users and roles**
- Built-in roles: Super Admin, Admin, Editor, Author, Contributor, Viewer
- Per-collection permissions
- User invitation via email
- Two-factor authentication
- Activity log — who changed what and when

**Forms builder**
- Drag-and-drop field builder
- Field types: text, email, phone, textarea, select, checkbox, file, date
- Submission storage in Postgres
- Email notification on submission
- Spam protection (honeypot)
- CSV export of submissions

**Redirects manager**
- Create/edit/delete 301 and 302 redirects from admin UI
- Bulk import via CSV
- Redirect suggestion when a slug changes
- Redirect chain detection

**Media improvements**
- Folder organisation
- Bulk upload
- Usage tracking (which documents use this file)
- Smart crop with face detection

**Webhooks**
- Configure outbound webhook endpoints in admin UI
- Events: content.created, content.updated, content.published, content.deleted, media.uploaded
- Delivery logs and retry on failure

**Deployment improvements**
- Zero-downtime update script generator
- Backup management UI (view last 5 backups, download, restore)
- Multi-site script generator

---

## 7. Phase 0.3 — Platform Layer

**Goal:** Extensible platform that the community can build on.

**Adds:**

- Plugin system — ESM plugin API (see Section 11)
- Real-time collaborative editing — Y.js integration in TipTap editor
- Full-text search — Typesense integration, auto-sync on publish
- Multi-site support — one install, multiple sites
- Multilingual — per-field translations, side-by-side editing
- API keys management — for headless frontend access
- OAuth login — Google, GitHub
- Live preview protocol — standard handshake for any frontend framework

---

## 8. Phase 1.0 — Ecosystem

**Goal:** Public stable release with a thriving plugin ecosystem.

**Adds:**

- WordPress Migration plugin (full — see Section 12)
- Newsletter plugin
- Comments plugin
- Membership plugin
- Social auto-publish plugin
- A/B testing plugin
- Plugin registry at `plugins.[cms-name].kritano.com`
- Theme registry at `themes.[cms-name].kritano.com`
- Additional starter themes
- Import/export plugin (Ghost, Contentful)
- v1.0 stable release

---

## 9. Theme System

A theme is a self-contained package that owns everything visual and structural about the frontend. The CMS owns the content and the API. The theme owns how that content looks and is structured on the page.

### 9.1 Theme structure

```
my-theme/
├── theme.config.ts        # Theme manifest
├── components/            # Shared Astro/React components
├── layouts/
│   ├── base.astro         # Base HTML layout
│   └── sidebar.astro      # Optional layout variants
├── templates/             # One template per collection type
│   ├── page.astro
│   ├── article.astro
│   ├── article-list.astro
│   ├── project.astro
│   └── project-list.astro
├── pages/
│   ├── index.astro        # Homepage
│   └── 404.astro
├── styles/
│   └── global.css         # CSS custom properties / design tokens
├── public/                # Static assets (fonts, icons)
└── package.json
```

### 9.2 Theme manifest

```typescript
// theme.config.ts
import { defineTheme } from '@cms/astro'

export default defineTheme({
  name: 'my-theme',
  version: '1.0.0',

  // Maps collection names to template files
  templates: {
    page:         './templates/page.astro',
    article:      './templates/article.astro',
    'article-list': './templates/article-list.astro',
    project:      './templates/project.astro',
    'project-list': './templates/project-list.astro',
  },

  // These fields appear in Admin → Appearance
  // Editable by non-developers without touching code
  settings: {
    siteName:      { type: 'text',   label: 'Site Name' },
    logo:          { type: 'media',  label: 'Logo' },
    primaryColour: { type: 'colour', label: 'Primary Colour',  default: '#0d0d0d' },
    accentColour:  { type: 'colour', label: 'Accent Colour',   default: '#c84b2f' },
    fontBody:      { type: 'select', label: 'Body Font',
                     options: ['Inter', 'Fraunces', 'DM Sans'], default: 'Inter' },
    fontDisplay:   { type: 'select', label: 'Display Font',
                     options: ['Inter', 'Bebas Neue', 'Fraunces'], default: 'Inter' },
    footerText:    { type: 'text',   label: 'Footer Text' },
    socialLinks: {
      type: 'group',
      label: 'Social Links',
      fields: {
        twitter:  { type: 'url', label: 'X / Twitter' },
        github:   { type: 'url', label: 'GitHub' },
        linkedin: { type: 'url', label: 'LinkedIn' },
      }
    }
  }
})
```

### 9.3 Using CMS data in a template

```astro
---
// templates/article.astro
import { useCMS } from '@cms/astro'
import BaseLayout from '../layouts/base.astro'

const { doc, settings } = useCMS()
// doc = the article document (fully typed from schema)
// settings = the theme settings values from admin
---

<BaseLayout title={doc.seo.metaTitle || doc.title} settings={settings}>
  <article>
    <h1>{doc.title}</h1>
    {doc.featuredImage && (
      <img src={doc.featuredImage.url} alt={doc.featuredImage.alt} />
    )}
    <div set:html={doc.body.html} />
  </article>
</BaseLayout>
```

### 9.4 Theme installation

**Option A — npm package**
```bash
npm install @cms-theme/minimal
```
Then in `cms.config.ts`:
```typescript
theme: '@cms-theme/minimal'
```

**Option B — local theme**
Drop theme folder into `themes/my-theme/` and reference:
```typescript
theme: './themes/my-theme'
```

### 9.5 Admin Appearance panel

The `settings` object from `theme.config.ts` auto-generates an Appearance section in the admin UI. No code required from the theme developer — the CMS reads the settings schema and renders the correct form fields. A non-developer can change the logo, colours, and fonts without touching any files.

### 9.6 Theme distribution

Community themes published to npm under `@cms-theme/` scope. Listed on the theme registry at `themes.[name].kritano.com`. Each listing shows a live preview, install count, and compatibility version.

---

## 10. Frontend Flexibility

The CMS is a headless API first. Astro is the default and recommended path — but it is not mandatory. Any frontend can consume the API.

### 10.1 Option A — Forge-managed Astro frontend (default)

Install `@cms/astro`, build a theme, the CMS handles the rest. Best for most users.

### 10.2 Option B — Bring your own frontend

Point any framework at the CMS API. The `@cms/sdk` package provides a typed client:

```typescript
// Works in Next.js, Nuxt, SvelteKit, plain JS — anything
import { CMSClient } from '@cms/sdk'

const cms = new CMSClient({
  url: 'https://mycms.com/api',
  apiKey: process.env.CMS_API_KEY,
})

// Fully typed — TypeScript knows the shape of your collections
const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  limit: 10,
})

const page = await cms.collection('page').findOne({
  where: { slug: 'about' }
})
```

The developer deploys their own frontend wherever they want. The CMS just provides the API and admin.

### 10.3 Option C — Static export

Build the Astro frontend to a static `dist/` folder:

```bash
cms build
```

Deploy the output to Cloudflare Pages, Netlify, GitHub Pages, or serve from nginx on the same server. The CMS regenerates and redeploys the static files on each publish event.

### 10.4 Supported frontend frameworks (tested integrations)

| Framework | Integration package | Notes |
|---|---|---|
| Astro | `@cms/astro` | Default, full theme system support |
| Next.js | `@cms/sdk` | Use App Router with ISR/SSG |
| Nuxt | `@cms/sdk` | Use `useFetch` with the SDK |
| SvelteKit | `@cms/sdk` | Works with `load` functions |
| Remix | `@cms/sdk` | Use in loader functions |
| Plain HTML | REST API | No package needed |

---

## 11. Editor — Modes & Behaviour

The editor is one of the most-used surfaces in the entire CMS. It must work equally well for a developer pasting AI-generated markdown, a designer building a rich layout, and a marketer writing a blog post. Three modes, one underlying content model.

### 11.1 Three editor modes

**Visual mode (default)**

TipTap block editor. Slash command (`/`) to insert any block. Drag handles on every block for reordering. This is the default for all users and the mode most non-technical users will live in.

**Markdown mode**

Raw markdown input. The entire document becomes an editable MD file. Designed for:
- Pasting AI-generated content directly — no reformatting needed
- Developers who think and write faster in MD
- Bulk content that arrives as MD from other tools

The MD is parsed and converted to TipTap's internal JSON format on save. Switching back to Visual mode reflects the content correctly.

**Split mode**

Markdown editor on the left, live rendered preview on the right. Updates in real time as you type. Best for power users who want MD speed with visual confidence.

### 11.2 Mode toggle

A three-segment toggle in the editor toolbar — Visual / Markdown / Split. Persists per-user as a preference (stored in local storage). Does not affect the document — all three modes edit the same content.

### 11.3 Storage format

The canonical storage format is always TipTap JSON internally. Markdown is an input and output format, not the storage format. This ensures:

- Custom block types (embeds, callouts, etc.) are not lost when switching modes
- MD that doesn't map to a custom block type is preserved as-is
- Switching modes never causes data loss

### 11.4 Markdown serialisation

Handled by `@tiptap/extension-markdown`. Supports the full CommonMark spec plus GitHub Flavored Markdown (tables, task lists, strikethrough). Custom CMS block types (that have no MD equivalent) are preserved as HTML comments in MD mode and round-trip correctly back to Visual.

### 11.5 AI content workflow

The intended workflow for AI-generated content:

1. Generate content in Claude, ChatGPT, or any AI tool
2. Copy the markdown output
3. Open the document editor, switch to Markdown mode
4. Paste — content appears immediately, correctly structured
5. Switch to Visual mode to make edits, add images, adjust layout
6. Switch to SEO tab, run Kritano analysis
7. Publish

No reformatting step. No copy-paste into individual fields. Paste and go.

---

## 12. Plugin System

Available from Phase 0.3.

Plugins are standard ESM packages published to npm. Installed via CLI or the admin plugin manager.

### 12.1 Plugin API

```typescript
import { definePlugin } from '@cms/core'

export default definePlugin({
  name: 'my-plugin',
  version: '1.0.0',

  setup({ hooks, api, admin, fields, schema }) {

    // Custom field type
    fields.register('colour-picker', ColourPickerComponent)

    // Content lifecycle hook
    hooks.on('content.published', async (doc) => {
      await notifySlack(doc)
    })

    // Additional API route
    api.get('/my-plugin/status', (c) => c.json({ ok: true }))

    // Admin UI section
    admin.registerSection({
      label: 'My Plugin',
      icon: 'puzzle',
      component: MyPluginSettings,
    })

    // Extend GraphQL schema
    schema.extend(`
      type MyPluginData {
        value: String
      }
      extend type Query {
        myPluginData: MyPluginData
      }
    `)
  }
})
```

### 12.2 Plugin installation

```bash
cms plugin:install @cms-plugin/newsletter
cms plugin:list
cms plugin:remove @cms-plugin/newsletter
```

Or via Admin → Plugins → Browse Registry.

---

## 13. Official Plugins

All MIT licensed. All built and maintained by Kritano. Available from Phase 1.0 unless noted.

---

### Plugin 01 — GitHub Sync ⭐

**`@cms-plugin/github-sync`**

Enables the CMS to be used as the documentation platform for the CMS itself — and for any project that wants to keep content in sync with a GitHub repository. Contributors edit MD files in the repo via PR. The CMS stays in sync automatically. No contributor ever needs CMS admin access.

**How it works:**

1. Contributor submits a PR editing MD files in the repo
2. PR is reviewed and merged on GitHub
3. GitHub Action fires a webhook: `POST /api/plugins/github-sync/deploy`
4. The plugin receives the webhook, verifies the signature, pulls changed files via the GitHub API
5. Creates or updates the corresponding CMS documents in the configured collection
6. CMS publishes them — docs site rebuilds

**Plugin config in admin:**

```
GitHub repo:        kritano/[cms-name]
Docs folder:        /docs
Target collection:  documentation
Branch:             main
Webhook secret:     xxxxxxxxx
Field mapping:
  filename → slug
  h1 → title
  body → body
```

**GitHub Action (added to the repo):**

```yaml
# .github/workflows/sync-docs.yml
name: Sync docs to CMS
on:
  push:
    branches: [main]
    paths: ['docs/**']

jobs:
  sync:
    runs-on: ubuntu-latest
    steps:
      - name: Notify CMS
        run: |
          curl -X POST ${{ secrets.CMS_WEBHOOK_URL }} \
            -H "X-Hub-Signature-256: ${{ secrets.CMS_WEBHOOK_SECRET }}" \
            -H "Content-Type: application/json" \
            -d '{"ref": "${{ github.sha }}", "repo": "${{ github.repository }}"}'
```

**Two edit paths, one content store:**

- Contributors without CMS access → edit MD in GitHub → auto-synced to CMS
- Contributors with CMS access → edit directly in admin editor
- Both paths write to the same collection. No conflict as long as the GitHub branch is treated as source of truth for the docs folder.

**Beyond docs — general use cases:**

Any team that manages content in a GitHub repo (changelogs, product specs, knowledge bases) can use this plugin to sync into the CMS without changing their existing workflow. Useful well beyond the CMS's own documentation.

---

### Plugin 02 — WordPress Migration ⭐

**`@cms-plugin/wordpress-migration`**

The most important plugin for adoption. Without a credible migration path, agency uptake stalls.

**Migrates:**
- Posts, pages, custom post types
- Custom fields (ACF, Pods, CMB2) — visual field mapping UI before import runs
- Categories, tags, custom taxonomies
- Media library — downloads all files, imports to CMS media
- Users — roles mapped to CMS equivalents
- Menus — imported as navigation collections
- Redirects — existing permalink structures preserved as 301s
- Comments (optional)

**Two import methods:**

Option A — XML upload: Upload the WordPress export file directly.

Option B — Live pull: Provide the WordPress site URL and admin credentials. Connects to the WordPress REST API and pulls content directly, with pagination for large sites.

**Safety:** Import runs in a database transaction. Fails cleanly with no partial data. Safe to re-run.

---

### Plugin 03 — Forms

**`@cms-plugin/forms`** — Available Phase 0.2 (baked into core)

- Visual drag-and-drop form builder
- Field types: text, email, phone, textarea, select, checkbox, file, date
- Submission storage in Postgres
- Email notifications via configured SMTP
- Spam protection (honeypot + optional Turnstile)
- CSV export
- Webhook on submission

---

### Plugin 04 — Newsletter & Email

**`@cms-plugin/newsletter`**

- Subscriber management with GDPR double opt-in
- Campaign builder using same block editor as CMS
- Send via SMTP, Resend, or Postmark
- Open and click tracking
- Subscriber segments
- Unsubscribe handling

---

### Plugin 05 — Comments

**`@cms-plugin/comments`**

- Threaded comments on any collection
- Moderation queue
- Email notifications
- Spam filtering
- OAuth login to comment

---

### Plugin 06 — Membership & Gating

**`@cms-plugin/membership`**

- Free and paid tiers
- Content gating per collection or document
- Stripe billing
- Member dashboard
- Works with newsletter plugin for subscriber-only content

---

### Plugin 07 — E-commerce (Basic)

**`@cms-plugin/commerce`**

- Product collection with variants and pricing
- Cart and checkout via Stripe
- Order management
- Basic inventory tracking
- Digital product delivery

---

### Plugin 08 — Social Auto-publish

**`@cms-plugin/social`**

- Auto-publish to X/Twitter, LinkedIn, Bluesky on content publish
- Customisable post template per network
- Scheduling delay (post N hours after content goes live)

---

### Plugin 09 — Import / Export

**`@cms-plugin/io`**

- Export any collection to CSV or JSON
- Import from CSV with field mapping UI
- Ghost import
- Contentful import
- Scheduled exports

---

## 14. Kritano Integration

Kritano is built by the same company. It is not a third-party plugin — it is a native integration that ships with the CMS core and is presented as a first-class feature. It is optional — the CMS works fully without it.

### 14.1 Where Kritano appears in the CMS

**Admin → Site → Site Health**
The primary Kritano surface. Shows:
- Overall site health score
- SEO score
- Accessibility (WCAG) score
- Performance summary (Core Web Vitals)
- AI Visibility score
- Broken links count
- Last audit timestamp
- Link to full Kritano dashboard

**Document editor — right sidebar**
A Kritano tab alongside the Publish and SEO tabs. Shows on-demand analysis:
- Readability score
- Keyword analysis
- AEO score (is this content structured for AI answer engines?)
- Accessibility issues on current page
- Internal linking suggestions

Runs on demand (user clicks Analyse) — not on every keystroke.

### 14.2 Connection states

**State 1 — Not connected**

Non-intrusive prompt on the Site Health page:

> "Powered by Kritano — connect your free account to unlock SEO auditing, accessibility scoring and AI visibility."
> [Create free account] [Connect existing account]

**State 2 — OAuth flow**

Opens a modal (no page redirect). For new users: lightweight signup form hitting `POST https://app.kritano.com/api/forge/register`. For existing users: OAuth to `https://app.kritano.com/oauth/forge`. On success, Kritano returns a long-lived API token. Stored encrypted in site config.

**State 3 — Site creation**

Immediately after token receipt, CMS calls:

```
POST https://app.kritano.com/api/sites
Authorization: Bearer {token}
{
  "name": "{site name}",
  "domain": "{site domain}",
  "source": "forge",
  "cms_version": "0.1.0"
}
```

Kritano creates the site record, returns `site_id`. CMS stores it.

**State 4 — Live**

Site Health dashboard populates. Editor sidebar activates. Green connected indicator in `Admin → Site → Settings`.

### 14.3 Free vs Pro tier inside CMS

| Feature | Free (connected) | Kritano Pro |
|---|---|---|
| Manual audit on demand | 5/month | Unlimited |
| Scheduled crawls | ✗ | Daily |
| SEO score | Basic | Full |
| Accessibility (WCAG) | Summary | Full WCAG 2.2 |
| AI Visibility score | ✗ | ✓ |
| Core Web Vitals monitoring | ✗ | ✓ |
| Broken link detection | On demand | Scheduled |
| Editor sidebar analysis | Limited | Full |
| Competitor benchmarking | ✗ | ✓ |
| PDF audit reports | ✗ | ✓ |

Upgrade prompts appear inline at feature limits — a single line, never a popup, never repeated aggressively.

### 14.4 What Kritano needs to build

#### New API endpoints

```
POST  /api/forge/register           New user account creation from CMS modal
POST  /api/sites                    Create site (add source: 'cms' tracking field)
GET   /api/sites/{id}/health        Composite health score for dashboard widget
GET   /api/sites/{id}/audit/latest  Latest full audit results
POST  /api/sites/{id}/audit         Trigger a new audit
POST  /api/sites/{id}/seo/analyse   Submit page content for inline editor analysis
```

#### OAuth app registration

- Client ID and secret (bundled into CMS — not per user)
- Scopes: `sites:read`, `sites:write`, `audits:read`, `audits:write`
- Redirect URI: `{cms_site_url}/api/kritano/oauth/callback`
- Token type: long-lived API token

#### Site record additions

- `source` — `'web' | 'cms' | 'api'`
- `cms_version` — version that connected
- `cms_connected_at` — timestamp
- `cms_domain` — domain reported on connection

#### Webhook from Kritano → CMS

On audit completion, POST to `{cms_site_url}/api/kritano/webhook`:

```json
{
  "event": "audit.completed",
  "site_id": "xxx",
  "scores": {
    "overall": 78,
    "seo": 82,
    "accessibility": 71,
    "performance": 89,
    "ai_visibility": 64
  },
  "audit_id": "yyy",
  "completed_at": "2025-01-01T12:00:00Z"
}
```

CMS stores this and updates the Site Health dashboard without polling.

#### Inline SEO analysis response shape

Fast endpoint (< 1 second) — not a full crawl:

```json
{
  "readability_score": 74,
  "keyword_density": { "primary": 1.8 },
  "meta_title_length": 58,
  "meta_description_length": 142,
  "heading_structure": "good",
  "internal_links": 3,
  "suggestions": [
    { "type": "warning", "message": "Add alt text to 2 images" },
    { "type": "info",    "message": "Consider a FAQ section for AEO" }
  ]
}
```

---

## 15. Deployment System

No Docker in production. The CMS deploys to a plain Linux server using a generated bash script. The user owns the server — Hetzner, DigitalOcean, Vultr, AWS EC2, bare metal, anything.

### 15.1 Deployment UI in admin

Located at `Admin → Deployment`. A first-class section of the admin, not an afterthought.

**Initial setup form:**

| Field | Options |
|---|---|
| Server IP | Free text |
| SSH user | Free text (default: root) |
| Operating system | Ubuntu 22.04 / Ubuntu 24.04 / Debian 12 |
| Server size | Small (1–2 CPU) / Medium (2–4 CPU) / Large (4+ CPU) |
| Domain | Free text |
| Email (Let's Encrypt) | Free text |
| Storage | Local / S3-compatible |
| Include Typesense | Yes / No (Phase 0.3+) |

Clicking **Generate Script** produces a single bash script. Copy button. Paste into terminal on the server. Run as root.

### 15.2 What the install script does

```bash
# 1. System update and dependencies
apt update && apt upgrade -y
apt install -y curl git nginx certbot python3-certbot-nginx ufw fail2ban

# 2. Install Bun
curl -fsSL https://bun.sh/install | bash

# 3. Install PostgreSQL
apt install -y postgresql postgresql-contrib
# Creates database, user, sets password

# 4. Install Redis
apt install -y redis-server
# Configures persistence, sets maxmemory

# 5. Pull CMS from GitHub
git clone https://github.com/kritano/[cms-name].git /var/cms
cd /var/cms && bun install

# 6. Environment setup
# Writes .env with generated secrets, DB credentials, domain

# 7. Run migrations
bun cms migrate

# 8. Build admin and frontend
bun cms build

# 9. Configure nginx
# Writes virtual host config for domain
# Configures /admin, /api, /media, / routes

# 10. SSL certificate
certbot --nginx -d {domain} --non-interactive --agree-tos -m {email}

# 11. systemd services
# cms-api.service — Bun API server
# cms-worker.service — BullMQ worker
# Both set to restart on failure, start on boot

# 12. Security hardening
ufw allow 22 && ufw allow 80 && ufw allow 443 && ufw enable
# fail2ban configured for SSH and nginx
# Postgres bound to localhost only

# 13. Health check
curl -s http://localhost:3000/api/health
# Confirm CMS is running before script exits
```

### 15.3 Update script

Zero-downtime update generated from the same UI:

```bash
cd /var/cms
git pull origin main
bun install
bun cms migrate          # Run any new migrations
bun cms build            # Rebuild frontend
systemctl restart cms-api cms-worker
# Health check — auto-rollback if health check fails
```

### 15.4 Backups

Daily automatic Postgres dumps to `/var/backups/cms/`. Kept for 30 days. Admin UI shows last 5 backups with download links.

### 15.5 CLI commands (all phases)

```bash
cms dev                  # Local dev environment
cms migrate              # Run pending migrations
cms migrate:create       # Create blank migration
cms generate             # Regenerate types from config
cms build                # Build frontend
cms backup               # Manual backup trigger
cms logs                 # Tail production logs
cms plugin:install       # Install a plugin
cms plugin:list          # List installed plugins
cms plugin:remove        # Remove a plugin
```

---

## 16. Documentation Site

**URL:** `docs.[name].kritano.com` (placeholder until community name chosen)
**Strategy:** MD files in the repo for v0.1 and v0.2. Proper docs site when the community is large enough to need it.

### 16.1 Phase 0.1 — MD files in the repo

No infrastructure, no build step, no maintenance. GitHub renders everything automatically. Standard open source pattern.

```
[cms-name]/
├── README.md               # Front door — what it is, three-command quick start
├── CHANGELOG.md            # Every version change, newest first
├── CONTRIBUTING.md         # How to contribute, PR checklist, docs requirements
└── docs/
    ├── getting-started.md
    ├── collections.md
    ├── field-types.md
    ├── editor.md
    ├── api.md
    ├── themes.md
    ├── frontend.md
    ├── deployment.md
    ├── kritano.md
    └── plugins.md
```

**Keeping docs in sync with contributions:**

A `.github/pull_request_template.md` every contributor sees when opening a PR:

```markdown
## Checklist
- [ ] Does this change affect documented behaviour?
- [ ] If yes, have you updated the relevant file in /docs?
- [ ] Have you added an entry to CHANGELOG.md under ## Unreleased?
```

Stated clearly in CONTRIBUTING.md: a PR that changes behaviour without updating docs will not be merged. Enforced on review, not by CI.

**Must exist before v0.1 goes public:**
- README.md — three-command quick start, what it is, why it exists
- docs/getting-started.md
- docs/collections.md — complete field type reference
- docs/editor.md — all three editor modes documented
- docs/api.md — REST and GraphQL reference
- docs/themes.md — using and building themes
- docs/deployment.md — server setup guide
- docs/kritano.md — connecting and using

### 16.2 Phase 1.0 — CMS-powered docs site

When the community is large enough to need it, the MD files in the repo become the source of truth for a proper docs site — built on and served by the CMS itself, using the GitHub Sync plugin.

**The setup:**

- A dedicated CMS instance running at `docs.[name].kritano.com`
- GitHub Sync plugin (`@cms-plugin/github-sync`) configured to watch the `/docs` folder
- On every merge to main, GitHub Action fires the sync webhook
- CMS updates the documentation collection automatically
- Docs site rebuilds — contributors never need CMS access

**Two edit paths:**

Contributors without CMS access edit MD files via GitHub PR — auto-synced on merge. Kritano team can edit directly in the CMS admin. Both paths write to the same collection.

**Docs site structure:**

```
docs.[name].kritano.com/
├── /                          # Landing — what it is, quick start
├── /getting-started/
├── /collections/
├── /editor/
├── /api/
├── /themes/
├── /frontend/
├── /deployment/
├── /kritano/
├── /plugins/
│   ├── /using/
│   └── /building/
├── /changelog/
└── /community/
```

**Documentation principles (when the site exists):**
- Every page has a working code example
- No page assumes knowledge from an unseen page
- Dark mode by default
- Edit on GitHub link on every page
- Feedback widget per page (thumbs up/down)
- Search powered by Typesense — dogfooding the CMS's own search

---

*[CMS Name TBD] — Built by Kritano · MIT Licensed*
*Blueprint v3.0 — Updated with editor modes, GitHub Sync plugin, CMS-powered docs strategy*
*Name to be decided by community vote at launch*