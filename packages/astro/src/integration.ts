// Astro integration stub for v0.1
// In production, this reads cms.config.ts and generates routes
// For v0.1, the default theme handles routing manually

export interface CMSIntegrationOptions {
  apiUrl?: string
}

export function cmsIntegration(_options: CMSIntegrationOptions = {}) {
  return {
    name: '@kritano/cms/astro',
    hooks: {
      'astro:config:setup': ({ updateConfig }: any) => {
        // Future: inject routes from cms.config.ts collections
      },
    },
  }
}
