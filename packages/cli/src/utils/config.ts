import { resolve, dirname } from 'node:path'
import { existsSync } from 'node:fs'
import type { CmsConfig } from '@kritano/cms/types'
import { validateSchema } from '@kritano/cms/core'

/** The consumer's working directory — where cms.config.ts, server.ts, migrations/ live */
export function getProjectRoot(): string {
  return process.cwd()
}

/** The CMS package root — where docker-compose.yml, packages/admin, themes/ live.
 *  In monorepo dev this equals CWD. When installed as a dependency, it's
 *  node_modules/@kritano/cms/ */
export function getCmsRoot(): string {
  // import.meta.dir gives us the directory of THIS file (utils/config.ts)
  // Walk up: utils/ → src/ → cli/ → packages/ → cms root
  const thisDir = dirname(new URL(import.meta.url).pathname)
  const cmsRoot = resolve(thisDir, '..', '..', '..', '..')

  // Verify by checking for a known CMS file
  if (existsSync(resolve(cmsRoot, 'packages', 'core', 'src', 'index.ts'))) {
    return cmsRoot
  }

  // Fallback to CWD (monorepo dev)
  return process.cwd()
}

export async function loadConfig(): Promise<CmsConfig> {
  const root = getProjectRoot()
  const configPath = resolve(root, 'cms.config.ts')

  if (!existsSync(configPath)) {
    throw new Error(`cms.config.ts not found in ${root}`)
  }

  const mod = await import(configPath)
  const config = mod.default as CmsConfig

  if (!config) {
    throw new Error('cms.config.ts must export a default config')
  }

  validateSchema(config)
  return config
}
