import type { CmsConfig } from '@kritano/cms/types'
import { getClient } from '../../db/client'
import { collectionToTableName, fieldToColumnName } from '../../db/schema-generator'

export function buildResolvers(config: CmsConfig): { Query: Record<string, Function> } {
  const Query: Record<string, Function> = {}

  for (const collection of config.collections) {
    const tableName = collectionToTableName(collection.name)

    // Single by ID
    Query[collection.name] = async (_: unknown, args: { id: string }) => {
      const sql = getClient()
      const rows = await sql.unsafe(
        `SELECT * FROM "${tableName}" WHERE id = $1 LIMIT 1`,
        [args.id],
      )
      return rows[0] || null
    }

    // Single by slug
    Query[`${collection.name}BySlug`] = async (_: unknown, args: { slug: string }) => {
      const sql = getClient()
      const rows = await sql.unsafe(
        `SELECT * FROM "${tableName}" WHERE slug = $1 LIMIT 1`,
        [args.slug],
      )
      return rows[0] || null
    }

    // List
    Query[`${collection.name}List`] = async (
      _: unknown,
      args: { page?: number; limit?: number; status?: string; sort?: string; order?: string },
    ) => {
      const sql = getClient()
      const page = args.page || 1
      const limit = Math.min(args.limit || 20, 100)
      const offset = (page - 1) * limit
      const sortCol = args.sort ? fieldToColumnName(args.sort) : 'created_at'
      const order = args.order === 'asc' ? 'ASC' : 'DESC'

      const conditions: string[] = []
      const params: any[] = []

      if (args.status) {
        conditions.push(`status = $${params.length + 1}`)
        params.push(args.status)
      }

      const whereClause = conditions.length > 0
        ? `WHERE ${conditions.join(' AND ')}`
        : ''

      const countResult = await sql.unsafe(
        `SELECT COUNT(*) as total FROM "${tableName}" ${whereClause}`,
        params,
      )
      const total = parseInt((countResult[0] as Record<string, unknown>).total as string, 10)

      const rows = await sql.unsafe(
        `SELECT * FROM "${tableName}" ${whereClause} ORDER BY "${sortCol}" ${order} LIMIT ${limit} OFFSET ${offset}`,
        params,
      )

      return {
        data: rows,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      }
    }
  }

  return { Query }
}
