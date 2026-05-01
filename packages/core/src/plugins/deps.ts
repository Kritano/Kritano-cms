import type { PluginDefinition } from '@kritano/cms/types'

/**
 * Resolve plugin load order based on `requires` declarations.
 * Returns plugins in dependency order (dependencies first).
 * Plugins with unresolvable dependencies are returned in `skipped`.
 */
export function resolveLoadOrder(
  plugins: PluginDefinition[],
): { ordered: PluginDefinition[]; skipped: Array<{ plugin: PluginDefinition; reason: string }> } {
  const byName = new Map<string, PluginDefinition>()
  for (const p of plugins) {
    byName.set(p.name, p)
  }

  const ordered: PluginDefinition[] = []
  const resolved = new Set<string>()
  const skipped: Array<{ plugin: PluginDefinition; reason: string }> = []

  // Topological sort via DFS
  const visiting = new Set<string>()

  function visit(plugin: PluginDefinition): boolean {
    if (resolved.has(plugin.name)) return true
    if (visiting.has(plugin.name)) {
      // Circular dependency — skip
      return false
    }

    visiting.add(plugin.name)

    for (const dep of plugin.requires ?? []) {
      const depPlugin = byName.get(dep)
      if (!depPlugin) {
        skipped.push({
          plugin,
          reason: `requires "${dep}" which is not installed. Run: cms plugin:install ${dep}`,
        })
        visiting.delete(plugin.name)
        return false
      }

      if (!visit(depPlugin)) {
        skipped.push({
          plugin,
          reason: `requires "${dep}" which could not be loaded`,
        })
        visiting.delete(plugin.name)
        return false
      }
    }

    visiting.delete(plugin.name)
    resolved.add(plugin.name)
    ordered.push(plugin)
    return true
  }

  for (const plugin of plugins) {
    if (!resolved.has(plugin.name)) {
      visit(plugin)
    }
  }

  return { ordered, skipped }
}

/**
 * Check CMS version compatibility for a plugin.
 * Returns a warning message if incompatible, null if OK.
 */
export function checkVersionCompatibility(
  pluginName: string,
  cmsConstraint: { minVersion: string; maxVersion?: string } | undefined,
  cmsVersion: string,
): string | null {
  if (!cmsConstraint) return null

  const cmsParts = parseVersion(cmsVersion)
  if (!cmsParts) return null

  // Check minVersion
  const minParts = parseVersion(cmsConstraint.minVersion)
  if (minParts && compareVersions(cmsParts, minParts) < 0) {
    return `Plugin "${pluginName}" requires CMS >= ${cmsConstraint.minVersion} (you are running ${cmsVersion})`
  }

  // Check maxVersion
  if (cmsConstraint.maxVersion) {
    const maxVersion = cmsConstraint.maxVersion.replace(/\.x$/, '.999')
    const maxParts = parseVersion(maxVersion)
    if (maxParts && compareVersions(cmsParts, maxParts) > 0) {
      return `Plugin "${pluginName}" declares maxVersion ${cmsConstraint.maxVersion} (you are running ${cmsVersion})`
    }
  }

  return null
}

interface VersionParts {
  major: number
  minor: number
  patch: number
}

function parseVersion(version: string): VersionParts | null {
  const match = version.match(/^(\d+)\.(\d+)\.(\d+)/)
  if (!match) return null
  return {
    major: parseInt(match[1], 10),
    minor: parseInt(match[2], 10),
    patch: parseInt(match[3], 10),
  }
}

function compareVersions(a: VersionParts, b: VersionParts): number {
  if (a.major !== b.major) return a.major - b.major
  if (a.minor !== b.minor) return a.minor - b.minor
  return a.patch - b.patch
}
