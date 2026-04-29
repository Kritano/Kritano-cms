import { getClient } from '../db/client'

export interface Permissions {
  '*'?: boolean
  content?: boolean | {
    read?: boolean
    create?: boolean
    update?: boolean
    update_own?: boolean
    delete?: boolean
    publish?: boolean
  }
  media?: boolean | {
    read?: boolean
    upload?: boolean
    delete?: boolean
  }
  users?: boolean
  settings?: boolean
  forms?: boolean
  redirects?: boolean
  webhooks?: boolean
  deployment?: boolean
  collections?: Record<string, Record<string, boolean>>
}

export interface RoleWithPermissions {
  id: string
  name: string
  permissions: Permissions
}

export async function getUserRoles(userId: string): Promise<RoleWithPermissions[]> {
  const sql = getClient()
  const rows = await sql`
    SELECT r.id, r.name, r.permissions
    FROM roles r
    INNER JOIN user_roles ur ON ur.role_id = r.id
    WHERE ur.user_id = ${userId}
  `
  return rows as unknown as RoleWithPermissions[]
}

export function checkPermission(
  roles: RoleWithPermissions[],
  permission: string,
  options?: { collection?: string; userId?: string; documentOwnerId?: string },
): boolean {
  for (const role of roles) {
    const perms = role.permissions

    // Super admin — all access
    if (perms['*'] === true) return true

    // Parse the permission string: "content.create", "media.upload", "users", etc.
    const parts = permission.split('.')
    const category = parts[0] as keyof Permissions
    const action = parts[1]

    const categoryValue = perms[category]
    if (categoryValue === undefined) continue

    // Boolean shorthand: { content: true } grants all content actions
    if (categoryValue === true) {
      // Check collection-level overrides that might deny
      if (options?.collection && perms.collections) {
        const collOverride = perms.collections[options.collection]
        if (collOverride && action && collOverride[action] === false) continue
      }
      return true
    }

    // Object form: { content: { read: true, create: true } }
    if (typeof categoryValue === 'object' && action) {
      const actionValue = (categoryValue as Record<string, boolean>)[action]

      // Handle update_own: if user only has update_own, check document ownership
      if (action === 'update' && !actionValue && (categoryValue as Record<string, boolean>).update_own) {
        if (options?.userId && options?.documentOwnerId && options.userId === options.documentOwnerId) {
          return true
        }
        continue
      }

      if (actionValue === true) {
        // Check collection-level overrides
        if (options?.collection && perms.collections) {
          const collOverride = perms.collections[options.collection]
          if (collOverride && collOverride[action] === false) continue
        }
        return true
      }
    }

    // Check collection-specific overrides that grant permission
    if (options?.collection && perms.collections) {
      const collOverride = perms.collections[options.collection]
      if (collOverride && action && collOverride[action] === true) return true
    }
  }

  return false
}
