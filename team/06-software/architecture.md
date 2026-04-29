# Kritano CMS — Software Architecture

## Version Lock
- bun: 1.3.x
- typescript: 5.7.x
- drizzle-orm: (Task 03)
- hono: (Task 04)
- react: 19.x (Task 05)
- @tanstack/react-router: (Task 05)
- @tanstack/react-query: (Task 05)
- tailwindcss: 4.x (Task 05 — CSS-based config, no tailwind.config.ts)
- astro: 5.x (Task 11)
- @tiptap/core: (Task 06)
- graphql-yoga: (Task 04)

## Monorepo Structure
Bun workspaces. All packages under `packages/`. Internal deps via workspace protocol.

```
kritano-cms/
├── packages/
│   ├── types/    @cms/types    — shared TS types (no runtime code)
│   ├── core/     @cms/core     — schema DSL, DB, API server
│   ├── admin/    @cms/admin    — React SPA dashboard
│   ├── astro/    @cms/astro    — Astro integration
│   ├── sdk/      @cms/sdk      — typed API client
│   └── cli/      @cms/cli      — CLI commands
├── themes/
│   └── default/                — default portfolio theme
└── docs/                       — MD documentation
```

## Shared Types Contract
All packages import types from `@cms/types`. No package redefines domain types.
Path: `packages/types/src/index.ts`

## Task 01 Complete
`@cms/types` built and verified. All domain types defined:
- Collection/field definitions (16 field types)
- Document + Block types
- Media + transforms
- API response shapes (paginated, error)
- Auth (User, Session, JWT, login/refresh flows)
- SEO block
- CMS config, site config, theme config, Kritano config

## Task 02 Complete
`@cms/core` schema DSL built and verified:
- `defineConfig()` and `defineCollection()` — top-level config builders
- 16 field builders: text, textarea, richText, slug, url, number, boolean, datetime, select, multiSelect, media, relation, seoBlock, blocks, array, colour
- `block()` helper for defining flexible content block types
- All builders are chainable: `.required()`, `.nullable()`, `.default()`, plus type-specific methods
- `validateSchema()` — startup validation with descriptive errors:
  - Duplicate collection names, invalid names, empty fields
  - Select/multiSelect with empty options
  - Relation targets that don't exist
  - Slug `from` referencing non-existent fields
  - Text/number min > max
  - Blocks with duplicate names or empty definitions
- 38 unit tests passing (field builders, config construction, validation)

## Task 03 Complete
Database layer built in `packages/core/src/db/`:
- **client.ts** — Drizzle + postgres.js connection pool, singleton pattern
- **schema-generator.ts** — CMS schema → Postgres DDL mapping for all 16 field types, system columns (id, status, created_at, updated_at, published_at), FK constraints, updated_at triggers, system tables (users, media, site_settings)
- **migration-generator.ts** — Snapshot-based diffing: detects new tables, new columns, dropped columns, dropped tables. Generates timestamped SQL files. Stores `.snapshot.json` for comparison.
- **migrate.ts** — Transaction-based runner, tracks applied migrations in `_cms_migrations`
- Dependencies: drizzle-orm 0.45.x, postgres 3.4.x, drizzle-kit 0.31.x
- 40 new tests (78 total), all passing

