#!/usr/bin/env bun

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js'
import { z } from 'zod'
import { createApiClient, validateAuth } from './auth.js'
import { registerContentTools } from './tools/content.js'
import { registerSchemaTools } from './tools/schema.js'
import { registerMediaTools } from './tools/media.js'
import { registerSiteTools } from './tools/site.js'

async function main() {
  // Validate environment
  const cmsUrl = process.env.CMS_URL
  const apiKey = process.env.CMS_API_KEY

  if (!cmsUrl) {
    console.error('Error: CMS_URL environment variable is required')
    console.error('Set it to your CMS API URL, e.g. https://mysite.com')
    process.exit(1)
  }

  if (!apiKey) {
    console.error('Error: CMS_API_KEY environment variable is required')
    console.error('Create an API key in the CMS admin under Settings > API Keys')
    process.exit(1)
  }

  // Validate the API key works
  const client = createApiClient(cmsUrl, apiKey)
  const valid = await validateAuth(client)
  if (!valid) {
    console.error('Error: Invalid API key or CMS is unreachable')
    console.error(`Tried: ${cmsUrl}/api/health`)
    process.exit(1)
  }

  // Create MCP server
  const server = new McpServer({
    name: 'kritano-cms',
    version: '0.2.0',
  })

  // Register all tools
  registerSchemaTools(server, client)
  registerContentTools(server, client)
  registerMediaTools(server, client)
  registerSiteTools(server, client)

  // Connect via stdio
  const transport = new StdioServerTransport()
  await server.connect(transport)
}

main().catch((err) => {
  console.error('MCP server failed to start:', err)
  process.exit(1)
})
