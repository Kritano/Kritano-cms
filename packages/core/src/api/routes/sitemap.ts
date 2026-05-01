import { Hono } from 'hono'
import type { CmsConfig } from '@kritano/cms/types'
import { getClient } from '../../db/client'
import { collectionToTableName } from '../../db/schema-generator'

export function createSitemapRoutes(config: CmsConfig): Hono {
  const app = new Hono()

  app.get('/sitemap.xml', async (c) => {
    const sql = getClient()
    const domain = config.site.domain.replace(/\/$/, '')

    const urls: { loc: string; lastmod: string }[] = []

    // Homepage
    urls.push({ loc: domain, lastmod: new Date().toISOString().split('T')[0] })

    // All published documents across all collections
    for (const collection of config.collections) {
      const tableName = collectionToTableName(collection.name)
      const hasSlug = 'slug' in collection.fields

      const rows = await sql.unsafe(
        `SELECT ${hasSlug ? 'slug,' : ''} updated_at FROM "${tableName}" WHERE status = 'published' ORDER BY updated_at DESC`,
      )

      for (const row of rows) {
        const r = row as Record<string, unknown>
        const path = hasSlug
          ? `/${collection.name}/${r.slug}`
          : `/${collection.name}/${r.id}`
        const lastmod = r.updated_at
          ? new Date(r.updated_at as string).toISOString().split('T')[0]
          : new Date().toISOString().split('T')[0]

        urls.push({ loc: `${domain}${path}`, lastmod })
      }
    }

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `  <url>
    <loc>${escapeXml(u.loc)}</loc>
    <lastmod>${u.lastmod}</lastmod>
  </url>`).join('\n')}
</urlset>`

    c.header('Content-Type', 'application/xml')
    return c.body(xml)
  })

  return app
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}
