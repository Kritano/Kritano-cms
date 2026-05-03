import type { CollectionDefinition, FieldDefinition } from './collection'

// ── Trust Tiers ─────────────────────────────────────────────────────────────

export type PluginTrust = 'trusted' | 'sandboxed'

// ── Plugin Definition ───────────────────────────────────────────────────────

export interface PluginVersionConstraint {
  minVersion: string
  maxVersion?: string
}

export interface PluginDefinition {
  name: string
  version: string
  description: string
  author: string
  trust?: PluginTrust
  cms?: PluginVersionConstraint
  requires?: string[]
  setup: (context: PluginContext) => void | Promise<void>
}

// ── Plugin Hook Events ──────────────────────────────────────────────────────

export type PluginHookEvent =
  | 'content.beforeCreate'
  | 'content.afterCreate'
  | 'content.beforeUpdate'
  | 'content.afterUpdate'
  | 'content.beforePublish'
  | 'content.afterPublish'
  | 'content.beforeUnpublish'
  | 'content.afterUnpublish'
  | 'content.beforeDelete'
  | 'content.afterDelete'
  | 'media.afterUpload'
  | 'media.beforeDelete'
  | 'user.afterCreate'
  | 'form.afterSubmit'
  | 'cms.ready'

export interface PluginHookOptions {
  order?: number
}

export type PluginHookHandler = (ctx: HookContext) => void | Promise<void>

export interface HookContext {
  event: PluginHookEvent
  collection?: string
  document?: Record<string, unknown>
  id?: string
  data?: Record<string, unknown>
  cancel?: (reason: string) => void
}

// ── Plugin Context ──────────────────────────────────────────────────────────

export interface PluginHooksAPI {
  on(event: PluginHookEvent, handler: PluginHookHandler, options?: PluginHookOptions): void
}

export interface PluginApiAPI {
  get(path: string, handler: PluginRouteHandler): void
  post(path: string, handler: PluginRouteHandler): void
  put(path: string, handler: PluginRouteHandler): void
  patch(path: string, handler: PluginRouteHandler): void
  delete(path: string, handler: PluginRouteHandler): void
}

export type PluginRouteHandler = (ctx: unknown) => unknown | Promise<unknown>

export interface AdminSection {
  label: string
  icon: string
  path: string
  component?: unknown
  componentUrl?: string
}

export interface EditorTab {
  label: string
  collection?: string | string[]
  component?: unknown
  componentUrl?: string
}

export interface DashboardWidget {
  label: string
  width?: 'half' | 'full'
  component?: unknown
  componentUrl?: string
}

export interface SettingsPage {
  label: string
  component?: unknown
  componentUrl?: string
}

export interface PluginAdminAPI {
  registerSection(config: AdminSection): void
  registerEditorTab(config: EditorTab): void
  registerDashboardWidget(config: DashboardWidget): void
  registerSettingsPage(config: SettingsPage): void
}

export interface PluginFieldsAPI {
  register(type: string, component: unknown): void
}

export interface PluginCollectionsAPI {
  register(collection: CollectionDefinition): void
  findMany(collection: string, query?: Record<string, unknown>): Promise<Record<string, unknown>[]>
  findOne(collection: string, id: string): Promise<Record<string, unknown> | null>
  create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
  update(collection: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>>
}

export interface PluginSchemaAPI {
  extend(typeDefs: string): void
  addResolver(typeName: string, fieldName: string, resolver: unknown): void
}

export interface PluginJobOptions {
  delay?: number
  repeat?: { every?: number; cron?: string }
}

export interface PluginJobsAPI {
  register(queueName: string, handler: (data: unknown) => Promise<void>): void
  enqueue(queueName: string, data: unknown, options?: PluginJobOptions): Promise<void>
}

export interface PluginConfigAPI {
  get<T = unknown>(key: string): T | undefined
  getAll(): Record<string, unknown>
}

export interface PluginStorageAPI {
  get(key: string): Promise<unknown>
  set(key: string, value: unknown): Promise<void>
  delete(key: string): Promise<void>
}

export interface PluginCmsServices {
  collections: PluginCollectionsAPI
}

export interface PluginContext {
  hooks: PluginHooksAPI
  api: PluginApiAPI
  admin: PluginAdminAPI
  fields: PluginFieldsAPI
  collections: PluginCollectionsAPI
  schema: PluginSchemaAPI
  jobs: PluginJobsAPI
  config: PluginConfigAPI
  storage: PluginStorageAPI
  cms: PluginCmsServices
}

// ── Restricted context for sandboxed plugins ────────────────────────────────

export interface RestrictedPluginContext {
  hooks: PluginHooksAPI
  collections: Pick<PluginCollectionsAPI, 'findMany' | 'findOne' | 'create' | 'update'>
  storage: PluginStorageAPI
  config: PluginConfigAPI
}

// ── Plugin Config Entry (in cms.config.ts) ──────────────────────────────────

export interface PluginConfigOverride {
  trust?: PluginTrust
  config?: Record<string, unknown>
}

export type PluginConfigEntry =
  | string
  | [string, PluginConfigOverride]
  | PluginDefinition

// ── Loaded Plugin (runtime) ─────────────────────────────────────────────────

export interface LoadedPlugin {
  definition: PluginDefinition
  trust: PluginTrust
  source: 'npm' | 'local'
  enabled: boolean
  configOverride?: PluginConfigOverride
  routes: Array<{ method: string; path: string }>
  fieldTypes: string[]
  collections: string[]
  adminSections: Array<{ label: string; icon: string; path: string }>
  editorTabs: string[]
  dashboardWidgets: string[]
  settingsPages: string[]
  hooks: Array<{ event: PluginHookEvent; order: number; handler: PluginHookHandler }>
  graphqlExtensions: string[]
  resolvers: Array<{ typeName: string; fieldName: string; resolver: unknown }>
  jobHandlers: Map<string, (data: unknown) => Promise<void>>
}

// ── Conflict Detection ──────────────────────────────────────────────────────

export interface ConflictResult {
  errors: string[]
  hasConflicts: boolean
}
