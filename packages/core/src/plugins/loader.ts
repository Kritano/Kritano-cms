import { existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import type {
  CmsConfig,
  PluginDefinition,
  PluginTrust,
  PluginConfigEntry,
  PluginConfigOverride,
  HookContext,
  PluginHookEvent,
} from '@kritano/cms/types'
import type { Hono } from 'hono'
import { PluginRegistry, getPluginRegistry, resetPluginRegistry } from './registry'
import { createPluginContext, createRestrictedContext } from './context'
import { checkConflicts } from './conflict'
import { resolveLoadOrder, checkVersionCompatibility } from './deps'
import { createSandboxedPlugin } from './sandbox'

const CMS_VERSION = '0.3.0'

export interface PluginLoadResult {
  registry: PluginRegistry
  success: boolean
}

/**
 * Load and initialise all plugins declared in config and discovered locally.
 *
 * Sequence:
 *  1. Discover all plugins (npm declared in cms.config.ts + local plugins/ directory)
 *  2. Read each plugin's manifest — validate cms version constraints
 *  3. Log version warnings for out-of-range plugins
 *  4. Resolve dependency graph — determine load order
 *  5. Check for missing dependencies — skip dependent plugins
 *  6. Run conflict detection across all plugins to be loaded
 *  7. If any conflicts found — log all conflict errors and exit
 *  8. For each plugin in dependency order:
 *     a. Trusted: initialise in-process with full PluginContext
 *     b. Sandboxed: attempt isolated-vm with restricted context
 *     c. Plugin throws during setup: log error, skip, continue
 *  9. Fire cms.ready hook
 * 10. CMS begins serving requests
 * 11. Log summary: "X plugins loaded, Y warnings, Z skipped"
 */
export async function loadPlugins(config: CmsConfig, app: Hono): Promise<PluginLoadResult> {
  resetPluginRegistry()
  const registry = getPluginRegistry()

  const pluginEntries = config.plugins ?? []
  if (pluginEntries.length === 0) {
    // Check for local plugins even if none in config
    const localPlugins = await discoverLocalPlugins()
    if (localPlugins.length === 0) {
      return { registry, success: true }
    }
    // Process local plugins below
    pluginEntries.push(...localPlugins.map((p) => p as PluginConfigEntry))
  }

  // ── Step 1: Discover all plugins ──────────────────────────────────────────

  const discovered: Array<{
    definition: PluginDefinition
    trust: PluginTrust
    source: 'npm' | 'local'
    configOverride?: PluginConfigOverride
  }> = []

  // Process config entries
  for (const entry of pluginEntries) {
    try {
      const result = await resolvePluginEntry(entry)
      if (result) discovered.push(result)
    } catch (err) {
      const name = typeof entry === 'string' ? entry : Array.isArray(entry) ? entry[0] : entry.name
      console.error(`[CMS] Failed to load plugin "${name}": ${err instanceof Error ? err.message : err}`)
      registry.addSkipped(name, err instanceof Error ? err.message : 'Failed to load')
    }
  }

  // Discover local plugins
  const localPlugins = await discoverLocalPlugins()
  for (const local of localPlugins) {
    // Skip if already declared in config
    if (discovered.some((d) => d.definition.name === local.name)) continue
    discovered.push({
      definition: local,
      trust: 'trusted',
      source: 'local',
    })
  }

  if (discovered.length === 0) {
    return { registry, success: true }
  }

  // ── Step 2-3: Version compatibility checks ────────────────────────────────

  for (const item of discovered) {
    const warning = checkVersionCompatibility(
      item.definition.name,
      item.definition.cms,
      CMS_VERSION,
    )
    if (warning) {
      console.warn(`[CMS] Warning: ${warning}`)
      registry.addWarning(warning)
    }
  }

  // ── Step 4-5: Dependency resolution ───────────────────────────────────────

  const { ordered, skipped } = resolveLoadOrder(discovered.map((d) => d.definition))

  for (const skip of skipped) {
    console.error(`[CMS] Plugin "${skip.plugin.name}" ${skip.reason}`)
    registry.addSkipped(skip.plugin.name, skip.reason)
  }

  // Build a lookup from name → discovered item
  const discoveredByName = new Map(discovered.map((d) => [d.definition.name, d]))

  // ── Step 6: Register all plugins first (for conflict detection) ───────────

  const toLoad: Array<{
    definition: PluginDefinition
    trust: PluginTrust
    source: 'npm' | 'local'
    configOverride?: PluginConfigOverride
  }> = []

  for (const definition of ordered) {
    const item = discoveredByName.get(definition.name)
    if (!item) continue

    const plugin = registry.register(definition, item.trust, item.source, item.configOverride)
    toLoad.push(item)
  }

  // ── Step 7: Run setup for each plugin to collect registrations ────────────

  for (const item of toLoad) {
    const { definition, trust, configOverride } = item

    try {
      if (trust === 'sandboxed') {
        const sandboxed = await createSandboxedPlugin(
          definition,
          registry,
          configOverride?.config,
        )
        await definition.setup(sandboxed.context as any)
      } else {
        const context = createPluginContext(definition, registry, app, configOverride)
        await definition.setup(context)
      }
    } catch (err) {
      console.error(
        `[CMS] Plugin "${definition.name}" threw during setup — skipping: ${err instanceof Error ? err.message : err}`,
      )
      registry.addSkipped(definition.name, `setup() threw: ${err instanceof Error ? err.message : err}`)
      // Disable the plugin so it doesn't participate in conflict checks
      const loaded = registry.get(definition.name)
      if (loaded) loaded.enabled = false
    }
  }

  // ── Step 8: Conflict detection ────────────────────────────────────────────

  const enabledPlugins = registry.enabledPlugins
  const conflicts = checkConflicts(enabledPlugins, config.collections)

  if (conflicts.hasConflicts) {
    for (const error of conflicts.errors) {
      console.error(`[CMS] ${error}`)
    }
    console.error(`[CMS] ${conflicts.errors.length} plugin conflict(s) detected. CMS cannot start.`)
    return { registry, success: false }
  }

  // ── Step 9: Log summary ───────────────────────────────────────────────────

  const summary = registry.getSummary()
  console.log(
    `[CMS] Plugins: ${summary.loaded} loaded, ${summary.warnings} warning(s), ${summary.skipped} skipped`,
  )

  return { registry, success: true }
}

/**
 * Fire the cms.ready hook after the server is ready to accept requests.
 */
export async function fireReadyHook(): Promise<void> {
  const registry = getPluginRegistry()
  const hooks = registry.getHooksForEvent('cms.ready')

  for (const hook of hooks) {
    try {
      const ctx: HookContext = { event: 'cms.ready' }
      await hook.handler(ctx)
    } catch (err) {
      console.error(`[CMS] Plugin "${hook.pluginName}" cms.ready hook error: ${err instanceof Error ? err.message : err}`)
    }
  }
}

/**
 * Dispatch a plugin hook event. All registered handlers fire in order.
 * For "before" events, handlers can call cancel() to abort the operation.
 */
export async function dispatchPluginHook(
  event: PluginHookEvent,
  data: Omit<HookContext, 'event' | 'cancel'>,
): Promise<{ cancelled: boolean; reason?: string }> {
  const registry = getPluginRegistry()
  const hooks = registry.getHooksForEvent(event)

  if (hooks.length === 0) return { cancelled: false }

  let cancelled = false
  let cancelReason: string | undefined

  const ctx: HookContext = {
    event,
    ...data,
    cancel: event.includes('before')
      ? (reason: string) => { cancelled = true; cancelReason = reason }
      : undefined,
  }

  for (const hook of hooks) {
    if (cancelled) break
    try {
      await hook.handler(ctx)
    } catch (err) {
      console.error(
        `[CMS] Plugin "${hook.pluginName}" hook "${event}" error: ${err instanceof Error ? err.message : err}`,
      )
    }
  }

  return { cancelled, reason: cancelReason }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

async function resolvePluginEntry(entry: PluginConfigEntry): Promise<{
  definition: PluginDefinition
  trust: PluginTrust
  source: 'npm' | 'local'
  configOverride?: PluginConfigOverride
} | null> {
  // Inline plugin definition
  if (typeof entry === 'object' && !Array.isArray(entry) && 'setup' in entry) {
    return {
      definition: entry as PluginDefinition,
      trust: entry.trust ?? 'trusted',
      source: 'local',
    }
  }

  // String — npm package name
  if (typeof entry === 'string') {
    const definition = await importPluginModule(entry)
    return {
      definition,
      trust: determineTrust(entry, definition),
      source: 'npm',
    }
  }

  // Tuple — [name, overrides]
  if (Array.isArray(entry)) {
    const [name, overrides] = entry
    const definition = await importPluginModule(name)
    return {
      definition,
      trust: overrides.trust ?? determineTrust(name, definition),
      source: 'npm',
      configOverride: overrides,
    }
  }

  return null
}

async function importPluginModule(name: string): Promise<PluginDefinition> {
  try {
    const mod = await import(name)
    const definition = mod.default ?? mod
    if (!definition || typeof definition.setup !== 'function') {
      throw new Error(`Module "${name}" does not export a valid plugin definition`)
    }
    return definition
  } catch (err) {
    throw new Error(`Failed to import plugin "${name}": ${err instanceof Error ? err.message : err}`)
  }
}

function determineTrust(packageName: string, definition: PluginDefinition): PluginTrust {
  // Official plugins are always trusted
  if (packageName.startsWith('@cms-plugin/')) return 'trusted'

  // Plugin's own declaration
  if (definition.trust) return definition.trust

  // Community plugins default to sandboxed
  return 'sandboxed'
}

async function discoverLocalPlugins(): Promise<PluginDefinition[]> {
  const pluginsDir = resolve(process.cwd(), 'plugins')
  if (!existsSync(pluginsDir)) return []

  const plugins: PluginDefinition[] = []
  const entries = readdirSync(pluginsDir, { withFileTypes: true })

  for (const entry of entries) {
    const pluginPath = entry.isDirectory()
      ? join(pluginsDir, entry.name, 'index.ts')
      : entry.name.endsWith('.ts')
        ? join(pluginsDir, entry.name)
        : null

    if (!pluginPath || !existsSync(pluginPath)) continue

    try {
      const mod = await import(pluginPath)
      const definition = mod.default ?? mod
      if (definition && typeof definition.setup === 'function') {
        plugins.push(definition)
      }
    } catch (err) {
      console.warn(`[CMS] Failed to load local plugin at ${pluginPath}: ${err instanceof Error ? err.message : err}`)
    }
  }

  return plugins
}
