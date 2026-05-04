export interface SeoMetaInput {
  // From seoBlock
  metaTitle?: string | null
  metaDescription?: string | null
  canonicalUrl?: string | null
  ogTitle?: string | null
  ogDescription?: string | null
  ogImage?: string | null
  ogType?: string | null
  twitterCard?: string | null
  twitterSite?: string | null
  robotsIndex?: string | null
  robotsFollow?: string | null
  focusKeyword?: string | null
  secondaryKeywords?: string | null
  structuredDataType?: string | null
  noIndex?: boolean

  // Page context
  pageTitle: string
  pageDescription?: string
  pageUrl: string
  siteName: string
  siteUrl: string

  // For structured data
  collection?: string
  publishedAt?: string | null
  updatedAt?: string | null
  authorName?: string | null
}

/**
 * Generate all SEO meta tags as an HTML string.
 * Drop this into your <head> element.
 */
export function generateSeoMeta(input: SeoMetaInput): string {
  const tags: string[] = []

  const title = input.metaTitle || input.pageTitle
  const description = input.metaDescription || input.pageDescription || ''
  const canonical = input.canonicalUrl || input.pageUrl
  const ogTitle = input.ogTitle || title
  const ogDesc = input.ogDescription || description
  const ogType = input.ogType || 'website'
  const ogImage = input.ogImage || ''
  const twitterCard = input.twitterCard || 'summary_large_image'

  // Keywords
  const keywords = [
    input.focusKeyword,
    ...(input.secondaryKeywords ? input.secondaryKeywords.split(',').map(k => k.trim()) : []),
  ].filter(Boolean).join(', ')
  if (keywords) {
    tags.push(`<meta name="keywords" content="${escapeAttr(keywords)}">`)
  }

  // Robots
  const robotsIndex = input.noIndex ? 'noindex' : (input.robotsIndex || 'index')
  const robotsFollow = input.robotsFollow || 'follow'
  tags.push(`<meta name="robots" content="${robotsIndex}, ${robotsFollow}">`)

  // Canonical
  if (canonical) {
    tags.push(`<link rel="canonical" href="${escapeAttr(canonical)}">`)
  }

  // Open Graph
  tags.push(`<meta property="og:type" content="${escapeAttr(ogType)}">`)
  tags.push(`<meta property="og:title" content="${escapeAttr(ogTitle)}">`)
  if (ogDesc) tags.push(`<meta property="og:description" content="${escapeAttr(ogDesc)}">`)
  tags.push(`<meta property="og:url" content="${escapeAttr(canonical)}">`)
  tags.push(`<meta property="og:site_name" content="${escapeAttr(input.siteName)}">`)
  if (ogImage) tags.push(`<meta property="og:image" content="${escapeAttr(ogImage)}">`)
  if (input.collection === 'article' || ogType === 'article') {
    if (input.publishedAt) tags.push(`<meta property="article:published_time" content="${input.publishedAt}">`)
    if (input.updatedAt) tags.push(`<meta property="article:modified_time" content="${input.updatedAt}">`)
  }

  // Twitter Card
  tags.push(`<meta name="twitter:card" content="${escapeAttr(twitterCard)}">`)
  tags.push(`<meta name="twitter:title" content="${escapeAttr(ogTitle)}">`)
  if (ogDesc) tags.push(`<meta name="twitter:description" content="${escapeAttr(ogDesc)}">`)
  if (ogImage) tags.push(`<meta name="twitter:image" content="${escapeAttr(ogImage)}">`)
  if (input.twitterSite) tags.push(`<meta name="twitter:site" content="${escapeAttr(input.twitterSite)}">`)

  return tags.join('\n    ')
}

/**
 * Generate JSON-LD structured data as a <script> tag.
 */
export function generateJsonLd(input: SeoMetaInput): string {
  const title = input.metaTitle || input.pageTitle
  const description = input.metaDescription || input.pageDescription || ''
  const url = input.canonicalUrl || input.pageUrl
  const image = input.ogImage || ''

  // Determine schema type
  let schemaType = input.structuredDataType || autoDetectSchemaType(input.collection)

  const schemas: Record<string, unknown>[] = []

  // BreadcrumbList for all pages
  const breadcrumbs: Array<{ name: string; url: string }> = [
    { name: 'Home', url: input.siteUrl },
  ]
  if (input.collection) {
    breadcrumbs.push({
      name: input.collection.charAt(0).toUpperCase() + input.collection.slice(1) + 's',
      url: `${input.siteUrl}/${input.collection}`,
    })
  }
  breadcrumbs.push({ name: title, url })

  schemas.push({
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: breadcrumbs.map((item, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: item.name,
      item: item.url,
    })),
  })

  // Main schema
  switch (schemaType) {
    case 'Article': {
      const article: Record<string, unknown> = {
        '@context': 'https://schema.org',
        '@type': 'Article',
        headline: title,
        description,
        url,
        datePublished: input.publishedAt || undefined,
        dateModified: input.updatedAt || input.publishedAt || undefined,
        publisher: {
          '@type': 'Organization',
          name: input.siteName,
          url: input.siteUrl,
        },
      }
      if (image) article.image = image
      const articleKeywords = [
        input.focusKeyword,
        ...(input.secondaryKeywords ? input.secondaryKeywords.split(',').map(k => k.trim()) : []),
      ].filter(Boolean).join(', ')
      if (articleKeywords) article.keywords = articleKeywords
      if (input.authorName) {
        article.author = { '@type': 'Person', name: input.authorName }
      }
      schemas.push(article)
      break
    }

    case 'WebPage': {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebPage',
        name: title,
        description,
        url,
        isPartOf: { '@type': 'WebSite', name: input.siteName, url: input.siteUrl },
      })
      break
    }

    case 'Person': {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Person',
        name: title,
        description,
        url,
        ...(image ? { image } : {}),
      })
      break
    }

    case 'Organization': {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: title,
        description,
        url,
        ...(image ? { logo: image } : {}),
      })
      break
    }

    case 'FAQPage': {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'FAQPage',
        name: title,
        description,
        url,
      })
      break
    }

    case 'Product': {
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'Product',
        name: title,
        description,
        url,
        ...(image ? { image } : {}),
      })
      break
    }

    default: {
      // WebSite schema for homepage / fallback
      schemas.push({
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: input.siteName,
        url: input.siteUrl,
        description,
      })
    }
  }

  return schemas
    .map((s) => `<script type="application/ld+json">${JSON.stringify(s)}</script>`)
    .join('\n    ')
}

/**
 * Generate complete SEO head content — meta tags + JSON-LD.
 */
export function generateSeoHead(input: SeoMetaInput): string {
  return `${generateSeoMeta(input)}\n    ${generateJsonLd(input)}`
}

function autoDetectSchemaType(collection?: string): string {
  if (!collection) return 'WebSite'
  const lower = collection.toLowerCase()
  if (lower === 'article' || lower === 'post' || lower === 'blog') return 'Article'
  if (lower === 'page') return 'WebPage'
  if (lower === 'product') return 'Product'
  if (lower === 'person' || lower === 'author' || lower === 'team' || lower === 'teammember') return 'Person'
  if (lower === 'faq') return 'FAQPage'
  return 'WebPage'
}

function escapeAttr(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}
