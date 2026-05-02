import type { CmsConfig } from '@kritano/cms/types';
import { type TableDefinition, type ColumnDefinition } from './schema-generator';
export interface MigrationFile {
    filename: string;
    sql: string;
    timestamp: number;
}
export interface SchemaSnapshot {
    tables: Record<string, TableDefinition>;
}
export declare function generateAlterColumnSQL(tableName: string, oldCol: ColumnDefinition, newCol: ColumnDefinition): string[];
export declare function diffSnapshots(previous: SchemaSnapshot | null, current: SchemaSnapshot): string;
export declare function getMigrationsDir(projectRoot: string): Promise<string>;
export declare function listMigrations(migrationsDir: string): Promise<string[]>;
export declare function getSnapshotPath(migrationsDir: string): Promise<string>;
export declare function loadSnapshot(migrationsDir: string): Promise<SchemaSnapshot | null>;
export declare function saveSnapshot(migrationsDir: string, snapshot: SchemaSnapshot): Promise<void>;
export declare function createMigration(config: CmsConfig, projectRoot: string): Promise<MigrationFile | null>;
//# sourceMappingURL=migration-generator.d.ts.map