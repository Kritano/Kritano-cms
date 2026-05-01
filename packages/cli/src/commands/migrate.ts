import { log } from '../utils/logger'
import { loadConfig } from '../utils/config'
import { runMigrations } from '@kritano/cms/core'
import { getProjectRoot } from '../utils/config'

export async function migrate() {
  log.header('Running migrations')

  try {
    const applied = await runMigrations(getProjectRoot())

    if (applied.length === 0) {
      log.success('No pending migrations')
    } else {
      for (const filename of applied) {
        log.step(`Applied: ${filename}`)
      }
      log.success(`${applied.length} migration(s) applied`)
    }
  } catch (err: any) {
    log.error(`Migration failed: ${err.message}`)
    process.exit(1)
  }
}

// Run directly
if (import.meta.main) {
  await migrate()
}
