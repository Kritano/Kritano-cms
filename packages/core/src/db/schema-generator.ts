import type { CollectionDefinition, FieldDefinition, CmsConfig } from '@kritano/cms/types'

export interface ColumnDefinition {
  name: string
  sqlType: string
  nullable: boolean
  defaultValue: string | null
  unique: boolean
  references: { table: string; column: string } | null
}

export interface TableDefinition {
  name: string
  columns: ColumnDefinition[]
}

const SYSTEM_COLUMNS: ColumnDefinition[] = [
  {
    name: 'id',
    sqlType: 'uuid',
    nullable: false,
    defaultValue: 'gen_random_uuid()',
    unique: true,
    references: null,
  },
  {
    name: 'status',
    sqlType: 'varchar(20)',
    nullable: false,
    defaultValue: "'draft'",
    unique: false,
    references: null,
  },
  {
    name: 'created_at',
    sqlType: 'timestamptz',
    nullable: false,
    defaultValue: 'now()',
    unique: false,
    references: null,
  },
  {
    name: 'updated_at',
    sqlType: 'timestamptz',
    nullable: false,
    defaultValue: 'now()',
    unique: false,
    references: null,
  },
  {
    name: 'published_at',
    sqlType: 'timestamptz',
    nullable: true,
    defaultValue: null,
    unique: false,
    references: null,
  },
  {
    name: 'created_by',
    sqlType: 'uuid',
    nullable: true,
    defaultValue: null,
    unique: false,
    references: { table: 'users', column: 'id' },
  },
  {
    name: 'updated_by',
    sqlType: 'uuid',
    nullable: true,
    defaultValue: null,
    unique: false,
    references: { table: 'users', column: 'id' },
  },
]

export function fieldToColumnName(fieldName: string): string {
  // Convert camelCase to snake_case
  return fieldName.replace(/([A-Z])/g, '_$1').toLowerCase()
}

export function collectionToTableName(collectionName: string): string {
  // Convert kebab-case or camelCase to snake_case, then pluralise
  const snake = collectionName
    .replace(/-/g, '_')
    .replace(/([A-Z])/g, '_$1')
    .toLowerCase()

  // Already plural
  if (snake.endsWith('s') && !snake.endsWith('ss') && !snake.endsWith('us')) return snake

  // Common English plural rules
  if (snake.endsWith('ss') || snake.endsWith('sh') || snake.endsWith('ch') || snake.endsWith('x') || snake.endsWith('z')) {
    return `${snake}es`
  }
  if (snake.endsWith('y') && !/[aeiou]y$/.test(snake)) {
    return `${snake.slice(0, -1)}ies`
  }

  return `${snake}s`
}

export function fieldToColumn(
  fieldName: string,
  field: FieldDefinition,
): ColumnDefinition {
  const colName = fieldToColumnName(fieldName)
  const isNullable = field.nullable === true || !field.required
  const base: ColumnDefinition = {
    name: colName,
    sqlType: '',
    nullable: isNullable,
    defaultValue: field.default !== undefined ? formatDefault(field.default, field.type) : null,
    unique: false,
    references: null,
  }

  switch (field.type) {
    case 'text':
      base.sqlType = 'varchar(255)'
      break
    case 'textarea':
      base.sqlType = 'text'
      break
    case 'richText':
      base.sqlType = 'jsonb'
      break
    case 'slug':
      base.sqlType = 'varchar(255)'
      base.unique = true
      break
    case 'url':
      base.sqlType = 'varchar(2048)'
      break
    case 'number':
      base.sqlType = 'numeric'
      break
    case 'boolean':
      base.sqlType = 'boolean'
      if (base.defaultValue === null) {
        base.defaultValue = 'false'
      }
      break
    case 'datetime':
      base.sqlType = 'timestamptz'
      break
    case 'select':
      base.sqlType = 'varchar(100)'
      break
    case 'multiSelect':
      base.sqlType = 'jsonb'
      break
    case 'media':
      base.sqlType = 'uuid'
      base.references = { table: 'media', column: 'id' }
      break
    case 'relation':
      base.sqlType = 'uuid'
      base.references = { table: collectionToTableName(field.target), column: 'id' }
      break
    case 'seoBlock':
      base.sqlType = 'jsonb'
      break
    case 'blocks':
      base.sqlType = 'jsonb'
      break
    case 'array':
      base.sqlType = 'jsonb'
      break
    case 'colour':
      base.sqlType = 'varchar(20)'
      break
  }

  return base
}

