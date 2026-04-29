const API_URL = import.meta.env.CMS_API_URL || 'http://localhost:3001/api'

export async function fetchAPI<T = any>(path: string): Promise<T> {
  const res = await fetch(`${API_URL}${path}`)
  if (!res.ok) throw new Error(`API error: ${res.status}`)
  return res.json()
}
