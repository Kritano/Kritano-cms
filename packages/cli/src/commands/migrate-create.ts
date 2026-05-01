import { log } from '../utils/logger'
import { loadConfig, getProjectRoot } from '../utils/config'
import { createMigration } from '@kritano/cms/core'

export async function migrateCreate() {
  log.header('Creating migration')

  try {
    const config = await loadConfig()
    const result = await createMigration(config, getProjectRoot())

    if (!result) {
      log.success('No schema changes detected')
    } else {
      log.success(`Migration created: ${result.filename}`)
      log.step(`SQL preview:\n${result.sql.slice(0, 500)}${result.sql.length > 500 ? '\n  …' : ''}`)
    }
  } catch (err: any) {
    log.error(`Failed: ${err.message}`)
    process.exit(1)
  }
}

// Run directly
if (import.meta.main) {
  await migrateCreate()
}
