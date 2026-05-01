# Building plugins

This guide covers everything you need to build, test, and publish a Kritano CMS plugin.

## Plugin structure

A plugin is an npm package that exports a `definePlugin()` call as its default export:

```typescript
import { definePlugin } from '@cms/core'

export default definePlugin({
  name: '@cms-plugin/my-plugin',
  version: '1.0.0',
  description: 'A short description of what this plugin does',
  author: 'Your Name',

  // Optional: trust tier (defaults to 'trusted' for official, 'sandboxed' for community)
  trust: 'trusted',

  // Optional: CMS version compatibility
  cms: {
    minVersion: '0.3.0',
    maxVersion: '1.x',
  },

  // Optional: other plugins this one depends on
  requires: [],

  // The setup function — receives PluginContext with all extension points
  setup(context) {
    // Register hooks, routes, fields, etc.
  },
})
```

## PluginContext — full API reference

The `setup()` function receives a `PluginContext` object. Trusted plugins get the full API. Sandboxed plugins get a restricted subset (see [Security](security.md)).

### Hooks

Subscribe to lifecycle events. Multiple plugins can subscribe to the same event — they fire in `order` sequence (lower runs first, default 100).

```typescript
setup(context) {
  // Run before a document is created — can cancel the operation
  context.hooks.on('content.beforeCreate', async (ctx) => {
    if (!ctx.document?.title) {
      ctx.cancel?.('Title is required')
    }
  }, { order: 50 })  // runs before plugins with higher order values

  // Run after a document is published
  context.hooks.on('content.afterPublish', async (ctx) => {
    console.log(`Published ${ctx.collection}/${ctx.id}`)
  })

  // Runs once when the CMS is ready to accept requests
  context.hooks.on('cms.ready', async () => {
    console.log('CMS is ready')
  })
}
```

**Available hook events:**

| Event | When | Context data | Can cancel? |
|---|---|---|---|
| `content.beforeCreate` | Before a new document is saved | `collection`, `document` | Yes |
| `content.afterCreate` | After a new document is saved | `collection`, `document`, `id` | No |
| `content.beforeUpdate` | Before a document is updated | `collection`, `document`, `id` | Yes |
| `content.afterUpdate` | After a document is updated | `collection`, `document`, `id` | No |
| `content.beforePublish` | Before publish status change | `collection`, `id` | Yes |
| `content.afterPublish` | After publish status change | `collection`, `document`, `id` | No |
| `content.beforeUnpublish` | Before unpublish | `collection`, `id` | Yes |
| `content.afterUnpublish` | After unpublish | `collection`, `document`, `id` | No |
| `content.beforeDelete` | Before deletion | `collection`, `id` | Yes |
| `content.afterDelete` | After deletion | `collection`, `id` | No |
| `media.afterUpload` | After a file is uploaded | `data` | No |
| `media.beforeDelete` | Before a media file is deleted | `id` | Yes |
| `user.afterCreate` | After a new user is created | `data` | No |
| `form.afterSubmit` | After a form submission | `data` | No |
| `cms.ready` | CMS server is listening | — | No |

### API routes

Register HTTP routes namespaced under `/api/plugins/:pluginName/`:

```typescript
setup(context) {
  // GET /api/plugins/my-plugin/stats
  context.api.get('/stats', async (c) => {
    return { totalSubscribers: 42 }
  })

  // POST /api/plugins/my-plugin/subscribe
  context.api.post('/subscribe', async (c) => {
    const body = await c.req.json()
    // handle subscription
    return { ok: true }
  })
}
```

