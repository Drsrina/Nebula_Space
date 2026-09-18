/**
 * pluginManager.ts — Nebula Plugin System v2.6
 *
 * Gerencia o ciclo de vida de extensões e plugins do frontend.
 * Plugins são consultados via /api/plugins e podem registrar
 * novos tipos de janela, comandos na Command Palette e itens no TopBar Hub.
 */

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description?: string;
  author?: string;
  icon?: string;
  windowTypes?: Array<{
    type: string;
    title: string;
    defaultWidth?: number;
    defaultHeight?: number;
  }>;
  commands?: Array<{
    id: string;
    label: string;
  }>;
}

class PluginManager {
  private plugins: PluginManifest[] = [];
  private customWindowTypes = new Map<string, { title: string; defaultWidth: number; defaultHeight: number }>();
  private customCommands = new Map<string, { id: string; label: string; action: () => void }>();

  async loadPlugins(): Promise<PluginManifest[]> {
    try {
      const token = sessionStorage.getItem('nebula_token') || '';
      const resp = await fetch('/api/plugins', {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!resp.ok) return [];
      const list: PluginManifest[] = await resp.json();
      this.plugins = list;

      for (const p of list) {
        if (p.windowTypes) {
          for (const wt of p.windowTypes) {
            this.registerWindowType(wt.type, {
              title: wt.title,
              defaultWidth: wt.defaultWidth || 600,
              defaultHeight: wt.defaultHeight || 450,
            });
          }
        }
      }

      console.log(`[Nebula Plugins] ${list.length} plugins carregados.`);
      return list;
    } catch (err) {
      console.warn('[Nebula Plugins] Falha ao carregar plugins do servidor:', err);
      return [];
    }
  }

  registerWindowType(
    type: string,
    meta: { title: string; defaultWidth: number; defaultHeight: number }
  ) {
    this.customWindowTypes.set(type, meta);
  }

  registerCommand(id: string, label: string, action: () => void) {
    this.customCommands.set(id, { id, label, action });
  }

  getPlugins(): PluginManifest[] {
    return this.plugins;
  }

  getCustomWindowTypes() {
    return Array.from(this.customWindowTypes.entries());
  }

  getCustomCommands() {
    return Array.from(this.customCommands.values());
  }
}

export const pluginManager = new PluginManager();
