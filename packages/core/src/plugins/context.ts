import type {
  PluginContext,
  RestrictedPluginContext,
  PluginDefinition,
  PluginHookEvent,
  PluginHookHandler,
  PluginHookOptions,
  PluginRouteHandler,
  AdminSection,
  EditorTab,
  DashboardWidget,
  SettingsPage,
  PluginJobOptions,
  CollectionDefinition,
  PluginConfigOverride,
} from '@kritano/cms/types'
import type { Hono } from 'hono'
import { PluginRegistry } from './registry'
import { getClient } from '../db/client'

/**
 * Create a full PluginContext for trusted plugins.
 * Has access to all extension points.
 */
export function createPluginContext(
  definition: PluginDefinition,
  registry: PluginRegistry,
  app: Hono,
  configOverride?: PluginConfigOverride,
): PluginContext {
  const pluginName = definition.name

  const hooks = {
    on(event: PluginHookEvent, handler: PluginHookHandler, options?: PluginHookOptions): void {
      registry.addHook(pluginName, event, handler, options)
    },
  }

  const api = createApiRegistrar(pluginName, registry, app)
  const admin = createAdminRegistrar(pluginName, registry)
  const fields = createFieldsRegistrar(pluginName, registry)
  const collections = createCollectionsAPI(pluginName, registry)
  const schema = createSchemaRegistrar(pluginName, registry)
  const jobs = createJobsAPI(pluginName, registry)
  const config = createConfigAPI(configOverride)
  const storage = createStorageAPI(pluginName)

  return {
    hooks,
    api,
    admin,
    fields,
    collections,
    schema,
    jobs,
    config,
    storage,
    cms: { collections },
  }
}

/**
 * Create a restricted PluginContext for sandboxed plugins.
 * Only safe, data-level operations.
 */
export function createRestrictedContext(
  definition: PluginDefinition,
  registry: PluginRegistry,
  configOverride?: PluginConfigOverride,
): RestrictedPluginContext {
  const pluginName = definition.name

  const hooks = {
    on(event: PluginHookEvent, handler: PluginHookHandler, options?: PluginHookOptions): void {
      registry.addHook(pluginName, event, handler, options)
    },
  }

  const collectionsRead = createCollectionsReadAPI()
  const config = createConfigAPI(configOverride)
  const storage = createStorageAPI(pluginName)

  return { hooks, collections: collectionsRead, config, storage }
}

// ── API route registration ──────────────────────────────────────────────────

function createApiRegistrar(pluginName: string, registry: PluginRegistry, app: Hono) {
  const basePath = `/api/plugins/${pluginName}`

  function registerRoute(method: string, path: string, handler: PluginRouteHandler) {
    const fullPath = `${basePath}${path}`
    registry.addRoute(pluginName, method, fullPath)

    const honoHandler = async (c: any) => {
      const result = await handler(c)
      if (result instanceof Response) return result
      return c.json(result)
    }

    switch (method) {
      case 'GET': app.get(fullPath, honoHandler); break
      case 'POST': app.post(fullPath, honoHandler); break
      case 'PUT': app.put(fullPath, honoHandler); break
      case 'PATCH': app.patch(fullPath, honoHandler); break
      case 'DELETE': app.delete(fullPath, honoHandler); break
    }
  }

  return {
    get: (path: string, handler: PluginRouteHandler) => registerRoute('GET', path, handler),
    post: (path: string, handler: PluginRouteHandler) => registerRoute('POST', path, handler),
    put: (path: string, handler: PluginRouteHandler) => registerRoute('PUT', path, handler),
    patch: (path: string, handler: PluginRouteHandler) => registerRoute('PATCH', path, handler),
    delete: (path: string, handler: PluginRouteHandler) => registerRoute('DELETE', path, handler),
  }
}

// ── Admin UI registration ───────────────────────────────────────────────────

function createAdminRegistrar(pluginName: string, registry: PluginRegistry) {
  return {
    registerSection(config: AdminSection) {
      registry.addAdminSection(pluginName, config)
    },
    registerEditorTab(config: EditorTab) {
      registry.addEditorTab(pluginName, config)
    },
    registerDashboardWidget(config: DashboardWidget) {
      registry.addDashboardWidget(pluginName, config)
    },
    registerSettingsPage(config: SettingsPage) {
      registry.addSettingsPage(pluginName, config)
    },
  }
}

// ── Field type registration ─────────────────────────────────────────────────

function createFieldsRegistrar(pluginName: string, registry: PluginRegistry) {
  return {
    register(type: string, component: unknown) {
      // Field types must be namespaced: 'plugin-name/field-type'
      if (!type.includes('/')) {
        throw new Error(
          `Plugin "${pluginName}": field type "${type}" must be namespaced as "plugin-name/type-name"`,
        )
      }
      registry.addFieldType(pluginName, type)
    },
  }
}

// ── Collections API (full — for trusted plugins) ────────────────────────────

