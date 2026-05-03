import type { LoadedPlugin, ConflictResult, CollectionDefinition } from '@kritano/cms/types'

/**
 * Check for conflicts across all plugins that are about to be loaded.
 * A conflict is a hard startup error — the CMS should not start with conflicts.
 */
export function checkConflicts(
  plugins: LoadedPlugin[],
  existingCollections: CollectionDefinition[],
): ConflictResult {
  const routes = new Map<string, string>()       // 'GET /path' → pluginName
  const fieldTypes = new Map<string, string>()    // 'type-name' → pluginName
  const collections = new Map<string, string>()   // 'collection-name' → source
  const adminSections = new Map<string, string>() // '/admin/path' → pluginName
  const errors: string[] = []

  // Pre-populate collections from cms.config.ts
  for (const col of existingCollections) {
    collections.set(col.name, 'cms.config.ts')
  }

  for (const plugin of plugins) {
    const name = plugin.definition.name

    // Check route conflicts
    for (const route of plugin.routes) {
      const key = `${route.method} ${route.path}`
      const existing = routes.get(key)
      if (existing) {
        errors.push(
          `Plugin conflict: "${existing}" and "${name}" both register ${key}`,
        )
      } else {
        routes.set(key, name)
      }
    }

    // Check field type conflicts
    for (const fieldType of plugin.fieldTypes) {
      const existing = fieldTypes.get(fieldType)
      if (existing) {
        errors.push(
          `Plugin conflict: "${existing}" and "${name}" both register field type "${fieldType}"`,
        )
      } else {
        fieldTypes.set(fieldType, name)
      }
    }

    // Check collection conflicts
    for (const col of plugin.collections) {
      const existing = collections.get(col)
      if (existing) {
        errors.push(
          `Plugin conflict: "${name}" tries to register collection "${col}" which already exists (registered by ${existing})`,
        )
      } else {
        collections.set(col, name)
      }
    }

    // Check admin section conflicts
    for (const section of plugin.adminSections) {
      const sectionPath = typeof section === 'string' ? section : section.path
      const existing = adminSections.get(sectionPath)
      if (existing) {
        errors.push(
          `Plugin conflict: "${existing}" and "${name}" both register admin section at ${sectionPath}`,
        )
      } else {
        adminSections.set(sectionPath, name)
      }
    }
  }

  return { errors, hasConflicts: errors.length > 0 }
}
