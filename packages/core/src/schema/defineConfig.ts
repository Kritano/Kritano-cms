import type { CmsConfig, SiteConfig, CollectionDefinition } from '@cms/types'

export function defineConfig(options: {
  site: SiteConfig
  collections: CollectionDefinition[]
}): CmsConfig {
  return {
    site: options.site,
    collections: options.collections,
  }
}
