import { Hono } from 'hono'

export const robotsRoutes = new Hono()

robotsRoutes.get('/robots.txt', (c) => {
  const siteUrl = process.env.SITE_URL || process.env.ADMIN_URL?.replace('/admin', '') || 'http://localhost:3005'

  const robotsTxt = `# Kritano CMS — robots.txt
User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

# Allow AI crawlers
User-agent: GPTBot
Allow: /

User-agent: ClaudeBot
Allow: /

User-agent: PerplexityBot
Allow: /

User-agent: Google-Extended
Allow: /

Sitemap: ${siteUrl}/api/sitemap.xml
`

  return new Response(robotsTxt, {
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, max-age=86400',
    },
  })
})