Available methods: `get`, `post`, `put`, `patch`, `delete`. The handler receives a [Hono](https://hono.dev) context object.

### Admin UI

Register sections, tabs, widgets, and settings pages in the admin:

```typescript
setup(context) {
  // New sidebar section
  context.admin.registerSection({
    label: 'Subscribers',
    icon: 'users',
    path: '/admin/plugins/my-plugin/subscribers',
  })

  // Tab in the document editor
  context.admin.registerEditorTab({
    label: 'Analytics',
    collection: 'article',  // or ['article', 'page'] for multiple
  })

  // Widget on the dashboard
  context.admin.registerDashboardWidget({
    label: 'Subscriber Count',
    width: 'half',  // 'half' or 'full'
  })

  // Settings page under the plugin detail view
  context.admin.registerSettingsPage({
    label: 'Newsletter Settings',
  })
}
```

### Custom field types

Register new field types. The type name **must** be namespaced as `plugin-name/type-name`:

```typescript
setup(context) {
  context.fields.register('my-plugin/colour-picker', MyColourPickerComponent)
}
```

### Collections

Register new collections from a plugin:

```typescript
setup(context) {
  context.collections.register({
    name: 'subscriber',
    fields: {
      email: { type: 'text', required: true },
      subscribedAt: { type: 'datetime' },
    },
  })
}
```

Query collections from your plugin:

```typescript
const subscribers = await context.collections.findMany('subscriber')
const one = await context.collections.findOne('subscriber', 'uuid-here')
const created = await context.collections.create('subscriber', { email: 'test@example.com' })
```

### GraphQL schema extension

Extend the GraphQL schema with custom types and resolvers:

```typescript
setup(context) {
  context.schema.extend(`
    type SubscriberStats {
      total: Int!
      thisMonth: Int!
    }
    extend type Query {
      subscriberStats: SubscriberStats!
    }
  `)

  context.schema.addResolver('Query', 'subscriberStats', async () => {
    return { total: 42, thisMonth: 7 }
  })
}
```

### Background jobs

Register and enqueue background jobs via BullMQ:

```typescript
setup(context) {
  // Register a job handler
  context.jobs.register('send-newsletter', async (data) => {
    // process the job
  })

  // Enqueue a job
  await context.jobs.enqueue('send-newsletter', { campaignId: '123' }, {
    delay: 5000,  // delay in ms
  })
}
```

### Plugin storage

Key-value storage backed by PostgreSQL. Each plugin gets its own namespace:

```typescript
setup(context) {
  // Store data
  await context.storage.set('last-sync', new Date().toISOString())

  // Retrieve data
  const lastSync = await context.storage.get('last-sync')

  // Delete
  await context.storage.delete('last-sync')
}
```

### Plugin config

Read config values passed from `cms.config.ts`:

```typescript
// In cms.config.ts:
// ['my-plugin', { config: { apiKey: 'sk_...' } }]

setup(context) {
  const apiKey = context.config.get<string>('apiKey')
  const allConfig = context.config.getAll()
}
```

## Package naming conventions

| Type | Format | Example |
|---|---|---|
| Official (Kritano) | `@cms-plugin/name` | `@cms-plugin/newsletter` |
| Community | `cms-plugin-name` | `cms-plugin-analytics` |
| Verified community | `@cms-verified/name` | `@cms-verified/seo-tools` |
| Local dev | No npm name required | `plugins/my-hook.ts` |

## Required `package.json` fields

```json
{
  "name": "@cms-plugin/newsletter",
  "version": "1.0.0",
  "type": "module",
  "main": "./dist/index.js",
  "exports": {
    ".": "./dist/index.js"
  },
  "cms": {
    "minVersion": "0.3.0",
    "maxVersion": "1.x"
  },
  "peerDependencies": {
    "@cms/core": ">=0.3.0"
  }
}
```

The `cms` field is read by the CLI during `plugin:install` to check compatibility.

## Worked example: a complete plugin

Let's build a simple "reading time" plugin that adds estimated reading time to articles.

### 1. Create the project

```bash
mkdir cms-plugin-reading-time && cd cms-plugin-reading-time
bun init
bun add @cms/core @cms/types
```

### 2. Write the plugin

```typescript
// src/index.ts
import { definePlugin } from '@cms/core'

export default definePlugin({
  name: 'cms-plugin-reading-time',
  version: '1.0.0',
  description: 'Adds estimated reading time to documents',
  author: 'Your Name',
  trust: 'trusted',
  cms: { minVersion: '0.3.0' },

  setup(context) {
    // Add reading time after every create/update
    context.hooks.on('content.afterCreate', async (ctx) => {
      if (ctx.document?.body) {
        const words = extractText(ctx.document.body).split(/\s+/).length
        const minutes = Math.ceil(words / 200)
        await context.storage.set(`reading-time:${ctx.id}`, minutes)
      }
    })

    context.hooks.on('content.afterUpdate', async (ctx) => {
      if (ctx.document?.body) {
        const words = extractText(ctx.document.body).split(/\s+/).length
        const minutes = Math.ceil(words / 200)
        await context.storage.set(`reading-time:${ctx.id}`, minutes)
      }
    })

    // API endpoint to get reading time
    context.api.get('/time/:id', async (c) => {
      const id = c.req.param('id')
      const minutes = await context.storage.get(`reading-time:${id}`)
      return { minutes: minutes ?? 0 }
    })
  },
})

function extractText(tiptapJson: unknown): string {
  if (!tiptapJson || typeof tiptapJson !== 'object') return ''
  const node = tiptapJson as Record<string, unknown>
  const parts: string[] = []
  if (node.type === 'text' && typeof node.text === 'string') parts.push(node.text)
  if (Array.isArray(node.content)) {
    for (const child of node.content) parts.push(extractText(child))
  }
  return parts.join(' ')
}
```

### 3. Build and publish

```bash
bun build ./src/index.ts --outdir ./dist --target bun
npm publish
```

### 4. Install in a CMS project

```bash
bun run packages/cli/src/index.ts plugin:install cms-plugin-reading-time
```

The reading time is now available at `GET /api/plugins/cms-plugin-reading-time/time/:documentId`.

## Publishing checklist

- [ ] `package.json` has `cms.minVersion` set
- [ ] `peerDependencies` includes `@cms/core`
- [ ] Plugin name follows naming conventions
- [ ] `setup()` doesn't throw — wrap risky code in try/catch
- [ ] Field types are namespaced: `'my-plugin/field-name'`
- [ ] API routes don't conflict with common paths
- [ ] README documents all config options
- [ ] Tested with the target CMS version
