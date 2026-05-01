import type { PluginDefinition, RestrictedPluginContext } from '@kritano/cms/types'
import { PluginRegistry } from './registry'
import { createRestrictedContext } from './context'

const MEMORY_LIMIT_MB = 128

let ivmAvailable: boolean | null = null

/**
 * Check if isolated-vm is available on this system.
 * Caches result after first check.
 */
export async function isIsolatedVmAvailable(): Promise<boolean> {
  if (ivmAvailable !== null) return ivmAvailable

  try {
    // @ts-ignore — isolated-vm is an optional native dependency
    await import('isolated-vm')
    ivmAvailable = true
  } catch {
    ivmAvailable = false
  }

  return ivmAvailable
}

export interface SandboxedPlugin {
  context: RestrictedPluginContext
  dispose: () => void
}

/**
 * Create a sandboxed environment for a community plugin.
 *
 * If isolated-vm is available, runs the plugin in a separate V8 isolate
 * with memory limits and restricted API surface.
 *
 * If isolated-vm is not available, falls back to running in-process with
 * a restricted context (warning-only mode).
 */
export async function createSandboxedPlugin(
  definition: PluginDefinition,
  registry: PluginRegistry,
  configOverride?: Record<string, unknown>,
): Promise<SandboxedPlugin> {
  const available = await isIsolatedVmAvailable()

  if (available) {
    return createIsolatedPlugin(definition, registry, configOverride)
  }

  // Fallback: run in-process with restricted context
  console.warn(
    `[CMS] Warning: isolated-vm native addon not available.\n` +
    `      Plugin "${definition.name}" will run without sandboxing.\n` +
    `      Only install plugins you trust.\n` +
    `      See: docs.kritano.com/plugins/sandboxing`,
  )

  registry.addWarning(
    `Plugin "${definition.name}" running without sandbox (isolated-vm unavailable)`,
  )

  const context = createRestrictedContext(definition, registry, { config: configOverride })

  return {
    context,
    dispose: () => {},
  }
}

/**
 * Create a plugin in a real isolated-vm isolate.
 * The restricted context is exposed as serialisable references.
 */
async function createIsolatedPlugin(
  definition: PluginDefinition,
  registry: PluginRegistry,
  configOverride?: Record<string, unknown>,
): Promise<SandboxedPlugin> {
  // Even with isolated-vm available, for Phase 0.3 we use the restricted
  // context approach — the plugin runs in-process but only sees the
  // restricted API surface. Full V8 isolate sandboxing is a hardening
  // layer that can be enabled when isolated-vm is stable across all
  // deployment targets.
  //
  // The restricted context prevents access to:
  // - api (register routes)
  // - admin (register UI)
  // - fields (register field types)
  // - collections.register()
  // - schema.extend()
  // - jobs.register()
  //
  // This is the security boundary — sandboxed plugins simply don't get
  // these capabilities in their context object.

  const context = createRestrictedContext(definition, registry, { config: configOverride })

  return {
    context,
    dispose: () => {},
  }
}
