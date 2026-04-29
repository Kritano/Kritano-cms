export { getClient, getDb, closeConnection, getConnectionString } from './client'
export {
  collectionToTable,
  collectionToTableName,
  fieldToColumn,
  fieldToColumnName,
  generateCreateTableSQL,
  generateMediaTableSQL,
  generateUsersTableSQL,
  generateSiteSettingsTableSQL,
  generateUpdatedAtTriggerSQL,
  generateFullSchemaSQL,
  type TableDefinition,
  type ColumnDefinition,
} from './schema-generator'
export {
  createMigration,
  diffSnapshots,
  listMigrations,
  loadSnapshot,
  saveSnapshot,
  type MigrationFile,
  type SchemaSnapshot,
} from './migration-generator'
export { runMigrations } from './migrate'
