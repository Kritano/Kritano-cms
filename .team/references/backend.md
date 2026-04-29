# Backend References

## Runtime & Framework
- **Runtime:** Bun (native TypeScript, built-in bundler and test runner)
- **API framework:** Hono (fastest TS HTTP framework, edge-ready)
- **Database:** PostgreSQL (only supported DB)
- **ORM:** Drizzle (schema-as-code, no magic)
- **Auth:** Better Auth (sessions, OAuth, 2FA, API keys)
- **Queue:** BullMQ + Redis (background jobs)
- **Media:** Sharp (on-the-fly transforms, WebP/AVIF auto-conversion)
- **Content API:** GraphQL Yoga (primary) + auto-generated REST

## Schema-First Architecture
Everything derives from `cms.config.ts`: DB migrations, GraphQL types, REST endpoints, admin forms, SDK types, Zod validation. One source of truth.

## API Conventions
- REST auto-generated per collection: CRUD + publish/unpublish
- GraphQL auto-derived from same schema
- JWT auth on write endpoints, public reads for published content
- Pagination: `?page=1&limit=20`
- Filtering: `?status=published`
- Sorting: `?sort=publishedAt&order=desc`
