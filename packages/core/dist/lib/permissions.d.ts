export interface Permissions {
    '*'?: boolean;
    content?: boolean | {
        read?: boolean;
        create?: boolean;
        update?: boolean;
        update_own?: boolean;
        delete?: boolean;
        publish?: boolean;
    };
    media?: boolean | {
        read?: boolean;
        upload?: boolean;
        delete?: boolean;
    };
    users?: boolean;
    settings?: boolean;
    forms?: boolean;
    redirects?: boolean;
    webhooks?: boolean;
    deployment?: boolean;
    collections?: Record<string, Record<string, boolean>>;
}
export interface RoleWithPermissions {
    id: string;
    name: string;
    permissions: Permissions;
}
export declare function getUserRoles(userId: string): Promise<RoleWithPermissions[]>;
export declare function checkPermission(roles: RoleWithPermissions[], permission: string, options?: {
    collection?: string;
    userId?: string;
    documentOwnerId?: string;
}): boolean;
//# sourceMappingURL=permissions.d.ts.map