function formatDefault(value: unknown, _fieldType: string): string {
  if (typeof value === 'string') return `'${value}'`
  if (typeof value === 'number') return String(value)
  if (typeof value === 'boolean') return String(value)
  return `'${JSON.stringify(value)}'::jsonb`
}

export function collectionToTable(collection: CollectionDefinition): TableDefinition {
  const tableName = collectionToTableName(collection.name)
  const columns = [...SYSTEM_COLUMNS]

  const systemFieldNames = new Set(['status', 'publishedAt', 'createdAt', 'updatedAt', 'createdBy', 'updatedBy'])

  for (const [fieldName, field] of Object.entries(collection.fields)) {
    // Skip fields that collide with system columns
    if (systemFieldNames.has(fieldName)) continue
    columns.push(fieldToColumn(fieldName, field))
  }

  return { name: tableName, columns }
}

export function generateCreateTableSQL(table: TableDefinition): string {
  const lines: string[] = []
  lines.push(`CREATE TABLE IF NOT EXISTS "${table.name}" (`)

  const colDefs: string[] = []

  for (const col of table.columns) {
    let line = `  "${col.name}" ${col.sqlType}`
    if (col.name === 'id') {
      line += ' PRIMARY KEY'
    }
    if (!col.nullable && col.name !== 'id') {
      line += ' NOT NULL'
    }
    if (col.defaultValue !== null) {
      line += ` DEFAULT ${col.defaultValue}`
    }
    if (col.unique && col.name !== 'id') {
      line += ' UNIQUE'
    }
    colDefs.push(line)
  }

  // Add foreign key constraints
  for (const col of table.columns) {
    if (col.references) {
      colDefs.push(
        `  CONSTRAINT "fk_${table.name}_${col.name}" FOREIGN KEY ("${col.name}") REFERENCES "${col.references.table}" ("${col.references.column}") ON DELETE SET NULL`,
      )
    }
  }

  lines.push(colDefs.join(',\n'))
  lines.push(');')

  return lines.join('\n')
}

export function generateMediaTableSQL(): string {
  return `CREATE TABLE IF NOT EXISTS "media" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "filename" varchar(500) NOT NULL,
  "original_filename" varchar(500) NOT NULL,
  "mime_type" varchar(100) NOT NULL,
  "size" integer NOT NULL,
  "width" integer,
  "height" integer,
  "alt" text,
  "url" varchar(2048) NOT NULL,
  "thumbnail_url" varchar(2048),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);`
}

export function generateUsersTableSQL(): string {
  return `CREATE TABLE IF NOT EXISTS "users" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "email" varchar(255) NOT NULL UNIQUE,
  "password_hash" varchar(255) NOT NULL,
  "name" varchar(255),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);`
}

export function generateSiteSettingsTableSQL(): string {
  return `CREATE TABLE IF NOT EXISTS "site_settings" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "key" varchar(255) NOT NULL UNIQUE,
  "value" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now()
);`
}

export function generateUpdatedAtTriggerSQL(tableName: string): string {
  return `CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_${tableName}"
    BEFORE UPDATE ON "${tableName}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`
}

export function generateFullSchemaSQL(config: CmsConfig): string {
  const parts: string[] = []

  // System tables
  parts.push('-- System tables')
  parts.push(generateUsersTableSQL())
  parts.push('')
  parts.push(generateMediaTableSQL())
  parts.push('')
  parts.push(generateSiteSettingsTableSQL())
  parts.push('')

  // updated_at trigger function
  parts.push('-- Updated at trigger function')
  parts.push(`CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';`)
  parts.push('')

  // System table triggers
  for (const sysTable of ['users', 'media', 'site_settings']) {
    parts.push(`DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_${sysTable}"
    BEFORE UPDATE ON "${sysTable}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`)
    parts.push('')
  }

  // Collection tables
  parts.push('-- Collection tables')
  for (const collection of config.collections) {
    const table = collectionToTable(collection)
    parts.push(generateCreateTableSQL(table))
    parts.push('')
    parts.push(`DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_${table.name}"
    BEFORE UPDATE ON "${table.name}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`)
    parts.push('')
  }

  return parts.join('\n')
}
