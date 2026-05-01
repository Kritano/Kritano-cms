import type { CmsConfig, SiteConfig, CollectionDefinition, PluginConfigEntry } from '@kritano/types'

export function defineConfig(options: {
  site: SiteConfig
  collections: CollectionDefinition[]
  plugins?: PluginConfigEntry[]
}): CmsConfig {
  return {
    site: options.site,
    collections: options.collections,
    plugins: options.plugins,
  }
}
