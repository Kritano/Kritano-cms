#!/usr/bin/env bun

import { log } from './utils/logger'

const command = process.argv[2]

async function main() {
  switch (command) {
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
      console.log('    dev              Start local dev environment')
      console.log('    migrate          Run pending database migrations')
      console.log('    migrate:create   Generate a new migration from schema changes')
      console.log('    generate         Generate TypeScript types from config')
      console.log('    build            Build the admin UI and frontend')
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
