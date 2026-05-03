export interface SeoBlock {
  metaTitle: string | null
  metaDescription: string | null
  canonicalUrl: string | null
  ogTitle: string | null
  ogDescription: string | null
  ogImage: string | null
  ogType: 'website' | 'article' | 'profile' | null
  twitterCard: 'summary' | 'summary_large_image' | null
  twitterSite: string | null
  robotsIndex: 'index' | 'noindex' | null
  robotsFollow: 'follow' | 'nofollow' | null
  focusKeyword: string | null
  structuredDataType: 'Article' | 'WebPage' | 'Product' | 'FAQPage' | 'Person' | 'Organization' | null
  // Legacy field — kept for backwards compat
  noIndex?: boolean
}
