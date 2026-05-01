import { Client } from 'typesense'

let _client: Client | null = null
let _available: boolean | null = null

export interface TypesenseConfig {
  host: string
  port: number
  protocol: string
  apiKey: string
}

export function getTypesenseConfig(): TypesenseConfig | null {
  const apiKey = process.env.TYPESENSE_API_KEY
  if (!apiKey) return null

  return {
    host: process.env.TYPESENSE_HOST || 'localhost',
    port: parseInt(process.env.TYPESENSE_PORT || '8108', 10),
    protocol: process.env.TYPESENSE_PROTOCOL || 'http',
    apiKey,
  }
}

export function getSearchClient(): Client | null {
  if (_available === false) return null

  const config = getTypesenseConfig()
  if (!config) {
    _available = false
    return null
  }

  if (!_client) {
    _client = new Client({
      nodes: [
        {
          host: config.host,
          port: config.port,
          protocol: config.protocol,
        },
      ],
      apiKey: config.apiKey,
      connectionTimeoutSeconds: 5,
    })
  }

  return _client
}

export function isSearchAvailable(): boolean {
  if (_available !== null) return _available
  _available = getTypesenseConfig() !== null
  return _available
}

export async function checkSearchHealth(): Promise<boolean> {
  const client = getSearchClient()
  if (!client) return false

  try {
    await client.health.retrieve()
    _available = true
    return true
  } catch {
    _available = false
    return false
  }
}

export function resetSearchClient(): void {
  _client = null
  _available = null
}
