import { $ } from 'bun'
import { readFileSync, writeFileSync, existsSync, readdirSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { log } from '../utils/logger'
import { getProjectRoot, loadConfig } from '../utils/config'
import { checkVersionCompatibility } from '@kritano/cms/core'

const CMS_VERSION = '0.3.0'

// ── plugin:install ──────────────────────────────────────────────────────────

export async function pluginInstall() {
  const packageName = process.argv[3]
  if (!packageName) {
    log.error('Usage: cms plugin:install <package>')
    process.exit(1)
  }

  log.header(`Installing plugin: ${packageName}`)

  // 1. Fetch plugin info from npm
  log.step('Fetching plugin metadata from npm…')
  let npmMeta: NpmPackageInfo
  try {
    npmMeta = await fetchNpmPackageInfo(packageName)
  } catch (err) {
    log.error(`Could not find "${packageName}" on npm: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  const pluginVersion = npmMeta.version
  const cmsMeta = npmMeta.cms

  // 2. Check CMS version compatibility
  if (cmsMeta) {
    const warning = checkVersionCompatibility(packageName, cmsMeta, CMS_VERSION)
    if (warning) {
      log.warn(warning)
      const confirmed = await promptYesNo('Install anyway?', false)
      if (!confirmed) {
        log.info('Installation cancelled.')
        process.exit(0)
      }
    }
  }

  // 3. Check requires — prompt to install missing dependencies
  const requires: string[] = npmMeta.requires ?? []
  if (requires.length > 0) {
    const config = await loadConfig()
    const existingPlugins = (config.plugins ?? []).map((p) =>
      typeof p === 'string' ? p : Array.isArray(p) ? p[0] : p.name,
    )

    const missing = requires.filter((dep) => !existingPlugins.includes(dep))

    if (missing.length > 0) {
      for (const dep of missing) {
        log.warn(`${packageName} requires ${dep} which is not installed.`)
      }
      const confirmed = await promptYesNo(
        `Install ${missing.join(', ')} as well?`,
        true,
      )
      if (confirmed) {
        for (const dep of missing) {
          log.step(`Installing dependency: ${dep}`)
          await $`bun add ${dep}`
          addPluginToConfig(dep)
          log.success(`${dep} installed`)
        }
      } else {
        log.warn('Dependencies not installed. Plugin may not work correctly.')
      }
    }
  }

  // 4. Install the package
  log.step(`Running bun add ${packageName}…`)
  try {
    await $`bun add ${packageName}`
  } catch (err) {
    log.error(`Failed to install: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }

  // 5. Add to cms.config.ts
  log.step('Adding to cms.config.ts…')
  const added = addPluginToConfig(packageName)
  if (added) {
    log.success('Added to cms.config.ts')
  } else {
    log.info('Already in cms.config.ts')
  }

  // 6. Regenerate types
  log.step('Regenerating types…')
  try {
    const { generate } = await import('./generate')
    await generate()
  } catch {
    log.warn('Type generation skipped')
  }

  // 7. Determine trust tier
  const trust = packageName.startsWith('@cms-plugin/') ? 'trusted' : 'sandboxed'

  log.success(`${packageName}@${pluginVersion} installed (${trust}). Restart the CMS to activate.`)
}

// ── plugin:remove ───────────────────────────────────────────────────────────

export async function pluginRemove() {
  const packageName = process.argv[3]
  if (!packageName) {
    log.error('Usage: cms plugin:remove <package>')
    process.exit(1)
  }

  log.header(`Removing plugin: ${packageName}`)

  // 1. Check if other plugins depend on this one
  const config = await loadConfig()
  const pluginEntries = config.plugins ?? []

  for (const entry of pluginEntries) {
    const name = typeof entry === 'string' ? entry : Array.isArray(entry) ? entry[0] : entry.name
    if (name === packageName) continue

    try {
      const mod = await import(name)
      const def = mod.default ?? mod
      if (def.requires?.includes(packageName)) {
        log.warn(`${name} requires this plugin.`)
        const confirmed = await promptYesNo('Remove anyway?', false)
        if (!confirmed) {
          log.info('Removal cancelled.')
          process.exit(0)
        }
        break
      }
    } catch {
      // Can't load the plugin to check — skip
    }
  }

  // 2. Remove from cms.config.ts
  log.step('Removing from cms.config.ts…')
  removePluginFromConfig(packageName)
  log.success('Removed from cms.config.ts')

  // 3. Run bun remove
  log.step(`Running bun remove ${packageName}…`)
  try {
    await $`bun remove ${packageName}`
  } catch {
    log.warn('Package may not have been in node_modules')
  }

  log.success(`${packageName} removed. Restart the CMS to deactivate.`)
}

// ── plugin:list ─────────────────────────────────────────────────────────────

export async function pluginList() {
  log.header('Installed plugins')
  console.log('')

  const config = await loadConfig()
  const pluginEntries = config.plugins ?? []

  // Also check local plugins
  const root = getProjectRoot()
  const localDir = resolve(root, 'plugins')
  const localPlugins: string[] = []

  if (existsSync(localDir)) {
    const entries = readdirSync(localDir, { withFileTypes: true })
    for (const entry of entries) {
      if (entry.isDirectory()) {
        const indexPath = join(localDir, entry.name, 'index.ts')
        if (existsSync(indexPath)) localPlugins.push(entry.name)
      } else if (entry.name.endsWith('.ts')) {
        localPlugins.push(entry.name.replace('.ts', ''))
      }
    }
  }

  if (pluginEntries.length === 0 && localPlugins.length === 0) {
    console.log('  No plugins installed.')
    console.log('')
    console.log('  Install a plugin:')
    console.log('    cms plugin:install @cms-plugin/newsletter')
    console.log('')
    return
  }

  // Process config entries
  for (const entry of pluginEntries) {
    const name = typeof entry === 'string' ? entry : Array.isArray(entry) ? entry[0] : entry.name
    const overrides = Array.isArray(entry) ? entry[1] : undefined

    let version = '-'
    let description = ''
    let trust = 'sandboxed'
    let versionWarning = ''

    // Try to load plugin info
    try {
      const mod = await import(name)
      const def = mod.default ?? mod
      version = def.version ?? '-'
      description = def.description ?? ''

      // Determine trust
      if (overrides?.trust) {
        trust = overrides.trust
      } else if (name.startsWith('@cms-plugin/')) {
        trust = 'trusted'
      } else if (def.trust) {
        trust = def.trust
      }

      // Check version compatibility
      if (def.cms) {
        const warning = checkVersionCompatibility(name, def.cms, CMS_VERSION)
        if (warning) versionWarning = ' \x1b[33m⚠ version warning\x1b[0m'
      }
    } catch {
      description = '(unable to load)'
    }

    const enabledStr = 'enabled'
    const line = `  ${padRight(name, 30)} ${padRight(version, 8)} ${padRight(enabledStr, 10)} ${padRight(trust, 12)}${versionWarning} ${description}`
    console.log(line)
  }

  // Local plugins
  for (const name of localPlugins) {
    const pluginPath = join(localDir, name, 'index.ts')
    const altPath = join(localDir, `${name}.ts`)
    const path = existsSync(pluginPath) ? pluginPath : altPath

    let version = '-'
    let description = ''

    try {
      const mod = await import(path)
      const def = mod.default ?? mod
      version = def.version ?? '-'
      description = def.description ?? ''
    } catch {
      description = '(unable to load)'
    }

    const line = `  ${padRight(name, 30)} ${padRight(version, 8)} ${padRight('enabled', 10)} ${padRight('local', 12)} ${description}`
    console.log(line)
  }

  console.log('')
}

// ── plugin:enable / plugin:disable ──────────────────────────────────────────

export async function pluginEnable() {
  const name = process.argv[3]
  if (!name) {
    log.error('Usage: cms plugin:enable <name>')
    process.exit(1)
  }

  log.step(`Enabling ${name}…`)

  // Update database
  try {
    const { getClient } = await import('@kritano/cms/core')
    const sql = getClient()
    await sql`
      INSERT INTO plugin_settings (plugin_name, enabled)
      VALUES (${name}, true)
      ON CONFLICT (plugin_name)
      DO UPDATE SET enabled = true
    `
    log.success(`${name} enabled. Restart the CMS to activate.`)
  } catch (err) {
    log.error(`Failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

export async function pluginDisable() {
  const name = process.argv[3]
  if (!name) {
    log.error('Usage: cms plugin:disable <name>')
    process.exit(1)
  }

  log.step(`Disabling ${name}…`)

  try {
    const { getClient } = await import('@kritano/cms/core')
    const sql = getClient()
    await sql`
      INSERT INTO plugin_settings (plugin_name, enabled)
      VALUES (${name}, false)
      ON CONFLICT (plugin_name)
      DO UPDATE SET enabled = false
    `
    log.success(`${name} disabled. Restart the CMS to deactivate.`)
  } catch (err) {
    log.error(`Failed: ${err instanceof Error ? err.message : err}`)
    process.exit(1)
  }
}

// ── Helpers ─────────────────────────────────────────────────────────────────

interface NpmPackageInfo {
  version: string
  cms?: { minVersion: string; maxVersion?: string }
  requires?: string[]
}

async function fetchNpmPackageInfo(packageName: string): Promise<NpmPackageInfo> {
  const registryUrl = `https://registry.npmjs.org/${encodeURIComponent(packageName)}/latest`
  const res = await fetch(registryUrl)
  if (!res.ok) {
    throw new Error(`npm returned ${res.status}`)
  }
  const data = await res.json() as Record<string, unknown>
  return {
    version: data.version as string,
    cms: data.cms as NpmPackageInfo['cms'],
    requires: (data.cmsRequires ?? data.requires) as string[] | undefined,
  }
}

async function promptYesNo(message: string, defaultYes: boolean): Promise<boolean> {
  const suffix = defaultYes ? '[Y/n]' : '[y/N]'
  process.stdout.write(`  ${message} ${suffix} `)

  const buf = Buffer.alloc(64)
  const fd = require('node:fs').openSync('/dev/stdin', 'r')
  const bytesRead = require('node:fs').readSync(fd, buf, 0, 64, null)
  require('node:fs').closeSync(fd)

  const answer = buf.toString('utf-8', 0, bytesRead).trim().toLowerCase()

  if (answer === '') return defaultYes
  return answer === 'y' || answer === 'yes'
}

function addPluginToConfig(packageName: string): boolean {
  const root = getProjectRoot()
  const configPath = resolve(root, 'cms.config.ts')
  let content = readFileSync(configPath, 'utf-8')

  // Check if already present
  if (content.includes(`'${packageName}'`) || content.includes(`"${packageName}"`)) {
    return false
  }

  // Check if plugins array exists
  if (content.includes('plugins:')) {
    // Add to existing plugins array — find the closing bracket
    content = content.replace(
      /plugins:\s*\[/,
      `plugins: [\n    '${packageName}',`,
    )
  } else {
    // Add plugins array before the closing }) of defineConfig
    const lastClose = content.lastIndexOf('})')
    if (lastClose !== -1) {
      content = content.slice(0, lastClose) + `  plugins: [\n    '${packageName}',\n  ],\n` + content.slice(lastClose)
    }
  }

  writeFileSync(configPath, content, 'utf-8')
  return true
}

function removePluginFromConfig(packageName: string): void {
  const root = getProjectRoot()
  const configPath = resolve(root, 'cms.config.ts')
  let content = readFileSync(configPath, 'utf-8')

  // Remove the plugin entry — handles various formats:
  // 'package-name',
  // "package-name",
  // ['package-name', { ... }],
  const patterns = [
    new RegExp(`\\s*'${escapeRegex(packageName)}'\\s*,?\\s*\\n?`, 'g'),
    new RegExp(`\\s*"${escapeRegex(packageName)}"\\s*,?\\s*\\n?`, 'g'),
    new RegExp(`\\s*\\['${escapeRegex(packageName)}'\\s*,\\s*\\{[^}]*\\}\\]\\s*,?\\s*\\n?`, 'g'),
    new RegExp(`\\s*\\["${escapeRegex(packageName)}"\\s*,\\s*\\{[^}]*\\}\\]\\s*,?\\s*\\n?`, 'g'),
  ]

  for (const pattern of patterns) {
    content = content.replace(pattern, '\n')
  }

  // Clean up empty plugins array
  content = content.replace(/plugins:\s*\[\s*\]\s*,?\s*\n?/g, '')

  writeFileSync(configPath, content, 'utf-8')
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function padRight(str: string, len: number): string {
  return str.padEnd(len)
}

// Run directly
if (import.meta.main) {
  const subcommand = process.argv[2]
  switch (subcommand) {
    case 'install': await pluginInstall(); break
    case 'remove': await pluginRemove(); break
    case 'list': await pluginList(); break
    case 'enable': await pluginEnable(); break
    case 'disable': await pluginDisable(); break
    default:
      log.error(`Unknown plugin subcommand: ${subcommand}`)
      console.log('  Available: install, remove, list, enable, disable')
      process.exit(1)
  }
}