## Task 04 Complete
API server built in `packages/core/src/api/`:
- **server.ts** — Hono app with CORS, error handling, REST + GraphQL
- **middleware/** — JWT auth (requireAuth/optionalAuth), CORS, global error handler
- **routes/auth.ts** — login (email+password→JWT), refresh, logout, me
- **routes/collection.ts** — Auto-generated CRUD per collection: list (paginated/filtered/sorted), get by ID, get by slug, create, full update, partial update, delete, publish, unpublish
- **routes/media.ts** — Upload with Sharp (auto WebP + thumbnail), list, update alt, delete
- **routes/sitemap.ts** — Auto-generated XML sitemap from published docs
- **routes/kritano.ts** — Webhook receiver + status endpoint
- **routes/health.ts** — `{ ok: true, version: '0.1.0' }`
- **graphql/** — Schema auto-built from CMS config, resolvers auto-generated per collection
- Dependencies: hono 4.12.x, jsonwebtoken, bcryptjs, sharp, graphql-yoga, uuid
- Version lock updates: hono 4.12.x, graphql-yoga 5.21.x, sharp 0.34.x
- 16 new tests (94 total), all passing

## Task 05 Complete
Admin SPA scaffold built in `packages/admin/`:
- **Stack:** React 19, Vite 6, TanStack Router 1.93, TanStack Query 5.62, Tailwind CSS 4.1, Lucide icons
- **lib/auth.ts** — JWT storage (localStorage), login, logout, token refresh, `isAuthenticated()` check (decodes JWT exp)
- **lib/api.ts** — Typed fetch wrapper with auto-refresh on 401, FormData support
- **lib/utils.ts** — cn(), formatDate(), truncate()
- **components/ui/** — Button (4 variants, 3 sizes), Input (with label/error), Badge (4 variants)
- **components/layout/Sidebar.tsx** — Dark (#0d0d0d) sidebar, collection nav from props, system nav (Media, Site, Health, Deployment), active state, mobile responsive with overlay
- **components/layout/Header.tsx** — Page title, hamburger menu (mobile), logout button
- **components/layout/AppLayout.tsx** — Sidebar + Header + Outlet shell
- **pages/Login.tsx** — Email/password form, error display, loading state
- **pages/Dashboard.tsx** — Quick-create cards per collection
- **router.tsx** — All routes declared, auth guard (redirect to login if not authenticated, redirect to dashboard if already logged in), placeholder components for Tasks 06–09
- Vite config: base `/admin/`, proxy `/api` to localhost:3000, path alias `@/`
- Build output: 800KB JS + 22KB CSS (gzipped: 251KB + 5KB) — includes TipTap + dnd-kit

## Task 06 Complete
Collection List & Document Editor built:
- **CollectionList.tsx** — Table with title/status/date, client-side search, bulk select + delete, empty state, TanStack Query data fetching
- **DocumentEditor.tsx** — Schema-driven: reads collection definition, renders correct fields. Auto-save (30s debounce), beforeunload warning, create-on-first-save, publish/unpublish via sidebar
- **13 field components:** TextField, TextareaField, SlugField (auto-generate from source), SelectField, MultiSelectField, BooleanField (toggle switch), DatetimeField, MediaField, RelationField, ArrayField, SeoBlockField (character counters), ColourField, NumberField
- **FieldRenderer.tsx** — Dispatches to correct component from field type
- **Editor.tsx** — Three-mode switcher (Visual/Markdown/Split), mode persisted in localStorage, JSON↔MD conversion on mode switch
- **VisualEditor.tsx** — TipTap with StarterKit, Link, Image, Placeholder. Formatting toolbar: bold, italic, H1-H3, lists, blockquote, code block, HR
- **MarkdownEditor.tsx** — Raw textarea, monospace font
- **SplitEditor.tsx** — MD left (50%) + live HTML preview right (50%)
- **BlockBuilder.tsx** — dnd-kit sortable, collapse/expand, duplicate, delete, inline field editing
- **BlockPicker.tsx** — Modal to select block type
- **BlockEditor.tsx** — Renders block's fields using FieldRenderer
- **EditorSidebar.tsx** — Tabbed (Publish + SEO), PublishPanel (status badge, publish/unpublish, timestamps), SeoPanel (meta title/desc with char counters, OG fields)
- **schemas.ts** — Hardcoded page/article/project schemas from blueprint (will come from config API later)
- Dependencies added: @tiptap/react, @tiptap/starter-kit, @tiptap/extension-link, @tiptap/extension-image, @tiptap/extension-placeholder, @dnd-kit/core, @dnd-kit/sortable
