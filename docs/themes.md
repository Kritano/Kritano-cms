# Themes

Kritano CMS uses [Astro](https://astro.build/) for its frontend. The default theme ships ready to use, and you can customise it or build your own.

## Default theme

The default theme is a clean, minimal design suitable as a developer portfolio or blog. It lives in `themes/default/`.

### Design principles

- System font stack — no external font loading
- CSS custom properties for all design tokens
- Dark mode via `prefers-color-scheme` media query
- Zero JavaScript shipped to the browser
- Responsive on all screen sizes
- Readable typography with good line length and hierarchy

### Templates

The default theme includes templates for each collection:

| Template | File | Renders |
|---|---|---|
| Page | `templates/page.astro` | Single page with block content |
| Article | `templates/article.astro` | Blog post with featured image, body, tags |
| Article list | `templates/article-list.astro` | Archive of all articles |
| Project | `templates/project.astro` | Portfolio item with description and images |
| Project list | `templates/project-list.astro` | Grid of all projects |

Plus `pages/index.astro` (homepage) and `pages/404.astro` (not found).

### CSS custom properties

The theme defines these design tokens in `styles/global.css`:

```css
:root {
  --color-primary: #0d0d0d;
  --color-accent: #c84b2f;
  --color-bg: #ffffff;
  --color-text: #1a1a1a;
  --color-text-muted: #6b7280;
  --color-border: #e5e7eb;

  --space-xs: 0.25rem;
  --space-sm: 0.5rem;
  --space-md: 1rem;
  --space-lg: 2rem;
  --space-xl: 4rem;
  --space-2xl: 6rem;

  --max-width: 65ch;
  --max-width-wide: 80rem;
}
```

Dark mode overrides these values automatically when the user's system preference is dark.

### Block components

The default theme includes Astro components for the built-in block types:

**Hero** (`components/blocks/Hero.astro`)

Centred section with heading, optional subheading, background image, and CTA button.

```astro
---
interface Props {
  heading: string
  subheading?: string
  image?: { url: string; alt?: string }
  ctaLabel?: string
  ctaUrl?: string
}
---
```

**TextBlock** (`components/blocks/TextBlock.astro`)

Rich text content rendered with prose styling.

```astro
---
interface Props {
  body: { html?: string } | string
}
---
```

**ImageGallery** (`components/blocks/ImageGallery.astro`)

Responsive grid of images with optional caption.

```astro
---
interface Props {
  images: Array<{ url: string; alt?: string } | string>
  caption?: string
}
---
```

### Rendering blocks in templates

Templates map block types to components:

```astro
---
import { useCMS } from '@cms/astro'
import Hero from '../components/blocks/Hero.astro'
import TextBlock from '../components/blocks/TextBlock.astro'
import ImageGallery from '../components/blocks/ImageGallery.astro'

const { doc } = useCMS()
---

{doc.content?.map((block) => {
  if (block.type === 'hero') return <Hero {...block.fields} />
  if (block.type === 'text-block') return <TextBlock {...block.fields} />
  if (block.type === 'image-gallery') return <ImageGallery {...block.fields} />
})}
```

## Theme configuration

Each theme has a `theme.config.ts` that defines its metadata, templates, and customisable settings:

```typescript
export default {
  name: 'default',
  version: '0.1.0',
  templates: {
    page: './templates/page.astro',
    article: './templates/article.astro',
    'article-list': './templates/article-list.astro',
    project: './templates/project.astro',
    'project-list': './templates/project-list.astro',
  },
  settings: {
    siteName: { type: 'text', label: 'Site Name' },
    logo: { type: 'media', label: 'Logo' },
    primaryColour: { type: 'colour', default: '#0d0d0d' },
    accentColour: { type: 'colour', default: '#c84b2f' },
    footerText: { type: 'text', label: 'Footer Text' },
    socialLinks: {
      type: 'group',
      fields: {
        twitter: { type: 'url', label: 'X / Twitter' },
        github: { type: 'url', label: 'GitHub' },
        linkedin: { type: 'url', label: 'LinkedIn' },
      },
    },
  },
}
```

### Setting types

| Type | Description |
|---|---|
| `text` | Text input |
| `media` | Media picker (image) |
| `colour` | Colour picker |
| `select` | Dropdown selection |
| `url` | URL input |
| `group` | Nested group of settings |

## Using the Astro integration

The `@cms/astro` package provides helpers for connecting your theme to the CMS API.

### getCMSClient()

Returns a singleton `CMSClient` instance configured from environment variables:

```astro
---
import { getCMSClient } from '@cms/astro'

const cms = getCMSClient()
const articles = await cms.collection('article').findMany({
  where: { status: 'published' },
  orderBy: { publishedAt: 'desc' },
  limit: 10,
})
---

<ul>
  {articles.data.map((article) => (
    <li><a href={`/article/${article.slug}`}>{article.title}</a></li>
  ))}
</ul>
```

The client reads `CMS_API_URL` from environment variables, defaulting to `http://localhost:3000/api`.

### useCMS()

Passes CMS context (document, settings, collection name) through to components:

```astro
---
import { useCMS } from '@cms/astro'

const { doc, settings, collection } = useCMS({
  doc: articleData,
  settings: siteSettings,
  collection: 'article',
})
---

<h1>{doc.title}</h1>
```

### defineTheme()

Type-safe wrapper for theme configuration:

```typescript
import { defineTheme } from '@cms/astro'

export default defineTheme({
  name: 'my-theme',
  version: '1.0.0',
  templates: { ... },
  settings: { ... },
})
```

## Building a custom theme

### Theme structure

```
themes/my-theme/
├── theme.config.ts       # Theme metadata and settings
├── components/
│   ├── Nav.astro
│   ├── Footer.astro
│   └── blocks/           # Block components
│       ├── Hero.astro
│       └── ...
├── layouts/
│   └── Base.astro        # Master layout
├── templates/
│   ├── page.astro        # One template per collection
│   ├── article.astro
│   └── article-list.astro
├── pages/
│   ├── index.astro       # Homepage
│   └── 404.astro
└── styles/
    └── global.css
```

### Step-by-step

1. **Create the directory** under `themes/` with the structure above.

2. **Define `theme.config.ts`** with your theme name, template mappings, and any customisable settings.

3. **Create a base layout** (`layouts/Base.astro`) with your HTML shell, navigation, and footer.

4. **Create templates** for each collection. Use `getCMSClient()` to fetch content and render it:

```astro
---
// templates/article.astro
import { getCMSClient } from '@cms/astro'
import Base from '../layouts/Base.astro'

const cms = getCMSClient()
const slug = Astro.params.slug
const article = await cms.collection('article').findOne({ where: { slug } })

if (!article) return Astro.redirect('/404')
---

<Base title={article.title}>
  <article>
    <h1>{article.title}</h1>
    <time>{new Date(article.publishedAt).toLocaleDateString('en-GB', {
      day: 'numeric', month: 'long', year: 'numeric'
    })}</time>
    <div set:html={article.body?.html || ''} />
  </article>
</Base>
```

5. **Create block components** for any block types defined in your schema. Each component receives the block's fields as props.

6. **Add styles** in `styles/global.css`. Use CSS custom properties for design tokens so they can be overridden.

### Tips

- Use system font stacks for fast loading — avoid external font requests.
- Keep JavaScript minimal. Astro ships zero JS by default; only add it where interactivity is genuinely needed.
- Use semantic HTML and proper heading hierarchy.
- Test with `prefers-color-scheme: dark` to ensure dark mode works.
- Set `max-width` on content containers for readable line lengths (55–75 characters).
