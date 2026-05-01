import type { ThemeConfig } from '@kritano/types'

export interface CMSContext {
  doc: Record<string, unknown>
  settings: Record<string, unknown>
  collection: string
}

export type { ThemeConfig }
