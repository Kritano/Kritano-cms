# CLAUDE.md — Kritano CMS

## Project overview

Open source CMS built by Kritano. Schema-first, TypeScript end-to-end, headless API (Hono on Bun) with a React admin SPA and an Astro default theme. MIT licensed.

## Architecture

Bun workspaces monorepo. All code is TypeScript — no JavaScript files.

| Package | Purpose |
|---|---|
| `packages/types` | Shared TypeScript types. No runtime code. |
| `packages/core` | Schema DSL, Drizzle database layer, Hono API server (REST + GraphQL), auth, media pipeline |
| `packages/admin` | React 19 SPA — Vite, TanStack Router/Query, Tailwind CSS 4, TipTap editor, dnd-kit |
| `packages/sdk` | Typed API client for any frontend framework |
| `packages/astro` | Astro integration — `useCMS()`, `defineTheme()` |
| `packages/cli` | CLI entry point — `dev`, `migrate`, `migrate:create`, `generate`, `build` |
| `themes/default` | Default Astro theme — layouts, templates, block components, CSS custom properties |

## Running locally

```bash
# Requires: Docker Desktop running (for Postgres + Redis)
bun run packages/cli/src/index.ts dev
```

This single command: starts Docker Compose, creates initial migration, applies migrations, seeds admin user (`cms-admin@kritano.com` / `admin`), generates types, starts API on `:3000`, starts admin UI on `:3001`.

- Admin: http://localhost:3001/admin
- API: http://localhost:3000/api/health
- GraphQL: http://localhost:3000/api/graphql

## Key files

- `cms.config.ts` — Schema definition. All collections defined here. Source of truth.
- `server.ts` — API server entry point.
- `docker-compose.yml` — Local Postgres 16 + Redis 7.
- `.env` — Local config (copy from `.env.example`).

## Common tasks

| Task | Command |
|---|---|
| Start dev | `bun run packages/cli/src/index.ts dev` |
| Create migration | `bun run packages/cli/src/commands/migrate-create.ts` |
| Apply migrations | `bun run packages/cli/src/commands/migrate.ts` |
| Generate types | `bun run packages/cli/src/commands/generate.ts` |
| Build admin | `cd packages/admin && bun run build` |
| Run core tests | `cd packages/core && bun test` |
| Run SDK tests | `cd packages/sdk && bun test` |
| Typecheck admin | `cd packages/admin && bun run typecheck` |

## Code conventions

- All field names are camelCase in TypeScript, snake_case in Postgres
- `collectionToTableName()` pluralises: `article` → `articles`
- `fieldToColumnName()` converts: `featuredImage` → `featured_image`
- TipTap JSON is the canonical rich text storage format — never Markdown
- Media stored locally in `./media/` (dev) or `/var/cms/media/` (prod)
- Admin collection schemas are hardcoded in `packages/admin/src/pages/collection/schemas.ts` — keep in sync with `cms.config.ts`

## Documentation

Docs live in `/docs/*.md`. When writing or updating docs:

- Every doc must have working code examples for every concept
- Do not reference v0.2+ features unless clearly marked "coming soon"
- Keep the README quick start accurate against the actual dev workflow
- The README links to individual doc files — if you add a new doc, add a link in the README's Documentation section
- British English spelling (colour, organisation)

## Phase 0.1 scope — what NOT to build

Do not build, stub, or add code for: user roles/permissions (single admin only), multi-site, multilingual, scheduled publishing, revision history, real-time collab, forms builder, redirects, webhooks, full-text search (Typesense), plugin system, WordPress migration, A/B testing, newsletter, comments, membership, analytics, staging environments, content calendar.

## Build status

See `v_01.md` for task-by-task progress. Tasks 01–12 are complete. Tasks 13 (docs) and 14 (QA) remain.