function createCollectionsAPI(pluginName: string, registry: PluginRegistry) {
  const readApi = createCollectionsReadAPI()

  return {
    ...readApi,
    register(collection: CollectionDefinition) {
      registry.addCollection(pluginName, collection.name)
    },
  }
}

// ── Collections API (read-only — shared between trusted and sandboxed) ──────

function createCollectionsReadAPI() {
  return {
    async findMany(collection: string, query?: Record<string, unknown>): Promise<Record<string, unknown>[]> {
      const sql = getClient()
      const tableName = `${collection}s` // simple pluralisation
      const rows = await sql.unsafe(`SELECT * FROM ${tableName} LIMIT 100`)
      return rows as Record<string, unknown>[]
    },

    async findOne(collection: string, id: string): Promise<Record<string, unknown> | null> {
      const sql = getClient()
      const tableName = `${collection}s`
      const rows = await sql.unsafe(`SELECT * FROM ${tableName} WHERE id = $1 LIMIT 1`, [id])
      return (rows[0] as Record<string, unknown>) ?? null
    },

    async create(collection: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
      const sql = getClient()
      const tableName = `${collection}s`
      const keys = Object.keys(data)
      const values = Object.values(data)
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ')
      const columns = keys.join(', ')
      const rows = await sql.unsafe(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders}) RETURNING *`,
        values as any[],
      )
      return rows[0] as Record<string, unknown>
    },

    async update(collection: string, id: string, data: Record<string, unknown>): Promise<Record<string, unknown>> {
      const sql = getClient()
      const tableName = `${collection}s`
      const keys = Object.keys(data)
      const values = Object.values(data)
      const setClause = keys.map((k, i) => `${k} = $${i + 1}`).join(', ')
      const rows = await sql.unsafe(
        `UPDATE ${tableName} SET ${setClause} WHERE id = $${keys.length + 1} RETURNING *`,
        [...values, id] as any[],
      )
      return rows[0] as Record<string, unknown>
    },
  }
}

// ── Schema extension ────────────────────────────────────────────────────────

function createSchemaRegistrar(pluginName: string, registry: PluginRegistry) {
  return {
    extend(typeDefs: string) {
      registry.addGraphqlExtension(pluginName, typeDefs)
    },
    addResolver(typeName: string, fieldName: string, resolver: unknown) {
      registry.addResolver(pluginName, typeName, fieldName, resolver)
    },
  }
}

// ── Background jobs ─────────────────────────────────────────────────────────

function createJobsAPI(pluginName: string, registry: PluginRegistry) {
  return {
    register(queueName: string, handler: (data: unknown) => Promise<void>) {
      const namespacedQueue = `plugin:${pluginName}:${queueName}`
      registry.addJobHandler(pluginName, namespacedQueue, handler)
    },

    async enqueue(queueName: string, data: unknown, options?: PluginJobOptions) {
      const namespacedQueue = `plugin:${pluginName}:${queueName}`
      // Lazy import to avoid circular dependency with BullMQ
      const { Queue } = await import('bullmq')
      const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379'
      const parsed = new URL(redisUrl)
      const queue = new Queue(namespacedQueue, {
        connection: {
          host: parsed.hostname,
          port: parseInt(parsed.port || '6379', 10),
          password: parsed.password || undefined,
        },
      })
      await queue.add('job', data, {
        delay: options?.delay,
        repeat: options?.repeat,
      })
      await queue.close()
    },
  }
}

// ── Plugin config ───────────────────────────────────────────────────────────

function createConfigAPI(configOverride?: PluginConfigOverride) {
  const settings = configOverride?.config ?? {}

  return {
    get<T = unknown>(key: string): T | undefined {
      return settings[key] as T | undefined
    },
    getAll(): Record<string, unknown> {
      return { ...settings }
    },
  }
}

// ── Plugin storage (database-backed key-value) ──────────────────────────────

function createStorageAPI(pluginName: string) {
  return {
    async get(key: string): Promise<unknown> {
      const sql = getClient()
      const rows = await sql`
        SELECT value FROM plugin_storage
        WHERE plugin_name = ${pluginName} AND key = ${key}
        LIMIT 1
      `
      if (rows.length === 0) return undefined
      return (rows[0] as Record<string, unknown>).value
    },

    async set(key: string, value: unknown): Promise<void> {
      const sql = getClient()
      await sql`
        INSERT INTO plugin_storage (plugin_name, key, value, updated_at)
        VALUES (${pluginName}, ${key}, ${JSON.stringify(value)}::jsonb, now())
        ON CONFLICT (plugin_name, key)
        DO UPDATE SET value = ${JSON.stringify(value)}::jsonb, updated_at = now()
      `
    },

    async delete(key: string): Promise<void> {
      const sql = getClient()
      await sql`
        DELETE FROM plugin_storage
        WHERE plugin_name = ${pluginName} AND key = ${key}
      `
    },
  }
}
