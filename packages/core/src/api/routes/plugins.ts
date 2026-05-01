import { Hono } from 'hono'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { getPluginRegistry } from '../../plugins/registry'

export const pluginRoutes = new Hono<AuthEnv>()

// List installed plugins with status
pluginRoutes.get('/admin/plugins', requireAuth, requirePermission('settings'), async (c) => {
  const registry = getPluginRegistry()
  const sql = getClient()

  // Get database settings for each plugin
  const dbSettings = await sql`SELECT * FROM plugin_settings`.catch(() => [])
  const settingsMap = new Map<string, Record<string, unknown>>()
  for (const row of dbSettings) {
    const r = row as Record<string, unknown>
    settingsMap.set(r.plugin_name as string, r)
  }

  const plugins = registry.loaded.map((plugin) => {
    const dbRecord = settingsMap.get(plugin.definition.name)
    return {
      name: plugin.definition.name,
      version: plugin.definition.version,
      description: plugin.definition.description,
      author: plugin.definition.author,
      trust: plugin.trust,
      source: plugin.source,
      enabled: dbRecord ? (dbRecord.enabled as boolean) : plugin.enabled,
      routes: plugin.routes.length,
      hooks: plugin.hooks.length,
      collections: plugin.collections,
      fieldTypes: plugin.fieldTypes,
      adminSections: plugin.adminSections,
      editorTabs: plugin.editorTabs,
      dashboardWidgets: plugin.dashboardWidgets,
      settingsPages: plugin.settingsPages,
      installedAt: dbRecord?.installed_at ?? null,
    }
  })

  return c.json({ data: plugins })
})

// Plugin UI registry (sections, tabs, widgets)
pluginRoutes.get('/admin/plugins/registry', requireAuth, async (c) => {
  const registry = getPluginRegistry()
  const plugins = registry.enabledPlugins

  const sections: Array<{ pluginName: string; label: string; icon: string; path: string; componentUrl?: string }> = []
  const editorTabs: Array<{ pluginName: string; label: string; collection?: string | string[] }> = []
  const dashboardWidgets: Array<{ pluginName: string; label: string; width?: string }> = []
  const settingsPages: Array<{ pluginName: string; label: string }> = []

  for (const plugin of plugins) {
    const name = plugin.definition.name

    for (const section of plugin.adminSections) {
      sections.push({
        pluginName: name,
        label: section,
        icon: 'puzzle',
        path: `/admin/plugins/${name}/section`,
        componentUrl: `/api/plugins/${name}/admin/section.js`,
      })
    }

    for (const tab of plugin.editorTabs) {
      editorTabs.push({ pluginName: name, label: tab })
    }

    for (const widget of plugin.dashboardWidgets) {
      dashboardWidgets.push({ pluginName: name, label: widget })
    }

    for (const page of plugin.settingsPages) {
      settingsPages.push({ pluginName: name, label: page })
    }
  }

  return c.json({ sections, editorTabs, dashboardWidgets, settingsPages })
})

// Get plugin detail + current settings
pluginRoutes.get('/admin/plugins/:name', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.param('name')
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const sql = getClient()
  const dbRows = await sql`SELECT * FROM plugin_settings WHERE plugin_name = ${name} LIMIT 1`.catch(() => [])
  const dbRecord = dbRows[0] as Record<string, unknown> | undefined

  return c.json({
    data: {
      name: plugin.definition.name,
      version: plugin.definition.version,
      description: plugin.definition.description,
      author: plugin.definition.author,
      trust: plugin.trust,
      source: plugin.source,
      enabled: dbRecord ? (dbRecord.enabled as boolean) : plugin.enabled,
      requires: plugin.definition.requires ?? [],
      cms: plugin.definition.cms ?? null,
      routes: plugin.routes,
      hooks: plugin.hooks.map((h) => ({ event: h.event, order: h.order })),
      collections: plugin.collections,
      fieldTypes: plugin.fieldTypes,
      adminSections: plugin.adminSections,
      editorTabs: plugin.editorTabs,
      dashboardWidgets: plugin.dashboardWidgets,
      settingsPages: plugin.settingsPages,
      settings: dbRecord?.settings ?? {},
      installedAt: dbRecord?.installed_at ?? null,
    },
  })
})

// Update plugin settings
pluginRoutes.patch('/admin/plugins/:name/settings', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.param('name')
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const body = await c.req.json<{ settings: Record<string, unknown> }>()
  const sql = getClient()

  await sql`
    INSERT INTO plugin_settings (plugin_name, settings, enabled, trust, version)
    VALUES (${name}, ${JSON.stringify(body.settings)}::jsonb, true, ${plugin.trust}, ${plugin.definition.version})
    ON CONFLICT (plugin_name)
    DO UPDATE SET settings = ${JSON.stringify(body.settings)}::jsonb
  `

  return c.json({ success: true })
})

// Enable plugin
pluginRoutes.post('/admin/plugins/:name/enable', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.param('name')
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const sql = getClient()
  await sql`
    INSERT INTO plugin_settings (plugin_name, enabled, trust, version)
    VALUES (${name}, true, ${plugin.trust}, ${plugin.definition.version})
    ON CONFLICT (plugin_name)
    DO UPDATE SET enabled = true
  `

  plugin.enabled = true
  return c.json({ success: true })
})

// Disable plugin
pluginRoutes.post('/admin/plugins/:name/disable', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.param('name')
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const sql = getClient()
  await sql`
    INSERT INTO plugin_settings (plugin_name, enabled, trust, version)
    VALUES (${name}, false, ${plugin.trust}, ${plugin.definition.version})
    ON CONFLICT (plugin_name)
    DO UPDATE SET enabled = false
  `

  plugin.enabled = false
  return c.json({ success: true })
})

// Uninstall plugin
pluginRoutes.delete('/admin/plugins/:name', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.param('name')
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const sql = getClient()

  // Remove plugin data
  await sql`DELETE FROM plugin_settings WHERE plugin_name = ${name}`
  await sql`DELETE FROM plugin_storage WHERE plugin_name = ${name}`

  // Disable in registry (full removal requires restart)
  plugin.enabled = false

  return c.json({ success: true, message: 'Plugin disabled. Restart the CMS to fully remove.' })
})
