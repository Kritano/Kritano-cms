# Changelog

All notable changes to Kritano CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.1.0] — 2026-04-28

First release. Schema-first headless CMS with a React admin panel, REST + GraphQL API, and an Astro default theme.

### Added

- **Schema DSL** — `defineConfig`, `defineCollection`, and 16 chainable field builders (`text`, `textarea`, `richText`, `slug`, `url`, `number`, `boolean`, `datetime`, `select`, `multiSelect`, `media`, `relation`, `seoBlock`, `blocks`, `array`, `colour`). Schema validation on startup with descriptive error messages.
- **Database layer** — Drizzle ORM with PostgreSQL. Auto-generates tables from schema. Migration system with snapshot diffing (`cms migrate:create`) and transactional runner (`cms migrate`). System tables for users, media, and site settings.
- **REST API** — Hono server with auto-generated CRUD routes per collection. Pagination, filtering by status, sorting, basic search (ILIKE). Publish/unpublish endpoints. JWT authentication (write endpoints require auth, published reads are public).
- **GraphQL API** — GraphQL Yoga endpoint with auto-generated schema and resolvers from collection definitions. Single item, by-slug, and paginated list queries per collection.
- **Auth** — Email + password login, JWT access tokens (1 hour), refresh tokens (30 days). Login, refresh, logout, and me endpoints.
- **Media pipeline** — Upload via multipart form. Sharp converts to WebP (quality 85) and generates 400px thumbnails on upload. Alt text editing. Delete removes all file variants.
- **Admin UI** — React 19 SPA with Vite, TanStack Router, TanStack Query, Tailwind CSS 4. Dark sidebar, light content area.
  - **Login flow** — JWT auth with auto-refresh, protected route guard.
  - **Collection list** — Table with search, status badges, bulk select, bulk delete, empty states.
  - **Document editor** — Schema-driven field rendering. 13 field components. Right sidebar with publish panel (status, publish/unpublish, timestamps) and SEO panel (meta title/description with character counters, OG fields, noIndex toggle). 30-second auto-save with visual indicator. Unsaved changes warning on navigation.
  - **Rich text editor** — Three modes: Visual (TipTap with StarterKit, Link, Image), Markdown (textarea with parser), Split (markdown left, live preview right). TipTap JSON is the canonical storage format.
  - **Block builder** — Add, edit, reorder (dnd-kit drag and drop), duplicate, and delete flexible content blocks. Collapsed preview showing block type and first text field.
  - **Media library** — Responsive grid, drag-and-drop upload, detail panel (alt text, dimensions, URL copy, delete). Media picker modal for use in document editor fields.
  - **Site settings** — Site name, domain, language, logo.
  - **Kritano panel** — Connection flow (create account / connect existing), health score dashboard (overall, SEO, accessibility, performance), webhook receiver for audit updates.
  - **Deployment page** — Form-driven bash script generator. Configurable for Ubuntu 22.04/24.04 and Debian 12, with server-size-based Postgres/Redis tuning. Script installs Bun, PostgreSQL, Redis, nginx, certbot, systemd services, ufw, fail2ban, and daily backup cron.
- **SDK** — `CMSClient` with `collection()` and `media` accessors. `findMany` (paginated, filtered, sorted, searchable), `findOne` (by ID or slug). API key support.
- **Astro integration** — `getCMSClient()`, `useCMS()` composable, `defineTheme()`, `cmsIntegration()` plugin.
- **Default theme** — Clean, minimal Astro theme. Base layout with nav/footer, system font stack, CSS custom properties, dark mode via `prefers-color-scheme`. Templates for page, article, article list, project, project list, homepage, and 404. Block components: Hero, TextBlock, ImageGallery.
- **CLI** — Five commands: `dev` (Docker + migrate + generate + API watch + admin Vite), `migrate`, `migrate:create`, `generate` (TypeScript types from config), `build`. Coloured logger, Docker Compose helpers, config loader with validation.
- **Sitemap** — Auto-generated XML sitemap from all published documents across all collections.
- **Type generation** — `cms generate` reads `cms.config.ts` and produces typed collection interfaces for the SDK.

### Infrastructure

- Bun workspaces monorepo with 6 packages + 1 theme.
- Docker Compose for local development (PostgreSQL 16 + Redis 7).
- All code is TypeScript — no JavaScript files.
