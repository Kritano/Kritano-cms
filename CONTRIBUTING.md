# Contributing to Kritano CMS

Thank you for your interest in contributing. This guide covers the development setup, code conventions, and PR process.

## Development setup

### Prerequisites

- [Bun](https://bun.sh/) (latest)
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (for PostgreSQL and Redis)

### Getting started

```bash
git clone https://github.com/kritano/cms.git
cd cms
cp .env.example .env
bun install
bun run packages/cli/src/index.ts dev
```

This starts PostgreSQL + Redis via Docker, runs migrations, seeds an admin user (`cms-admin@kritano.com` / `admin`), and launches the API server on port 3000 and admin UI on port 3001.

### Running tests

```bash
cd packages/core && bun test     # Core tests (schema, database, API)
cd packages/sdk && bun test      # SDK tests
```

### Type checking

```bash
cd packages/admin && bun run typecheck   # Admin UI
bun run typecheck                        # All packages
```

### Building

```bash
cd packages/admin && bun run build       # Admin UI
bun run build                            # All packages
```

## Code conventions

### General

- All code is TypeScript. No JavaScript files.
- British English spelling in user-facing text and documentation (colour, organisation, licence).
- Field names are camelCase in TypeScript, snake_case in PostgreSQL.
- `collectionToTableName()` pluralises collection names: `article` becomes `articles`.
- `fieldToColumnName()` converts camelCase to snake_case: `featuredImage` becomes `featured_image`.

### Rich text

- TipTap JSON is the canonical rich text storage format. Never Markdown in the database.
- The editor supports Markdown as an input/output format, but always converts to TipTap JSON before saving.

### Media

- Media files are stored locally in `./media/` during development.
- All uploaded images are converted to WebP with a 400px thumbnail on upload via Sharp.

### Admin schemas

- Admin collection schemas are hardcoded in `packages/admin/src/pages/collection/schemas.ts`. Keep them in sync with `cms.config.ts`.

### Phase 0.1 scope

Do not add code for features outside v0.1 scope: user roles/permissions, multi-site, multilingual, scheduled publishing, revision history, real-time collaboration, forms builder, redirects, webhooks, full-text search, plugin system, WordPress migration, A/B testing, newsletter, comments, membership, analytics, staging environments, or content calendar.

## Pull request process

### Before opening a PR

1. Run `bun test` in the relevant package(s) and ensure all tests pass.
2. Run `bun run typecheck` and fix any type errors.
3. Run `bun run build` for any package you changed and confirm it builds cleanly.
4. If you changed the schema DSL or added a field type, update `docs/collections.md`.
5. If you changed API routes, update `docs/api.md`.

### PR checklist

- [ ] Tests pass (`bun test`)
- [ ] Type check passes (`bun run typecheck`)
- [ ] Build succeeds (`bun run build`)
- [ ] Documentation updated for any user-facing changes
- [ ] No v0.2+ features introduced
- [ ] British English spelling in docs and UI text

### Commit messages

Write clear, imperative commit messages:

```
add media delete confirmation dialog
fix slug auto-generation for hyphenated titles
update collection list empty state copy
```

### Documentation requirements

Every docs file must:

- Have working code examples for every concept.
- Be accurate against the actual v0.1 implementation.
- Not reference v0.2+ features unless clearly marked "coming soon".

If your change affects how a feature works, update the relevant doc file in the same PR.

## Project structure

```
kritano-cms/
├── packages/
│   ├── types/          Shared TypeScript types (no runtime code)
│   ├── core/           Schema DSL, database, Hono API server
│   ├── admin/          React 19 admin SPA
│   ├── sdk/            Typed API client
│   ├── astro/          Astro integration
│   └── cli/            CLI commands
├── themes/default/     Default Astro theme
├── cms.config.ts       Schema definition (source of truth)
├── server.ts           API server entry point
└── docker-compose.yml  Local Postgres + Redis
```

## Licence

By contributing, you agree that your contributions will be licensed under the [MIT Licence](LICENSE).
