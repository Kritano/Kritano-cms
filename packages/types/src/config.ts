import type { CollectionDefinition } from './collection'
import type { PluginConfigEntry } from './plugin'

export interface SiteConfig {
  name: string
  domain: string
  language: string
}

export interface CmsConfig {
  site: SiteConfig
  collections: CollectionDefinition[]
  plugins?: PluginConfigEntry[]
}

// ── Theme Config ─────────────────────────────────────────────────────────────

export type ThemeSettingType = 'text' | 'media' | 'colour' | 'select' | 'url' | 'group'

export interface ThemeSettingBase {
  type: ThemeSettingType
  label: string
  default?: unknown
}

export interface ThemeTextSetting extends ThemeSettingBase {
  type: 'text'
  default?: string
}

export interface ThemeMediaSetting extends ThemeSettingBase {
  type: 'media'
}

export interface ThemeColourSetting extends ThemeSettingBase {
  type: 'colour'
  default?: string
}

export interface ThemeSelectSetting extends ThemeSettingBase {
  type: 'select'
  options: string[]
  default?: string
}

export interface ThemeUrlSetting extends ThemeSettingBase {
  type: 'url'
}

export interface ThemeGroupSetting extends ThemeSettingBase {
  type: 'group'
  fields: Record<string, ThemeSetting>
}

export type ThemeSetting =
  | ThemeTextSetting
  | ThemeMediaSetting
  | ThemeColourSetting
  | ThemeSelectSetting
  | ThemeUrlSetting
  | ThemeGroupSetting

export interface ThemeConfig {
  name: string
  version: string
  templates: Record<string, string>
  settings?: Record<string, ThemeSetting>
}

// ── Kritano ──────────────────────────────────────────────────────────────────

export interface KritanoConfig {
  token: string | null
  siteId: string | null
  connectedAt: string | null
}

export interface KritanoHealthScores {
  overall: number
  seo: number
  accessibility: number
  performance: number
  aiVisibility: number | null
}

export interface KritanoAuditEvent {
  event: 'audit.completed'
  siteId: string
  scores: KritanoHealthScores
  auditId: string
  completedAt: string
}
