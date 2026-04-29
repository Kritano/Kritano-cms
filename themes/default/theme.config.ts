export default {
  name: 'default',
  version: '0.1.0',
  templates: {
    page: './templates/page.astro',
    article: './templates/article.astro',
    'article-list': './templates/article-list.astro',
    project: './templates/project.astro',
    'project-list': './templates/project-list.astro',
  },
  settings: {
    siteName: { type: 'text' as const, label: 'Site Name' },
    logo: { type: 'media' as const, label: 'Logo' },
    primaryColour: { type: 'colour' as const, label: 'Primary Colour', default: '#0d0d0d' },
    accentColour: { type: 'colour' as const, label: 'Accent Colour', default: '#c84b2f' },
    footerText: { type: 'text' as const, label: 'Footer Text' },
    socialLinks: {
      type: 'group' as const,
      label: 'Social Links',
      fields: {
        twitter: { type: 'url' as const, label: 'X / Twitter' },
        github: { type: 'url' as const, label: 'GitHub' },
        linkedin: { type: 'url' as const, label: 'LinkedIn' },
      },
    },
  },
}
