# Constraints

## Technical
- All packages must be TypeScript — no JavaScript files
- Bun workspaces monorepo — all internal deps use workspace protocol
- No Docker in production — systemd + nginx only
- PostgreSQL is the only supported database
- TipTap JSON is the canonical rich text storage format (not Markdown)
- Media stored locally (/var/cms/media/ in prod, ./media/ in dev) — nginx serves directly

## v0.1 Exclusions (do not build, do not stub)
- User roles/permissions (single admin only)
- Multi-site / multilingual
- Scheduled publishing / revision history
- Real-time collaborative editing (Y.js)
- Forms builder / redirects manager / webhooks
- Full-text search (Typesense)
- Plugin system
- WordPress migration
- A/B testing / newsletter / comments / membership / analytics
- Staging environments / content calendar view

## Build Order
Tasks are sequential — each depends on the previous task compiling and passing its own checks. See v_01.md for the 14-task breakdown.

## Kritano Integration
- Optional — CMS works fully without it
- Free tier: 5 manual audits/month, basic SEO score, accessibility summary
- Pro tier: unlimited audits, full WCAG 2.2, AI visibility, CWV monitoring
- API at app.kritano.com — endpoints documented in full_project.md Section 14
