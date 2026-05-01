# Plugin security

Kritano CMS uses a trust-tier model to balance plugin capability with system safety.

## Trust tiers

### Trusted — in-process

Runs in the same V8 isolate as the CMS. Full `PluginContext` API available. No overhead.

**Used for:**

- All official `@cms-plugin/*` packages
- Local plugins in the `plugins/` directory
- Community plugins the user explicitly marks as trusted in `cms.config.ts`

**Can do everything:** hooks, API routes, admin UI sections, custom field types, collection registration, GraphQL extension, background jobs, storage, config.

### Sandboxed — restricted context

Runs in-process but receives a restricted `PluginContext` with only safe, data-level operations. When `isolated-vm` is available, runs in a separate V8 isolate with a 128MB memory limit.

**Used for:**

- Community plugins from npm not yet verified
- Any plugin with `trust: 'sandboxed'` in its manifest

**Can do:**

- Subscribe to content hooks
- Query and write to collections via the safe wrapper
- Read and write to plugin storage
- Read plugin config

**Cannot do:**

- Register API routes
- Register admin UI sections or editor tabs
- Register custom field types
- Register new collections
- Extend the GraphQL schema
- Register background job handlers
- Access the filesystem
- Make arbitrary network requests
- Access environment variables
- Import npm modules not pre-approved

### Verified — trusted after review

Community plugins that have been reviewed by the Kritano team. Listed on the registry with a verified badge. Users can install them as trusted. Promotion from sandboxed to verified happens via a manual audit process.

## isolated-vm sandboxing

When the `isolated-vm` native addon is available, sandboxed plugins run in a separate V8 isolate:

- **Separate heap** — the plugin cannot access CMS memory
- **Separate garbage collector** — a memory leak in the plugin doesn't affect the CMS
- **Memory limit** — 128MB per plugin isolate
- **Crash isolation** — an infinite loop or crash inside the isolate cannot bring down the CMS

All data crossing the isolate boundary is serialised (copied, not referenced). This adds microseconds per call — negligible next to database round trips.

### Graceful fallback

`isolated-vm` requires native compilation via `node-gyp`. If compilation fails on your server, the sandbox system falls back to warning-only mode:

```
[CMS] Warning: isolated-vm native addon not available.
      Plugin "community-plugin-x" will run without sandboxing.
      Only install plugins you trust.
      See: docs.kritano.com/plugins/sandboxing
```

The CMS still starts. Community plugins run in-process with the restricted context. This is safe enough for plugins from the curated registry — they still only get the restricted API surface.

## Trust overrides

Override a community plugin's trust tier in `cms.config.ts`:

```typescript
plugins: [
  ['community-plugin-x', { trust: 'trusted' }],   // full access — at your own risk
  ['another-plugin', { trust: 'sandboxed' }],       // explicit sandboxing
]
```

**Risk:** Marking an unvetted community plugin as `trusted` gives it full access to your database, filesystem, and API. Only do this for plugins you've reviewed.

## Conflict detection

The plugin loader runs conflict checks before initialising any plugin. Conflicts are **hard startup errors** — the CMS will not start with conflicts.

**What causes a conflict:**

| Conflict type | Example | Error message |
|---|---|---|
| Route collision | Two plugins register `GET /api/plugins/my-route` | Plugin conflict: "plugin-a" and "plugin-b" both register GET /api/plugins/my-route |
| Field type collision | Two plugins register `newsletter/picker` | Plugin conflict: "plugin-a" and "plugin-b" both register field type "newsletter/picker" |
| Collection collision | A plugin tries to register `subscriber` which exists in `cms.config.ts` | Plugin conflict: "plugin-x" tries to register collection "subscriber" which already exists |
| Admin section collision | Two plugins register the same admin section path | Plugin conflict: "plugin-a" and "plugin-b" both register admin section at /admin/plugins/my-section |

**Resolution:** Remove one of the conflicting plugins, or update one to use a different name. The CMS starts cleanly once all conflicts are resolved.

**Hook order is not a conflict:** Multiple plugins subscribing to the same hook is expected and fine. They fire in `order` sequence (lower values first). Plugins with the same order value fire in installation order.

## Getting a plugin verified

To apply for verified status:

1. Publish your plugin to npm following the [naming conventions](building-plugins.md#package-naming-conventions)
2. Ensure your plugin is open source with a clear licence
3. Submit a review request (process documented on the registry site — coming in Phase 1.0)

The Kritano team reviews the source for:

- No malicious code or data exfiltration
- Proper error handling (doesn't crash the CMS)
- Follows API conventions
- Declares accurate `cms` version constraints

Approved plugins move from `cms-plugin-*` to `@cms-verified/*` and appear with a verified badge in the admin.
