# Editor

The document editor is the core of the admin experience. It renders fields dynamically from your collection schema and provides a three-mode rich text editor and a block builder for flexible content.

## Document editor layout

The editor has two areas:

- **Main content** (left) — all schema-driven fields, rich text editors, and block builders
- **Sidebar** (right, 320px) — publish panel and SEO panel

The sidebar is always visible on desktop and collapsible on smaller screens.

## Field rendering

Fields render in the order they appear in your collection's `fields` definition. Each field type maps to a specific component:

| Field type | Admin component |
|---|---|
| `text` | Single-line text input |
| `textarea` | Multi-line textarea with optional character counter |
| `richText` | Three-mode editor (see below) |
| `slug` | Auto-generating slug field with manual edit toggle |
| `url` | Text input |
| `number` | Number input with min/max/step |
| `boolean` | Toggle switch |
| `datetime` | Date-time picker |
| `select` | Dropdown |
| `multiSelect` | Pill buttons (toggle on/off) |
| `media` | Button that opens the media picker modal |
| `relation` | Text input for target document ID |
| `seoBlock` | Renders in the sidebar SEO panel |
| `blocks` | Block builder (see below) |
| `array` | List with add/remove buttons |
| `colour` | Native colour picker |

The `status` field is handled by the publish panel in the sidebar and does not render in the main content area. The `seoBlock` field renders in the sidebar's SEO tab.

## Rich text editor

Every `richText()` field renders a three-mode editor. Switch between modes using the toolbar buttons. Your mode preference is saved to localStorage and persists across sessions.

### Visual mode

A WYSIWYG editor built on [TipTap](https://tiptap.dev/) with these capabilities:

- **Text formatting** — bold, italic
- **Headings** — H1, H2, H3
- **Lists** — bullet lists, ordered lists
- **Block elements** — blockquote, code block, horizontal rule
- **Links** — inline links
- **Images** — insert from the media library

The formatting toolbar shows the active state for each button based on the current selection.

### Markdown mode

A plain textarea for writing or pasting Markdown. Content is parsed to TipTap JSON on save.

Supported Markdown syntax:

- Headings (`# H1` through `#### H4`)
- Bold (`**text**`) and italic (`*text*`)
- Bullet lists (`- item`) and ordered lists (`1. item`)
- Blockquotes (`> text`)
- Code blocks (triple backticks)
- Inline code (single backticks)
- Links (`[text](url)`)
- Horizontal rules (`---`)

This mode is useful for pasting content from other tools or AI-generated Markdown.

### Split mode

Markdown textarea on the left (50%), live HTML preview on the right (50%). The preview updates as you type. This mode gives you the speed of Markdown with visual confirmation of the output.

### Storage format

TipTap JSON is always the canonical storage format in the database. Markdown is an input/output format only — the editor converts between Markdown and TipTap JSON when switching modes.

When switching from Visual to Markdown, the editor serialises the TipTap JSON to Markdown. When switching from Markdown to Visual, it parses the Markdown back to TipTap JSON. This conversion handles all the supported Markdown syntax listed above.

## Block builder

The `blocks()` field type renders the block builder — a flexible content system for composing pages from reusable, typed sections.

### Adding blocks

1. Click **Add block** at the bottom of the block list.
2. The block picker modal opens, showing all block types available for this field.
3. Click a block type to add it to the end of the list.
4. The new block auto-expands for editing.

### Editing blocks

Each block in the list shows:

- **Block type label** — e.g. "Hero", "Text Block"
- **Preview** — the first text field value (collapsed state)
- **Grip handle** — drag to reorder
- **Chevron** — expand/collapse the block
- **Copy icon** — duplicate the block (including all field values)
- **Delete icon** — remove the block

Click the chevron or block header to expand it. The expanded view renders all of the block's fields using the same field components as the document editor (text inputs, rich text editors, media pickers, etc.).

### Reordering blocks

Drag the grip handle on any block to reorder. The block builder uses [dnd-kit](https://dndkit.com/) for smooth drag-and-drop with visual feedback during the drag.

### Data structure

Blocks are stored as a JSON array in the database:

```json
[
  {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "type": "hero",
    "fields": {
      "heading": "Welcome to our site",
      "subheading": "Built with Kritano CMS",
      "image": "media-uuid",
      "ctaLabel": "Get started",
      "ctaUrl": "https://example.com/start"
    }
  },
  {
    "id": "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    "type": "text-block",
    "fields": {
      "body": {
        "type": "doc",
        "content": [
          { "type": "paragraph", "content": [{ "type": "text", "text": "..." }] }
        ]
      }
    }
  }
]
```

Each block has a UUID `id` (generated on creation), a `type` matching the block definition name, and a `fields` object containing the block's field values.

### Defining block types

Block types are defined in your schema using the `block()` helper inside a `blocks()` field:

```typescript
content: blocks([
  block('hero', {
    heading:    text().required(),
    subheading: text(),
    image:      media(),
    ctaLabel:   text(),
    ctaUrl:     url(),
  }),
  block('text-block', {
    body: richText(),
  }),
  block('image-gallery', {
    images:  array(media()),
    caption: text().nullable(),
  }),
])
```

Each block type can use any of the standard field types. Block names must be unique within a `blocks()` field.

## Publish panel

The publish panel in the right sidebar shows:

- **Status badge** — Draft or Published
- **Publish / Unpublish button** — toggles the document status
- **Created at** — when the document was first saved
- **Updated at** — when the document was last modified
- **Published at** — when the document was published (only shown if published)

Publishing a document sets its status to `published` and records the current timestamp as `publishedAt`. This makes the document visible to unauthenticated API requests. Unpublishing reverts the status to `draft` and clears `publishedAt`.

## SEO panel

The SEO panel appears in the right sidebar when the collection has a `seoBlock()` field. It contains:

| Field | Description |
|---|---|
| Meta title | Page title for search engines. Character counter with a 60-character target — turns amber when exceeded. |
| Meta description | Page description for search engines. Character counter with a 155-character target. |
| OG title | Open Graph title for social sharing. |
| OG description | Open Graph description for social sharing. |
| OG image | Media picker for the social sharing image. |
| No index | Toggle to add `noindex` to the page, excluding it from search engines. |

SEO field values save with the document — they are part of the document's data, not a separate entity.

## Auto-save

The editor auto-saves to draft every 30 seconds when there are unsaved changes. A visual indicator in the top bar shows the current state:

- **Saved** — all changes are saved
- **Saving...** — save in progress
- **Unsaved changes** — changes pending (auto-save will fire within 30 seconds, or click Save manually)

If you try to navigate away with unsaved changes, the browser shows a confirmation dialog.

## Creating vs editing

When you open a new document (`/admin/:collection/new`), the document is not created in the database until the first save. This avoids creating empty documents from accidental navigations.

When you save a new document, the editor sends a `POST` request to create it, then redirects to the edit URL with the new document's ID.
