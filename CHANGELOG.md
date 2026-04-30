# Changelog

All notable changes to Kritano CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.2.0] — 2026-04-30

### Added

- **User roles and permissions** — six built-in roles (super_admin, admin, editor, author, contributor, viewer) with granular, per-action permissions. Custom role builder with per-collection permission overrides.
- **User management** — invite users via email with role assignment. Invitation flow with 7-day token expiry. User list with role badges, 2FA status, and deactivate.
- **Two-factor authentication** — TOTP-based 2FA with QR code setup, code verification, and password-protected disable. Login flow returns `requires2fa` flag for 2FA-enabled accounts.
- **Activity log** — records all significant actions (document CRUD, media uploads, user changes, role changes, 2FA events). Paginated and filterable by user, action, and date range.
- **Document revision history** — automatic snapshot on every save (PUT, PATCH, publish, unpublish). Up to 50 revisions per document. Preview and restore with safety revision (never destructive). History tab in editor sidebar.
- **Scheduled publishing** — schedule documents to publish at a future date and time with timezone support. BullMQ delayed jobs. Status changes to "scheduled" with amber badge. Cancel schedule reverts to draft. Content calendar view.
- **Content calendar** — month-view calendar showing published and scheduled content across all collections with colour coding, day expansion, and collection filtering.
- **Bulk operations** — select multiple documents in collection list for bulk publish, unpublish, or delete.
- **Outbound webhooks** — 9 subscribable events, HMAC signing (`X-CMS-Signature`), async delivery via BullMQ, exponential backoff retry (5 attempts), auto-disable after 10 consecutive failures, delivery log with full payload/response, test delivery.
- **Redirects manager** — server-level redirect middleware (301/302), hit counter, inline add/edit, CSV import/export, chain detection with one-click fix, slug change redirect suggestion.
- **API key management** — `cms_live_` prefix keys with bcrypt-hashed storage, scoped permissions (6 scopes), expiry support, `last_used` tracking. Auth middleware accepts API keys alongside JWT.
- **Forms builder** — 8 field types (text, email, phone, textarea, select, checkbox, file, date), drag-to-reorder, per-field settings. Zero-JS Astro rendering via standard POST + redirect. Optional progressive enhancement script (defer, <5kb). Third-party embed script (async, <5kb). Submissions viewer with detail panel, CSV export, honeypot spam protection.
- **Media folders** — create/rename/delete folders, drag media between folders, folder filtering in media list.
- **Media usage tracking** — shows which documents reference a media file, warns on delete.
- **Zero-downtime update script** — rolling restart (worker then API), automatic health check rollback.
- **Backup management UI** — list backups, run manual backup, download, restore script copy.
- **MCP server** (`@cms/mcp`) — 11 tools for Claude Desktop and Cursor integration. Content CRUD, publish, media, site info. Validates API key on startup. `cms mcp` CLI command.
- **8 new documentation pages** — users-and-roles, revisions, scheduling, forms, redirects, webhooks, api-keys, mcp.

### Changed

- Auth middleware now supports API key authentication alongside JWT tokens.
- Collection PATCH response includes `redirectSuggestion` when slug changes.
- Document status now includes `scheduled` alongside `draft` and `published`.
- `/auth/me` now returns roles array and `twoFactorEnabled` flag.
- Admin sidebar reorganised with Team section (Users, Roles, Activity Log), Forms, Calendar, Redirects, Webhooks, and Account Security sections.
- `@cms/core` package.json exports `"bun"` condition for direct source resolution in dev.

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
