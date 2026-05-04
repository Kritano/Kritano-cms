// Installer
export { isConfigured, installerGuard, installerRoutes } from './installer'

// Schema DSL
export { defineConfig } from './schema/defineConfig'
export { defineCollection } from './schema/defineCollection'
export { validateSchema, SchemaValidationError } from './schema/validate'
export { addForm, getDeclaredForms, type FormFieldConfig, type FormConfig } from './schema/addForm'
export { syncDeclaredForms } from './lib/form-sync'

// Field builders
export {
  text,
  textarea,
  richText,
  slug,
  url,
  number,
  boolean,
  datetime,
  select,
  multiSelect,
  media,
  relation,
  seoBlock,
  blocks,
  block,
  array,
  colour,
} from './schema/fields'

// Field builder classes (for extension)
export { FieldBuilder } from './schema/fields'

// Database layer
export {
  getClient,
  getDb,
  closeConnection,
  getConnectionString,
  collectionToTable,
  collectionToTableName,
  fieldToColumn,
  fieldToColumnName,
  generateCreateTableSQL,
  generateMediaTableSQL,
  generateUsersTableSQL,
  generateSiteSettingsTableSQL,
  generateFullSchemaSQL,
  createMigration,
  diffSnapshots,
  listMigrations,
  runMigrations,
  type TableDefinition,
  type ColumnDefinition,
  type MigrationFile,
  type SchemaSnapshot,
} from './db'

// API server
export { createServer, startServer, getServerApp } from './api/server'
export { createApiRouter } from './api/router'
export { requireAuth, optionalAuth, requireScope, signToken, signRefreshToken, verifyToken } from './api/middleware/auth'
export { requirePermission } from './api/middleware/permission'
export { createCollectionRoutes } from './api/routes/collection'
export { buildGraphQLSchema } from './api/graphql/schema-builder'
export { buildResolvers } from './api/graphql/resolvers'

// Revisions
export { createRevision } from './lib/revisions'

// Scheduler
export { getScheduleQueue, startScheduleWorker, closeScheduler } from './lib/scheduler'

// Webhooks
export { dispatchWebhookEvent, startWebhookWorker, closeWebhookWorker } from './lib/webhooks'
export type { WebhookEvent, WebhookPayload } from './lib/webhooks'

// Permissions & activity
export { getUserRoles, checkPermission } from './lib/permissions'
export type { Permissions, RoleWithPermissions } from './lib/permissions'
export { logActivity } from './lib/activity-logger'
export type { ActivityLogEntry } from './lib/activity-logger'

// Update checker
export { checkForUpdates, getCachedUpdateCheck, dismissUpdate, isUpdateDismissed } from './lib/update-checker'
export type { UpdateCheckResult } from './lib/update-checker'

// Search (Typesense)
export {
  getSearchClient,
  isSearchAvailable,
  checkSearchHealth,
  syncSchemas,
  upsertDocument,
  deleteDocument,
  reindexCollection,
  clearCollection,
  searchCollections,
  searchSuggest,
  extractText,
  type SearchParams,
  type SearchHit,
  type CollectionSearchResult,
  type GlobalSearchResult,
  type SuggestResult,
} from './search'

// Plugin system
export { definePlugin } from './plugins/definePlugin'
export { loadPlugins, fireReadyHook, dispatchPluginHook } from './plugins/loader'
export { PluginRegistry, getPluginRegistry, resetPluginRegistry } from './plugins/registry'
export { createPluginContext, createRestrictedContext } from './plugins/context'
export { checkConflicts } from './plugins/conflict'
export { resolveLoadOrder, checkVersionCompatibility } from './plugins/deps'
export { createSandboxedPlugin, isIsolatedVmAvailable } from './plugins/sandbox'
