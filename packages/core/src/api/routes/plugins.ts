import { Hono } from 'hono'
import * as fs from 'node:fs'
import * as path from 'node:path'
import { getClient } from '../../db/client'
import { requireAuth } from '../middleware/auth'
import type { AuthEnv } from '../middleware/auth'
import { requirePermission } from '../middleware/permission'
import { getPluginRegistry } from '../../plugins/registry'

export const pluginRoutes = new Hono<AuthEnv>()

// Track uninstalled plugins so they're hidden from the list until restart
const uninstalledPlugins = new Set<string>()

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

  const plugins = registry.loaded.filter((p) => !uninstalledPlugins.has(p.definition.name)).map((plugin) => {
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
  const plugins = registry.enabledPlugins.filter((p) => !uninstalledPlugins.has(p.definition.name))

  const sections: Array<{ pluginName: string; label: string; icon: string; path: string; componentUrl?: string }> = []
  const editorTabs: Array<{ pluginName: string; label: string; collection?: string | string[] }> = []
  const dashboardWidgets: Array<{ pluginName: string; label: string; width?: string }> = []
  const settingsPages: Array<{ pluginName: string; label: string }> = []

  for (const plugin of plugins) {
    const name = plugin.definition.name

    for (const section of plugin.adminSections) {
      sections.push({
        pluginName: name,
        label: section.label,
        icon: section.icon || 'puzzle',
        path: section.path,
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

// ── Plugin Registry (must be before :name route) ────────────────────────

const REGISTRY_URL = 'https://raw.githubusercontent.com/Kritano/Kritano-cms/main/plugins.json'
let registryCache: { data: any; fetchedAt: number } | null = null
const CACHE_TTL = 60 * 60 * 1000 // 1 hour

async function fetchRegistry(): Promise<any[]> {
  if (registryCache && Date.now() - registryCache.fetchedAt < CACHE_TTL) {
    return registryCache.data
  }

  try {
    const res = await fetch(REGISTRY_URL, { headers: { 'User-Agent': 'Kritano-CMS' } })
    if (!res.ok) return registryCache?.data ?? []
    const data = await res.json() as { plugins: any[] }
    registryCache = { data: data.plugins ?? [], fetchedAt: Date.now() }
    return registryCache.data
  } catch {
    return registryCache?.data ?? []
  }
}

// List available plugins from registry
pluginRoutes.get('/admin/plugins/available', requireAuth, requirePermission('settings'), async (c) => {
  const available = await fetchRegistry()
  const registry = getPluginRegistry()
  const installed = new Set(registry.loaded.map((p) => p.definition.name))

  const plugins = available.map((p: any) => ({
    ...p,
    installed: installed.has(p.name),
  }))

  return c.json({ plugins })
})

// Install a plugin from GitHub — installs, registers, and activates without restart
pluginRoutes.post('/admin/plugins/install', requireAuth, requirePermission('settings'), async (c) => {
  const body = await c.req.json<{ repo: string; name: string }>()

  if (!body.repo) {
    return c.json({ error: { code: 'VALIDATION', message: 'repo is required' } }, 400)
  }

  try {
    // 1. Install from GitHub (run from project root)
    const projectRoot = process.cwd()
    const proc = Bun.spawn(['bun', 'add', `github:${body.repo}`], {
      cwd: projectRoot,
      stdout: 'ignore',
      stderr: 'ignore',
    })
    await proc.exited

    // 2. Send response BEFORE modifying cms.config.ts
    // (bun --watch restarts the server when config changes, killing in-flight requests)
    const response = c.json({
      success: true,
      message: 'Plugin installed successfully.',
    })

    // 3. Add to cms.config.ts after response is queued (deferred so response sends first)
    setTimeout(() => {
      if (!body.name) return
      try {
        const configPath = path.resolve(projectRoot, 'cms.config.ts')
        let content = fs.readFileSync(configPath, 'utf-8')

        if (!content.includes(body.name)) {
          if (content.includes('plugins:')) {
            content = content.replace(/plugins:\s*\[/, `plugins: [\n    '${body.name}',`)
          } else {
            const lastClose = content.lastIndexOf('})')
            if (lastClose !== -1) {
              content = content.slice(0, lastClose) + `  plugins: [\n    '${body.name}',\n  ],\n` + content.slice(lastClose)
            }
          }
          fs.writeFileSync(configPath, content, 'utf-8')
          console.log(`[CMS] Added ${body.name} to cms.config.ts`)
        }
      } catch (err) {
        console.warn(`[CMS] Failed to update cms.config.ts: ${err}`)
      }
    }, 100)

    return response
  } catch (err) {
    return c.json({
      error: { code: 'INSTALL_FAILED', message: err instanceof Error ? err.message : 'Installation failed' },
    }, 500)
  }
})

// Get plugin detail + current settings (name via query param to handle scoped packages)
pluginRoutes.get('/admin/plugins/detail', requireAuth, requirePermission('settings'), async (c) => {
  const name = c.req.query('name')
  if (!name) return c.json({ error: { code: 'VALIDATION', message: 'name query param required' } }, 400)
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
pluginRoutes.post('/admin/plugins/settings', requireAuth, requirePermission('settings'), async (c) => {
  const bodyRaw = await c.req.json<{ name: string; settings: Record<string, unknown> }>()
  const name = bodyRaw.name
  const registry = getPluginRegistry()
  const plugin = registry.get(name)

  if (!plugin) {
    return c.json({ error: { code: 'NOT_FOUND', message: 'Plugin not found' } }, 404)
  }

  const sql = getClient()

  await sql`
    INSERT INTO plugin_settings (plugin_name, settings, enabled, trust, version)
    VALUES (${name}, ${JSON.stringify(bodyRaw.settings)}::jsonb, true, ${plugin.trust}, ${plugin.definition.version})
    ON CONFLICT (plugin_name)
    DO UPDATE SET settings = ${JSON.stringify(bodyRaw.settings)}::jsonb
  `

  return c.json({ success: true })
})

// Enable plugin — name in body to avoid URL encoding issues with scoped packages
pluginRoutes.post('/admin/plugins/enable', requireAuth, requirePermission('settings'), async (c) => {
  const { name } = await c.req.json<{ name: string }>()
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
pluginRoutes.post('/admin/plugins/disable', requireAuth, requirePermission('settings'), async (c) => {
  const { name } = await c.req.json<{ name: string }>()
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

// Uninstall plugin — removes package, cleans config, disables in registry
pluginRoutes.post('/admin/plugins/uninstall', requireAuth, requirePermission('settings'), async (c) => {
  const body = await c.req.json<{ name: string }>()
  const name = body?.name

  if (!name) {
    return c.json({ error: { code: 'VALIDATION', message: 'Plugin name is required' } }, 400)
  }

  const projectRoot = process.cwd()
  const log: string[] = []

  // 1. Remove plugin data from database
  try {
    const sql = getClient()
    await sql`DELETE FROM plugin_settings WHERE plugin_name = ${name}`
    await sql`DELETE FROM plugin_storage WHERE plugin_name = ${name}`
  } catch {}

  // 2. Disable in registry and mark as uninstalled
  try {
    const registry = getPluginRegistry()
    const plugin = registry.get(name)
    if (plugin) plugin.enabled = false
  } catch {}
  uninstalledPlugins.add(name)

  // 3. Send response FIRST — before touching any files that trigger --watch restart
  const response = c.json({ success: true, message: 'Plugin uninstalled.' })

  // 4. Defer all file changes so response sends before server restarts
  setTimeout(() => {
    // Remove from cms.config.ts
    try {
      const configPath = path.resolve(projectRoot, 'cms.config.ts')
      let content = fs.readFileSync(configPath, 'utf-8')
      const escaped = name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
      content = content.replace(new RegExp(`\\s*'${escaped}'\\s*,?\\s*\\n?`, 'g'), '\n')
      content = content.replace(new RegExp(`\\s*"${escaped}"\\s*,?\\s*\\n?`, 'g'), '\n')
      content = content.replace(/plugins:\s*\[\s*\]\s*,?\s*\n?/g, '')
      fs.writeFileSync(configPath, content, 'utf-8')
    } catch {}

    // Remove from package.json
    try {
      const pkgPath = path.resolve(projectRoot, 'package.json')
      const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
      if (pkg.dependencies?.[name]) {
        delete pkg.dependencies[name]
        fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n', 'utf-8')
      }
    } catch {}

    // Remove from node_modules
    try {
      const pkgDir = path.resolve(projectRoot, 'node_modules', ...name.split('/'))
      fs.rmSync(pkgDir, { recursive: true, force: true })
    } catch {}

    console.log(`[CMS] Uninstalled ${name}`)
  }, 200)

  return response
})

