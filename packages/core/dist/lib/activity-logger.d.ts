export interface ActivityLogEntry {
    userId: string | null;
    action: string;
    resource: string;
    resourceId?: string | null;
    metadata?: Record<string, unknown> | null;
}
export declare function logActivity(entry: ActivityLogEntry): Promise<void>;
//# sourceMappingURL=activity-logger.d.ts.map