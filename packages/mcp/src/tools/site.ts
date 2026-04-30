import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import type { ApiClient } from '../auth.js'

export function registerSiteTools(server: McpServer, client: ApiClient) {
  server.tool(
    'cms_site_info',
    'Get information about the CMS site including name, URL, health status, and available collections.',
    async () => {
      try {
        const health = await client.fetch('/health')

        // Discover collections
        const collections: string[] = []
        const commonNames = ['page', 'article', 'project', 'post', 'blog']
        for (const name of commonNames) {
          try {
            await client.fetch(`/${name}?limit=0`)
            collections.push(name)
          } catch {
            // Not found — skip
          }
        }

        return {
          content: [{
            type: 'text' as const,
            text: JSON.stringify({
              url: client.baseUrl,
              health: health,
              collections,
              apiEndpoints: {
                rest: `${client.baseUrl}/api`,
                graphql: `${client.baseUrl}/api/graphql`,
              },
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
