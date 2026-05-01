# Using plugins

Plugins extend Kritano CMS with new features — additional fields, API routes, admin sections, background jobs, and more. You can install official plugins, community plugins, or write your own.

## Installing a plugin

```bash
bun run packages/cli/src/index.ts plugin:install @cms-plugin/newsletter
```

This command:

1. Checks CMS version compatibility
2. Checks for missing dependencies (prompts to install them)
3. Installs the npm package
4. Adds the plugin to `cms.config.ts`
5. Regenerates TypeScript types

After installing, restart the CMS to activate the plugin.

## Configuring plugins in `cms.config.ts`

Plugins are declared in the `plugins` array:

```typescript
import { defineConfig } from '@cms/core'

export default defineConfig({
  site: { name: 'My Site', domain: 'https://mysite.com', language: 'en' },
  collections: [/* ... */],
  plugins: [
    // Official plugin — trusted by default
    '@cms-plugin/newsletter',

    // Community plugin with config override
    ['community-plugin-x', { trust: 'trusted', config: { apiKey: '...' } }],

    // Community plugin — sandboxed by default
    'cms-plugin-analytics',
  ],
})
```

## Trust tiers

Every plugin runs in one of two modes:

| Tier | Who | What it can do |
|---|---|---|
| **Trusted** | Official `@cms-plugin/*`, local plugins, user overrides | Full API: hooks, routes, admin UI, fields, collections, jobs |
| **Sandboxed** | Community plugins by default | Hooks, collection queries, storage, config only |

You can override a community plugin's trust tier:

```typescript
['community-plugin-x', { trust: 'trusted' }]  // at your own risk
```

## Managing plugins

### List installed plugins

```bash
bun run packages/cli/src/index.ts plugin:list
```

Shows each plugin's name, version, status, trust tier, and any version warnings.

### Enable / disable

```bash
bun run packages/cli/src/index.ts plugin:disable @cms-plugin/newsletter
bun run packages/cli/src/index.ts plugin:enable @cms-plugin/newsletter
```

You can also enable/disable plugins from the admin UI at **System → Plugins**.

### Remove a plugin

```bash
bun run packages/cli/src/index.ts plugin:remove @cms-plugin/newsletter
```

The CLI checks for dependent plugins before removing. If another plugin requires this one, you'll be prompted to confirm.

## Admin UI

Navigate to **System → Plugins** to see all installed plugins. Each plugin card shows:

- Name, version, and author
- Trust tier badge (Official, Trusted, Sandboxed, Local)
- Enabled/disabled toggle
- Click to see full details: hooks, routes, collections, dependencies

## Local plugins

Drop a TypeScript file or directory in the `plugins/` folder at the project root:

```
plugins/
├── my-custom-integration/
│   └── index.ts
└── simple-hook.ts
```

Local plugins are always trusted and auto-discovered on startup. No need to add them to `cms.config.ts`.

## Version compatibility

Plugins can declare which CMS versions they support:

```json
{
  "cms": {
    "minVersion": "0.3.0",
    "maxVersion": "1.x"
  }
}
```

If your CMS version is outside this range, you'll see a warning during install and a badge in the admin. The plugin still loads — it's a warning, not a block.

## Dependencies

Plugins can require other plugins:

```typescript
definePlugin({
  name: '@cms-plugin/commerce-stripe',
  requires: ['@cms-plugin/commerce'],
  // ...
})
```

If a required plugin is missing, the dependent plugin is skipped with a clear log message.
