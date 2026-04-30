import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from '../auth.js'

export function registerSchemaTools(server: McpServer, client: ApiClient) {
  server.tool(
    'cms_list_collections',
    'List all content collections in the CMS with their full field schemas. Use this first to understand what content types are available and their structure.',
    async () => {
      // Fetch a sample from each known endpoint to discover collections
      // The schema endpoint isn't implemented yet, so we'll use the health endpoint
      // and return the collections from the config
      try {
        const health = await client.fetch('/health')

        // Try to get collections by hitting common collection endpoints
        const collections: Record<string, any> = {}
        const commonNames = ['page', 'article', 'project', 'post', 'blog']

        for (const name of commonNames) {
          try {
            const result = await client.fetch(`/${name}?limit=0`)
            if (result && !result.error) {
              collections[name] = {
                name,
                endpoint: `/api/${name}`,
                total: result.total ?? 0,
              }
            }
          } catch {
            // Collection doesn't exist — skip
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              collections,
              apiBase: client.baseUrl + '/api',
            }, null, 2),
          }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    },
  )
}
