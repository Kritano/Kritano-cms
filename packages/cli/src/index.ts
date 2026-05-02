#!/usr/bin/env bun

import { log } from './utils/logger'

const command = process.argv[2]

async function main() {
  switch (command) {
    case 'create': {
      const { create } = await import('./commands/create')
      await create()
      break
    }
    case 'dev': {
      const { dev } = await import('./commands/dev')
      await dev()
      break
    }
    case 'migrate': {
      const { migrate } = await import('./commands/migrate')
      await migrate()
      break
    }
    case 'migrate:create': {
      const { migrateCreate } = await import('./commands/migrate-create')
      await migrateCreate()
      break
    }
    case 'generate': {
      const { generate } = await import('./commands/generate')
      await generate()
      break
    }
    case 'build': {
      const { build } = await import('./commands/build')
      await build()
      break
    }
    case 'search:sync': {
      const { searchSync } = await import('./commands/search')
      await searchSync()
      break
    }
    case 'search:clear': {
      const { searchClear } = await import('./commands/search')
      await searchClear()
      break
    }
    case 'plugin:install': {
      const { pluginInstall } = await import('./commands/plugin')
      await pluginInstall()
      break
    }
    case 'plugin:remove': {
      const { pluginRemove } = await import('./commands/plugin')
      await pluginRemove()
      break
    }
    case 'plugin:list': {
      const { pluginList } = await import('./commands/plugin')
      await pluginList()
      break
    }
    case 'plugin:enable': {
      const { pluginEnable } = await import('./commands/plugin')
      await pluginEnable()
      break
    }
    case 'plugin:disable': {
      const { pluginDisable } = await import('./commands/plugin')
      await pluginDisable()
      break
    }
    case 'mcp': {
      // Start the MCP server — this is used by Claude Desktop, Cursor, etc.
      // It reads CMS_URL and CMS_API_KEY from environment variables
      await import('../../mcp/src/index')
      break
    }
    default: {
      log.header('Kritano CMS CLI')
      console.log('')
      console.log('  Usage: cms <command>')
      console.log('')
      console.log('  Commands:')
      console.log('    create <name>    Scaffold a new site')
      console.log('    dev              Start local dev environment')
      console.log('    migrate          Run pending database migrations')
      console.log('    migrate:create   Generate a new migration from schema changes')
      console.log('    generate         Generate TypeScript types from config')
      console.log('    build            Build the admin UI and frontend')
      console.log('    search:sync      Re-index all published content')
      console.log('    search:clear     Clear all search indexes')
      console.log('    plugin:install   Install a plugin from npm')
      console.log('    plugin:remove    Remove a plugin')
      console.log('    plugin:list      List installed plugins')
      console.log('    plugin:enable    Enable a disabled plugin')
      console.log('    plugin:disable   Disable without uninstalling')
      console.log('    mcp              Start the MCP server (for Claude Desktop / Cursor)')
      console.log('')
      if (command) {
        log.error(`Unknown command: ${command}`)
        process.exit(1)
      }
    }
  }
}

main().catch((err) => {
  log.error(err.message)
  process.exit(1)
})
