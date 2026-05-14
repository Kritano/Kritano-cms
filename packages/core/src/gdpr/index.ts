/**
 * @kritano/cms/gdpr — public surface for the GDPR / Data Subject Rights module.
 * See gdpr.md for the full specification.
 *
 * v1 ships: normalisation, audit logging primitives, registration types.
 * v1 will add (later steps): registry + auto-discovery, search, delete,
 * export, admin UI. v2 will add: anonymisation, retention sweep, privacy
 * notice versioning.
 */

export {
  normaliseEmail,
  hashEmailForAudit,
  isGdprConfigured,
  GdprNotConfiguredError,
} from './normalise'

export {
  writeDeletionLog,
  writeSearchLog,
  markSearchExported,
} from './audit'

export {
  registerGdprSource,
  getRegisteredSources,
  getGdprSource,
  discoverFormsSources,
  discoverCollectionsSources,
  initGdpr,
} from './registry'

export type {
  GdprSource,
  SearchRecord,
  SearchResult,
  PerSourceDeletionResult,
  DeletionSummary,
  DeletionResult,
  DeletionLogEntry,
  SearchLogEntry,
  AuditLogEntry,
  DeletionMethod,
  DeletionRequester,
  DeletionStatus,
} from './types'
