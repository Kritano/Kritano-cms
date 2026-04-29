# Frontend References

## Admin UI
- **Framework:** React 19 + TanStack Router + TanStack Query
- **Styling:** Tailwind CSS only — no component library, no Shadcn for v0.1
- **Icons:** Lucide
- **Editor:** TipTap + ProseMirror (three modes: Visual, Markdown, Split)
- **Drag/drop:** @dnd-kit/sortable for block reordering
- **Design:** Dark sidebar (#0d0d0d), light main content, high contrast, no visual noise, every interaction under 200ms perceived latency

## Default Frontend Theme
- **Framework:** Astro 5 (zero JS by default, partial hydration)
- **Styling:** CSS custom properties for design tokens
- **Fonts:** System font stack by default (no external CDN)
- **Dark mode:** via `prefers-color-scheme` media query
- **Pages:** Homepage, article list/single, project list/single, page, 404
