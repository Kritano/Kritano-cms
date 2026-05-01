import type { CmsConfig } from '@kritano/cms/types'
import {
  collectionToTable,
  collectionToTableName,
  fieldToColumn,
  generateCreateTableSQL,
  generateFullSchemaSQL,
  type TableDefinition,
  type ColumnDefinition,
} from './schema-generator'
import { readdir, readFile, writeFile, mkdir } from 'node:fs/promises'
import { join } from 'node:path'

export interface MigrationFile {
  filename: string
  sql: string
  timestamp: number
}

export interface SchemaSnapshot {
  tables: Record<string, TableDefinition>
}

function configToSnapshot(config: CmsConfig): SchemaSnapshot {
  const tables: Record<string, TableDefinition> = {}
  for (const collection of config.collections) {
    const table = collectionToTable(collection)
    tables[table.name] = table
  }
  return { tables }
}

function generateTimestamp(): string {
  const now = new Date()
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`
}

export function generateAlterColumnSQL(
  tableName: string,
  oldCol: ColumnDefinition,
  newCol: ColumnDefinition,
): string[] {
  const stmts: string[] = []

  if (oldCol.sqlType !== newCol.sqlType) {
    stmts.push(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${newCol.name}" TYPE ${newCol.sqlType};`,
    )
  }

  if (oldCol.nullable && !newCol.nullable) {
    stmts.push(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${newCol.name}" SET NOT NULL;`,
    )
  } else if (!oldCol.nullable && newCol.nullable) {
    stmts.push(
      `ALTER TABLE "${tableName}" ALTER COLUMN "${newCol.name}" DROP NOT NULL;`,
    )
  }

  if (oldCol.defaultValue !== newCol.defaultValue) {
    if (newCol.defaultValue !== null) {
      stmts.push(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${newCol.name}" SET DEFAULT ${newCol.defaultValue};`,
      )
    } else {
      stmts.push(
        `ALTER TABLE "${tableName}" ALTER COLUMN "${newCol.name}" DROP DEFAULT;`,
      )
    }
  }

  if (!oldCol.unique && newCol.unique) {
    stmts.push(
      `ALTER TABLE "${tableName}" ADD CONSTRAINT "uq_${tableName}_${newCol.name}" UNIQUE ("${newCol.name}");`,
    )
  } else if (oldCol.unique && !newCol.unique) {
    stmts.push(
      `ALTER TABLE "${tableName}" DROP CONSTRAINT IF EXISTS "uq_${tableName}_${newCol.name}";`,
    )
  }

  return stmts
}

export function diffSnapshots(
  previous: SchemaSnapshot | null,
  current: SchemaSnapshot,
): string {
  const stmts: string[] = []

  if (!previous) {
    // Initial migration — generate everything
    return '' // handled separately
  }

  // New tables
  for (const [name, table] of Object.entries(current.tables)) {
    if (!previous.tables[name]) {
      stmts.push(generateCreateTableSQL(table))
      stmts.push('')
      stmts.push(`DO $$ BEGIN
  CREATE TRIGGER "set_updated_at_${name}"
    BEFORE UPDATE ON "${name}"
    FOR EACH ROW
    EXECUTE FUNCTION update_updated_at_column();
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;`)
      stmts.push('')
    }
  }

  // Modified tables — new columns and altered columns
  for (const [name, table] of Object.entries(current.tables)) {
    const prevTable = previous.tables[name]
    if (!prevTable) continue

    const prevColMap = new Map(prevTable.columns.map((c) => [c.name, c]))
    const currColMap = new Map(table.columns.map((c) => [c.name, c]))

    // New columns
    for (const col of table.columns) {
      if (!prevColMap.has(col.name)) {
        let addCol = `ALTER TABLE "${name}" ADD COLUMN "${col.name}" ${col.sqlType}`
        if (!col.nullable) addCol += ' NOT NULL'
        if (col.defaultValue !== null) addCol += ` DEFAULT ${col.defaultValue}`
        if (col.unique) addCol += ' UNIQUE'
        addCol += ';'
        stmts.push(addCol)

        if (col.references) {
          stmts.push(
            `ALTER TABLE "${name}" ADD CONSTRAINT "fk_${name}_${col.name}" FOREIGN KEY ("${col.name}") REFERENCES "${col.references.table}" ("${col.references.column}") ON DELETE SET NULL;`,
          )
        }
      }
    }

    // Altered columns
    for (const col of table.columns) {
      const prevCol = prevColMap.get(col.name)
      if (prevCol) {
        const alterStmts = generateAlterColumnSQL(name, prevCol, col)
        stmts.push(...alterStmts)
      }
    }

    // Dropped columns
    for (const prevCol of prevTable.columns) {
      if (!currColMap.has(prevCol.name)) {
        stmts.push(`ALTER TABLE "${name}" DROP COLUMN IF EXISTS "${prevCol.name}";`)
      }
    }
  }

  // Dropped tables
  for (const name of Object.keys(previous.tables)) {
    if (!current.tables[name]) {
      stmts.push(`DROP TABLE IF EXISTS "${name}" CASCADE;`)
    }
  }

  return stmts.filter((s) => s.trim()).join('\n\n')
}

export async function getMigrationsDir(projectRoot: string): Promise<string> {
  const dir = join(projectRoot, 'migrations')
  await mkdir(dir, { recursive: true })
  return dir
}

export async function listMigrations(migrationsDir: string): Promise<string[]> {
  try {
    const files = await readdir(migrationsDir)
    return files.filter((f) => f.endsWith('.sql')).sort()
  } catch {
    return []
  }
}

export async function getSnapshotPath(migrationsDir: string): Promise<string> {
  return join(migrationsDir, '.snapshot.json')
}

export async function loadSnapshot(migrationsDir: string): Promise<SchemaSnapshot | null> {
  try {
    const snapshotPath = await getSnapshotPath(migrationsDir)
    const content = await readFile(snapshotPath, 'utf-8')
    return JSON.parse(content) as SchemaSnapshot
  } catch {
    return null
  }
}

export async function saveSnapshot(
  migrationsDir: string,
  snapshot: SchemaSnapshot,
): Promise<void> {
  const snapshotPath = await getSnapshotPath(migrationsDir)
  await writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8')
}

export async function createMigration(
  config: CmsConfig,
  projectRoot: string,
): Promise<MigrationFile | null> {
  const migrationsDir = await getMigrationsDir(projectRoot)
  const previousSnapshot = await loadSnapshot(migrationsDir)
  const currentSnapshot = configToSnapshot(config)

  let sql: string

  if (!previousSnapshot) {
    // Initial migration — full schema
    sql = generateFullSchemaSQL(config)
  } else {
    sql = diffSnapshots(previousSnapshot, currentSnapshot)
    if (!sql.trim()) {
      return null // No changes
    }
  }

  const timestamp = generateTimestamp()
  const existingMigrations = await listMigrations(migrationsDir)
  const index = String(existingMigrations.length).padStart(4, '0')
  const filename = `${index}_${timestamp}.sql`

  await writeFile(join(migrationsDir, filename), sql, 'utf-8')
  await saveSnapshot(migrationsDir, currentSnapshot)

  return { filename, sql, timestamp: Date.now() }
}
