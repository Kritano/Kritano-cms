import { $ } from 'bun'
import { log } from '../utils/logger'
import { loadConfig } from '../utils/config'

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

  // 2. Build admin UI
  log.step('Building admin UI…')
  try {
    await $`bun run --cwd packages/admin build`
    log.success('Admin built')
  } catch (err: any) {
    log.error(`Admin build failed: ${err.message}`)
    process.exit(1)
  }

  // 3. Build frontend theme (Astro — when configured)
  // For v0.1, the default theme is static Astro files
  // A full Astro build would be: bun astro build --root themes/default
  log.step('Frontend build skipped (Astro build will be configured in deployment)')

  log.success('Build complete')
}

// Run directly
if (import.meta.main) {
  await build()
}
