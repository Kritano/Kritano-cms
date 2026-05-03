import type {
  LoadedPlugin,
  PluginDefinition,
  PluginTrust,
  PluginHookEvent,
  PluginHookHandler,
  PluginHookOptions,
  AdminSection,
  EditorTab,
  DashboardWidget,
  SettingsPage,
  PluginConfigOverride,
} from '@kritano/cms/types'

export class PluginRegistry {
  private plugins = new Map<string, LoadedPlugin>()
  private _warnings: string[] = []
  private _skipped: string[] = []

  get warnings(): string[] { return this._warnings }
  get skipped(): string[] { return this._skipped }

  get loaded(): LoadedPlugin[] {
    return Array.from(this.plugins.values())
  }

  get enabledPlugins(): LoadedPlugin[] {
    return this.loaded.filter((p) => p.enabled)
  }

  get(name: string): LoadedPlugin | undefined {
    return this.plugins.get(name)
  }

  has(name: string): boolean {
    return this.plugins.has(name)
  }

  register(
    definition: PluginDefinition,
    trust: PluginTrust,
    source: 'npm' | 'local',
    configOverride?: PluginConfigOverride,
  ): LoadedPlugin {
    const plugin: LoadedPlugin = {
      definition,
      trust,
      source,
      enabled: true,
      configOverride,
      routes: [],
      fieldTypes: [],
      collections: [],
      adminSections: [],
      editorTabs: [],
      dashboardWidgets: [],
      settingsPages: [],
      hooks: [],
      graphqlExtensions: [],
      resolvers: [],
      jobHandlers: new Map(),
    }

    this.plugins.set(definition.name, plugin)
    return plugin
  }

  addWarning(message: string): void {
    this._warnings.push(message)
  }

  addSkipped(name: string, reason: string): void {
    this._skipped.push(`${name}: ${reason}`)
  }

  addRoute(pluginName: string, method: string, path: string): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.routes.push({ method: method.toUpperCase(), path })
  }

  addFieldType(pluginName: string, type: string): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.fieldTypes.push(type)
  }

  addCollection(pluginName: string, name: string): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.collections.push(name)
  }

  addAdminSection(pluginName: string, section: AdminSection): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.adminSections.push({ label: section.label, icon: section.icon, path: section.path })
  }

  addEditorTab(pluginName: string, tab: EditorTab): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.editorTabs.push(tab.label)
  }

  addDashboardWidget(pluginName: string, widget: DashboardWidget): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.dashboardWidgets.push(widget.label)
  }

  addSettingsPage(pluginName: string, page: SettingsPage): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.settingsPages.push(page.label)
  }

  addHook(pluginName: string, event: PluginHookEvent, handler: PluginHookHandler, options?: PluginHookOptions): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) {
      plugin.hooks.push({ event, order: options?.order ?? 100, handler })
    }
  }

  addGraphqlExtension(pluginName: string, typeDefs: string): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.graphqlExtensions.push(typeDefs)
  }

  addResolver(pluginName: string, typeName: string, fieldName: string, resolver: unknown): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.resolvers.push({ typeName, fieldName, resolver })
  }

  addJobHandler(pluginName: string, queueName: string, handler: (data: unknown) => Promise<void>): void {
    const plugin = this.plugins.get(pluginName)
    if (plugin) plugin.jobHandlers.set(queueName, handler)
  }

  /** Get all hooks for a given event, sorted by order then registration order */
  getHooksForEvent(event: PluginHookEvent): Array<{ pluginName: string; handler: PluginHookHandler; order: number }> {
    const hooks: Array<{ pluginName: string; handler: PluginHookHandler; order: number }> = []

    for (const [name, plugin] of this.plugins) {
      if (!plugin.enabled) continue
      for (const hook of plugin.hooks) {
        if (hook.event === event) {
          hooks.push({ pluginName: name, handler: hook.handler, order: hook.order })
        }
      }
    }

    return hooks.sort((a, b) => a.order - b.order)
  }

  /** Get all registered collections from all enabled plugins */
  getAllPluginCollections(): string[] {
    return this.enabledPlugins.flatMap((p) => p.collections)
  }

  /** Get all registered GraphQL type extensions */
  getAllGraphqlExtensions(): string[] {
    return this.enabledPlugins.flatMap((p) => p.graphqlExtensions)
  }

  /** Get all registered resolvers */
  getAllResolvers(): Array<{ typeName: string; fieldName: string; resolver: unknown }> {
    return this.enabledPlugins.flatMap((p) => p.resolvers)
  }

  /** Summary for startup log */
  getSummary(): { loaded: number; warnings: number; skipped: number } {
    return {
      loaded: this.enabledPlugins.length,
      warnings: this._warnings.length,
      skipped: this._skipped.length,
    }
  }
}

// Singleton registry
let _registry: PluginRegistry | null = null

export function getPluginRegistry(): PluginRegistry {
  if (!_registry) {
    _registry = new PluginRegistry()
  }
  return _registry
}

export function resetPluginRegistry(): void {
  _registry = null
}
