import { $ } from 'bun'
import { resolve } from 'node:path'
import { existsSync } from 'node:fs'
import { log } from '../utils/logger'
import { loadConfig, getCmsRoot, getProjectRoot } from '../utils/config'

export async function build() {
  log.header('Building CMS')

  // 1. Validate config
  log.step('Validating config…')
  try {
    await loadConfig()
  } catch (err: any) {
    log.error(`Config error: ${err.message}`)
    process.exit(1)
  }

  const cmsRoot = getCmsRoot()
  const projectRoot = getProjectRoot()

  // 2. Build admin UI
  log.step('Building admin UI…')
  const adminDir = resolve(cmsRoot, 'packages/admin')
  try {
    await $`bun run --cwd ${adminDir} build`
    log.success('Admin built')
  } catch (err: any) {
    log.error(`Admin build failed: ${err.message}`)
    process.exit(1)
  }

  // 3. Build Astro frontend
  const hasCustomTheme = existsSync(resolve(projectRoot, 'astro.config.mjs')) ||
                         existsSync(resolve(projectRoot, 'astro.config.ts')) ||
                         existsSync(resolve(projectRoot, 'src/pages'))
  const themeDir = hasCustomTheme ? projectRoot : resolve(cmsRoot, 'themes/default')

  log.step('Building frontend…')
  try {
    const apiPort = process.env.PORT || '3005'
    await $`bunx astro build`.cwd(themeDir).env({ ...process.env, CMS_API_URL: `http://localhost:${apiPort}/api` })
    log.success('Frontend built')
  } catch (err: any) {
    log.error(`Frontend build failed: ${err.message}`)
    process.exit(1)
  }

  log.success('Build complete')
}

// Run directly
if (import.meta.main) {
  await build()
}
