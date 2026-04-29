import { readFile } from 'node:fs/promises'
import { join } from 'node:path'
import { getClient } from './client'
import { getMigrationsDir, listMigrations } from './migration-generator'

const MIGRATIONS_TABLE = '_cms_migrations'

async function ensureMigrationsTable(): Promise<void> {
  const sql = getClient()
  await sql.unsafe(`
    CREATE TABLE IF NOT EXISTS "${MIGRATIONS_TABLE}" (
      id serial PRIMARY KEY,
      filename varchar(500) NOT NULL UNIQUE,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function getAppliedMigrations(): Promise<Set<string>> {
  const sql = getClient()
  const rows = await sql.unsafe(
    `SELECT filename FROM "${MIGRATIONS_TABLE}" ORDER BY id`,
  )
  return new Set(rows.map((r) => (r as Record<string, unknown>).filename as string))
}

async function recordMigration(filename: string): Promise<void> {
  const sql = getClient()
  await sql`
    INSERT INTO ${sql(MIGRATIONS_TABLE)} (filename) VALUES (${filename})
  `
}

export async function runMigrations(projectRoot: string): Promise<string[]> {
  const sql = getClient()
  const migrationsDir = await getMigrationsDir(projectRoot)

  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()
  const allMigrations = await listMigrations(migrationsDir)
  const pending = allMigrations.filter((f) => !applied.has(f))

  if (pending.length === 0) {
    return []
  }

  const appliedNow: string[] = []

  for (const filename of pending) {
    const filePath = join(migrationsDir, filename)
    const content = await readFile(filePath, 'utf-8')

    await sql.begin(async (tx) => {
      await tx.unsafe(content)
      await tx.unsafe(
        `INSERT INTO "${MIGRATIONS_TABLE}" (filename) VALUES ($1)`,
        [filename],
      )
    })

    appliedNow.push(filename)
  }

  return appliedNow
}
