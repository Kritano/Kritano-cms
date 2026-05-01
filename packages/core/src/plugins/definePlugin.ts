import type { PluginDefinition } from '@kritano/cms/types'

export function definePlugin(definition: PluginDefinition): PluginDefinition {
  if (!definition.name) {
    throw new Error('Plugin must have a name')
  }
  if (!definition.version) {
    throw new Error(`Plugin "${definition.name}" must have a version`)
  }
  if (!definition.setup || typeof definition.setup !== 'function') {
    throw new Error(`Plugin "${definition.name}" must have a setup function`)
  }

  return {
    trust: 'trusted',
    requires: [],
    ...definition,
  }
}
