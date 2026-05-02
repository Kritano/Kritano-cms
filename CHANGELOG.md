# Changelog

All notable changes to Kritano CMS are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [0.4.0] — 2026-05-01

### Added
- `cms create` command — scaffold a new site in under two minutes
- `bunx @kritano/create-cms` — zero-install scaffolding, no global CLI needed
- Four starter templates — default, blog, portfolio, business with seed content
- Browser-based installer — five-step web wizard for non-technical users
- Installer auto-detects fresh install (no admin user), never shows after setup complete
- Kritano connect prompt on installer completion step
- Rate limiting on installer endpoints (10 requests per IP per hour)
- Getting started documentation completely rewritten for `cms create` workflow
- New docs: `installation.md` (3 install paths), `updating.md` (update workflow)

## [0.3.0] — 2026-05-01

### Added

- **Plugin system** — ESM plugin API with hooks, API routes, admin UI injection, custom fields, custom collections, GraphQL extension, job registration. `definePlugin()` factory, `PluginContext` with full and restricted API surfaces.
- **Plugin trust tiers** — trusted (in-process) and sandboxed (isolated-vm). Official `@cms-plugin/*` packages are trusted by default, community plugins sandboxed.
- **Plugin sandboxing** via isolated-vm — community plugins run in isolated V8 contexts with 128MB memory limits and restricted API surface.
- **Graceful sandbox fallback** — CMS starts with warning if isolated-vm native addon is unavailable. Sandboxed plugins run in-process with restricted context.
- **Conflict detection** — hard startup errors for route, field type, collection, and admin section conflicts across plugins. CMS will not start with conflicts.
- **Hook execution order** — plugins can declare `order` priority on hook subscriptions (lower runs first, default 100).
- **Plugin dependency declarations** — `requires` field in plugin manifest. Missing dependencies skip the dependent plugin with a clear log message.
- **Plugin version compatibility** — `cms.minVersion` / `maxVersion` checked on install and startup. Warnings logged, CMS starts regardless.
- **Plugin manager in admin UI** — trust tier badges (Official, Trusted, Sandboxed, Local), version warnings, enable/disable toggle, detail panel with hooks/routes/collections info.
- **CLI plugin commands** — `plugin:install` (with dependency prompts and version checks), `plugin:remove` (with dependent plugin warnings), `plugin:list` (with trust and version status), `plugin:enable`, `plugin:disable`.
- **Full-text search** powered by Typesense — zero config, auto-synced on publish. Field type mapping (text → string, richText → plain text extraction, datetime → int64, select → facet).
- **Global search in admin** (Cmd+K / Ctrl+K) — searches across all collections with 200ms debounce, results grouped by collection, keyboard navigation, skeleton loading.
- **Search component for Astro frontends** — `renderSearchForm()` produces plain HTML form (zero JS). Optional `enhance` mode adds defer-loaded <5kb script for live search-as-you-type.
- **Search results page** in default Astro theme at `/search`.
- **Search SDK methods** — `cms.search.search()` (global), `cms.collection().search()` (scoped), `cms.search.suggest()` (autocomplete).
- **Search API endpoints** — `GET /api/search`, `GET /api/search/:collection`, `GET /api/search/suggest`. Published content is public, drafts require auth.
- **OAuth login** — Google and GitHub. Buttons only appear when env vars configured. Auto-links OAuth to existing user by email. Creates new user if no match.
- **Linked accounts management** in Account Security — connect/disconnect providers, cannot unlink last login method.
- **Live preview protocol** — signed preview tokens (JWT, 2h expiry), draft content serving. Framework-agnostic: any frontend reads `cms_preview` query param.
- **Preview mode in @cms/astro** — `getPreviewToken()`, `getPreviewBannerHtml()`, `getCMSClient(previewToken)`.
- **Preview button** in document editor publish panel — generates token, opens preview URL in new tab.
- **SDK preview support** — `CMSClient` accepts `previewToken` option, `CollectionClient.findPreview()` method.
- **CMS update notifications** — checks GitHub API (development mode) or npm registry (release mode). Dashboard banner with dismiss (7 days per user). Deployment → Updates tab with version info, recent commits, copy-pasteable update commands.
- **Typesense added to deployment script generator** — optional radio toggle on Initial Setup, checkbox on Update Server. Installs Typesense 26.0, generates API key, configures service, syncs indexes.
- `cms search:sync` and `cms search:clear` CLI commands.
- 6 new documentation pages — plugins (using, building, security), search, OAuth, live preview.
- CHANGELOG.md.

### Changed

- `CmsConfig` type now accepts optional `plugins` array.
- `defineConfig()` accepts `plugins` option.
- `createServer()` loads plugins on startup, fires `cms.ready` hook.
- `startServer()` is now async.
- Collection routes index documents in Typesense on publish, remove on unpublish/delete.
- Admin sidebar shows numbered badge on Deployment when CMS updates are available.
- Publish panel shows separate View (published) and Preview (draft) buttons.
- SDK `CMSClient` constructor accepts `previewToken` option.
- SDK `CollectionClient` has `search()` and `findPreview()` methods.
- `@cms/astro` `getCMSClient()` accepts optional preview token parameter.

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
