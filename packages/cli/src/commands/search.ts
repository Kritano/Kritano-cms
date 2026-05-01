import { log } from '../utils/logger'
import { loadConfig } from '../utils/config'
import {
  isSearchAvailable,
  checkSearchHealth,
  syncSchemas,
  reindexCollection,
  clearCollection,
  getClient,
  collectionToTableName,
} from '@kritano/cms/core'

export async function searchSync() {
  log.header('Search: Full Re-index')

  if (!isSearchAvailable()) {
    log.warn('Search not configured — set TYPESENSE_API_KEY in .env')
    return
  }

  log.step('Checking Typesense health…')
  const healthy = await checkSearchHealth()
  if (!healthy) {
    log.error('Typesense is not reachable. Check your connection settings.')
    process.exit(1)
  }
  log.success('Typesense is reachable')

  const config = await loadConfig()

  // 1. Sync schemas
  log.step('Syncing collection schemas…')
  const syncResult = await syncSchemas(config)
  if (syncResult.errors.length > 0) {
    for (const err of syncResult.errors) {
      log.warn(`Schema sync: ${err}`)
    }
  }
  if (syncResult.synced.length > 0) {
    log.success(`Schemas synced: ${syncResult.synced.join(', ')}`)
  }

  // 2. Re-index all published documents
  const sql = getClient()
  let totalIndexed = 0
  let totalErrors = 0

  for (const collection of config.collections) {
    const tableName = collectionToTableName(collection.name)
    log.step(`Indexing ${collection.name}…`)

    try {
      const rows = await sql.unsafe(
        `SELECT * FROM ${tableName} WHERE status = 'published'`,
      )
      const documents = rows as Record<string, unknown>[]

      if (documents.length === 0) {
        log.info(`  ${collection.name}: no published documents`)
        continue
      }

      const result = await reindexCollection(collection.name, documents, collection.fields)
      totalIndexed += result.indexed
      totalErrors += result.errors

      log.success(`  ${collection.name}: ${result.indexed} indexed, ${result.errors} errors`)
    } catch (err) {
      log.warn(`  ${collection.name}: ${err instanceof Error ? err.message : err}`)
    }
  }

  console.log('')
  log.success(`Re-index complete: ${totalIndexed} documents indexed, ${totalErrors} errors`)
}

export async function searchClear() {
  log.header('Search: Clear Indexes')

  if (!isSearchAvailable()) {
    log.warn('Search not configured — set TYPESENSE_API_KEY in .env')
    return
  }

  const config = await loadConfig()

  for (const collection of config.collections) {
    log.step(`Clearing ${collection.name}…`)
    const cleared = await clearCollection(collection.name)
    if (cleared) {
      log.success(`  ${collection.name} cleared`)
    } else {
      log.info(`  ${collection.name}: nothing to clear`)
    }
  }

  log.success('All search indexes cleared')
}
