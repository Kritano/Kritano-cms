# Project Brief: Kritano CMS

## What are we building?
A ground-up open source CMS built by Kritano. Not WordPress with a new coat of paint — what a CMS would look like if designed today. Schema-first, TypeScript end-to-end, headless API with a default Astro frontend, and a block editor that feels like Notion. Self-hosted on any Linux server with a single generated script.

## Who is it for?
- **Developers** who want a TypeScript-native CMS with schema-as-code, hot reload, and no PHP/hook hell
- **Content teams / marketers** who want a Notion-like editor experience without touching code
- **Agencies** who need to deploy client sites on owned infrastructure without vendor lock-in
- **Portfolio owners** who want a clean, fast site with built-in SEO tooling

## What does success look like?
- A complete end-to-end CMS: define schema in config, create content in admin, see it live on the frontend
- Single admin user can log in, manage content across multiple collection types, upload media, publish, and see it live
- Site health scoring via Kritano integration
- One-script deployment to any Linux server
- Default theme that looks good out of the box as a developer portfolio
- MIT licensed, open source, community-nameable

## Constraints
- **Tech stack:** Bun runtime, Hono API framework, Astro 5 frontend, React admin SPA, PostgreSQL, Drizzle ORM, TipTap editor, Better Auth, BullMQ + Redis, Sharp media pipeline, GraphQL Yoga
- **Architecture:** Monorepo with Bun workspaces. All packages TypeScript. No JavaScript files.
- **Deployment:** systemd + nginx in production. Docker Compose for local dev only. No Docker in production.
- **Existing assets:** Kritano platform (provides SEO/accessibility/health scoring API)

## Scope

### In scope (Phase 0.1 — MVP)
- `@cms/types` — shared TypeScript types
- `@cms/core` — schema DSL, field builders, Drizzle database layer, Hono API server (REST + GraphQL), auth (email/password, JWT), media pipeline (Sharp), sitemap generation
- `@cms/admin` — React SPA with TanStack Router/Query, login/auth flow, collection list view, full document editor (Visual/Markdown/Split modes), media library, site settings, Kritano health panel, deployment script generator
- `@cms/sdk` — typed API client for any frontend framework
- `@cms/astro` — Astro integration + default theme (homepage, article/project templates, 404)
- `@cms/cli` — dev, migrate, migrate:create, generate, build commands
- Documentation (MD files in repo)
- Integration QA

### Out of scope (explicitly excluded from v0.1)
- User roles and permissions (single admin only)
- Multi-site / multilingual
- Scheduled publishing / revision history
- Real-time collaborative editing
- Forms builder / redirects manager / webhooks
- Full-text search (Typesense)
- Plugin system
- WordPress migration
- A/B testing / newsletter / comments / membership / analytics
- Staging environments / content calendar view
