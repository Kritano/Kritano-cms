import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import type { CmsConfig } from '@cms/types'
import { validateSchema } from '@cms/core'

export function getProjectRoot(): string {
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
