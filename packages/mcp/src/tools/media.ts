import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../auth.js'

export function registerMediaTools(server: McpServer, client: ApiClient) {
  // List media
  server.tool(
    'cms_list_media',
    'List media files in the CMS library with optional pagination and folder filtering.',
    {
      limit: z.number().optional().describe('Results per page (max 100)'),
      page: z.number().optional().describe('Page number'),
      folderId: z.string().optional().describe('Filter by folder ID'),
    },
    async (args) => {
      try {
        const params = new URLSearchParams()
        if (args.limit) params.set('limit', String(args.limit))
        if (args.page) params.set('page', String(args.page))
        if (args.folderId) params.set('folderId', args.folderId)

        const qs = params.toString()
        const result = await client.fetch(`/media${qs ? `?${qs}` : ''}`)

        return {
          content: [{ type: 'text' as const, text: JSON.stringify(result, null, 2) }],
        }
      } catch (err) {
        return {
          content: [{ type: 'text' as const, text: `Error: ${err instanceof Error ? err.message : 'Unknown error'}` }],
          isError: true,
        }
      }
    },
  )

  // Get single media item
  server.tool(
    'cms_get_media',
    'Get details of a specific media file including its URL, dimensions, and metadata.',
    {
      id: z.string().describe('Media UUID'),
    },
    async (args) => {
      try {
        // Use the usage endpoint to get full details
        const usage = await client.fetch(`/media/${args.id}/usage`)
        return {
          content: [{ type: 'text' as const, text: JSON.stringify(usage, null, 2) }],
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
