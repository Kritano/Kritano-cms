import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'

let _client: ReturnType<typeof postgres> | null = null
let _db: ReturnType<typeof drizzle> | null = null

export function getConnectionString(): string {
  const url = process.env.DATABASE_URL
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required')
  }
  return url
}

export function getClient(): ReturnType<typeof postgres> {
  if (!_client) {
    _client = postgres(getConnectionString())
  }
  return _client
}

export function getDb(): ReturnType<typeof drizzle> {
  if (!_db) {
    _db = drizzle(getClient())
  }
  return _db
}

export async function closeConnection(): Promise<void> {
  if (_client) {
    await _client.end()
    _client = null
    _db = null
  }
}
