import { readFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
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

/** Get the CMS package root (where the CMS's own migrations live) */
function getCmsPackageRoot(): string {
  // This file is at packages/core/src/db/migrate.ts
  // CMS root is 4 levels up
  const thisDir = dirname(new URL(import.meta.url).pathname)
  return join(thisDir, '..', '..', '..', '..')
}

async function applyPendingFromDir(
  dir: string,
  prefix: string,
  applied: Set<string>,
  sql: ReturnType<typeof getClient>,
): Promise<string[]> {
  if (!existsSync(dir)) return []

  const allMigrations = await listMigrations(dir)
  const appliedNow: string[] = []

  for (const filename of allMigrations) {
    const key = `${prefix}${filename}`
    if (applied.has(key)) continue

    const filePath = join(dir, filename)
    const content = await readFile(filePath, 'utf-8')

    await sql.begin(async (tx) => {
      await tx.unsafe(content)
      await tx.unsafe(
        `INSERT INTO "${MIGRATIONS_TABLE}" (filename) VALUES ($1)`,
        [key],
      )
    })

    appliedNow.push(key)
  }

  return appliedNow
}

export async function runMigrations(projectRoot: string): Promise<string[]> {
  const sql = getClient()

  await ensureMigrationsTable()
  const applied = await getAppliedMigrations()

  const appliedNow: string[] = []

  // 1. Apply CMS base migrations first (roles, api_keys, plugins, oauth, etc.)
  const cmsRoot = getCmsPackageRoot()
  const cmsMigrationsDir = join(cmsRoot, 'migrations')
  if (cmsMigrationsDir !== join(projectRoot, 'migrations')) {
    const cmsApplied = await applyPendingFromDir(cmsMigrationsDir, 'cms:', applied, sql)
    appliedNow.push(...cmsApplied)
    // Update applied set for project migrations check
    for (const f of cmsApplied) applied.add(f)
  }

  // 2. Apply project migrations (schema-generated from cms.config.ts)
  const projectMigrationsDir = await getMigrationsDir(projectRoot)
  const projectApplied = await applyPendingFromDir(projectMigrationsDir, '', applied, sql)
  appliedNow.push(...projectApplied)

  return appliedNow
}
