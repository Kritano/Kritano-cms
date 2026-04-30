import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js'
import { z } from 'zod'
import type { ApiClient } from '../auth.js'

export function registerContentTools(server: McpServer, client: ApiClient) {
  // Find documents
  server.tool(
    'cms_find_documents',
    'List documents from a specific collection with optional filtering and pagination. Returns paginated results with total count.',
    {
      collection: z.string().describe('Collection name, e.g. "article", "page", "project"'),
      status: z.string().optional().describe('Filter by status: "draft", "published", "scheduled"'),
      search: z.string().optional().describe('Search by title'),
      sort: z.string().optional().describe('Sort field name, e.g. "title", "createdAt"'),
      order: z.enum(['asc', 'desc']).optional().describe('Sort order'),
      limit: z.number().optional().describe('Results per page (max 100)'),
      page: z.number().optional().describe('Page number'),
    },
    async (args) => {
      try {
        const params = new URLSearchParams()
        if (args.status) params.set('status', args.status)
        if (args.search) params.set('search', args.search)
        if (args.sort) params.set('sort', args.sort)
        if (args.order) params.set('order', args.order)
        if (args.limit) params.set('limit', String(args.limit))
        if (args.page) params.set('page', String(args.page))

        const qs = params.toString()
        const result = await client.fetch(`/${args.collection}${qs ? `?${qs}` : ''}`)

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

  // Get single document
  server.tool(
    'cms_get_document',
    'Get a single document by ID or slug from a specific collection. Returns the full document with all fields.',
    {
      collection: z.string().describe('Collection name'),
      id: z.string().optional().describe('Document UUID'),
      slug: z.string().optional().describe('Document slug (alternative to ID)'),
    },
    async (args) => {
      try {
        let result
        if (args.slug) {
          result = await client.fetch(`/${args.collection}/slug/${args.slug}`)
        } else if (args.id) {
          result = await client.fetch(`/${args.collection}/${args.id}`)
        } else {
          return {
            content: [{ type: 'text' as const, text: 'Error: Either id or slug is required' }],
            isError: true,
          }
        }

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

  // Create document
  server.tool(
    'cms_create_document',
    'Create a new document in a collection. The document starts as a draft. Fields should match the collection schema.',
    {
      collection: z.string().describe('Collection name'),
      fields: z.record(z.unknown()).describe('Document fields as key-value pairs matching the collection schema'),
    },
    async (args) => {
      try {
        const result = await client.fetch(`/${args.collection}`, {
          method: 'POST',
          body: JSON.stringify(args.fields),
        })

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

  // Update document
  server.tool(
    'cms_update_document',
    'Update an existing document. Only include fields you want to change — other fields are preserved.',
    {
      collection: z.string().describe('Collection name'),
      id: z.string().describe('Document UUID'),
      fields: z.record(z.unknown()).describe('Fields to update as key-value pairs'),
    },
    async (args) => {
      try {
        const result = await client.fetch(`/${args.collection}/${args.id}`, {
          method: 'PATCH',
          body: JSON.stringify(args.fields),
        })

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

  // Publish document
  server.tool(
    'cms_publish_document',
    'Publish a document, making it visible on the public site. Changes its status from draft to published.',
    {
      collection: z.string().describe('Collection name'),
      id: z.string().describe('Document UUID'),
    },
    async (args) => {
      try {
        const result = await client.fetch(`/${args.collection}/${args.id}/publish`, { method: 'POST' })
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

  // Unpublish document
  server.tool(
    'cms_unpublish_document',
    'Unpublish a document, reverting it to draft status. It will no longer be visible on the public site.',
    {
      collection: z.string().describe('Collection name'),
      id: z.string().describe('Document UUID'),
    },
    async (args) => {
      try {
        const result = await client.fetch(`/${args.collection}/${args.id}/unpublish`, { method: 'POST' })
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

  // Delete document
  server.tool(
    'cms_delete_document',
    'Permanently delete a document from a collection. This cannot be undone.',
    {
      collection: z.string().describe('Collection name'),
      id: z.string().describe('Document UUID'),
    },
    async (args) => {
      try {
        const result = await client.fetch(`/${args.collection}/${args.id}`, { method: 'DELETE' })
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
}
