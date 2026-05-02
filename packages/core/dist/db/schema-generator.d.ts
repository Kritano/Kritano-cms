import type { CollectionDefinition, FieldDefinition, CmsConfig } from '@kritano/cms/types';
export interface ColumnDefinition {
    name: string;
    sqlType: string;
    nullable: boolean;
    defaultValue: string | null;
    unique: boolean;
    references: {
        table: string;
        column: string;
    } | null;
}
export interface TableDefinition {
    name: string;
    columns: ColumnDefinition[];
}
export declare function fieldToColumnName(fieldName: string): string;
export declare function collectionToTableName(collectionName: string): string;
export declare function fieldToColumn(fieldName: string, field: FieldDefinition): ColumnDefinition;
export declare function collectionToTable(collection: CollectionDefinition): TableDefinition;
export declare function generateCreateTableSQL(table: TableDefinition): string;
export declare function generateMediaTableSQL(): string;
export declare function generateUsersTableSQL(): string;
export declare function generateSiteSettingsTableSQL(): string;
export declare function generateUpdatedAtTriggerSQL(tableName: string): string;
export declare function generateFullSchemaSQL(config: CmsConfig): string;
//# sourceMappingURL=schema-generator.d.ts.map