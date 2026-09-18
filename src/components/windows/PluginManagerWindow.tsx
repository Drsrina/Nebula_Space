import React, { useState, useEffect } from 'react';
import { Puzzle, RefreshCw, Package, ExternalLink, CheckCircle2, ShieldCheck, Search, Info, Terminal, Layout } from 'lucide-react';

interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
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
  path?: string;
}

export const PluginManagerWindow: React.FC = () => {
  const [plugins, setPlugins] = useState<PluginManifest[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  const fetchPlugins = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('nebula_token') || sessionStorage.getItem('nebula_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/plugins', { headers });
      if (res.ok) {
        const data = await res.json();
        setPlugins(Array.isArray(data) ? data : []);
      } else {
        setStatusMessage('Não foi possível carregar os plugins.');
      }
    } catch (err: any) {
      setStatusMessage(`Erro: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReload = async () => {
    setIsLoading(true);
    try {
      const token = localStorage.getItem('nebula_token') || sessionStorage.getItem('nebula_token') || '';
      const headers: Record<string, string> = {};
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/plugins/reload', { method: 'POST', headers });
      if (res.ok) {
        const data = await res.json();
        setPlugins(data.plugins || []);
        setStatusMessage('Plugins recarregados do disco com sucesso!');
        setTimeout(() => setStatusMessage(null), 3000);
      }
    } catch (err: any) {
      setStatusMessage(`Erro ao recarregar: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchPlugins();
  }, []);

  const filtered = plugins.filter(
    (p) =>
      p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.id.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-slate-200 select-text">
      {/* Header Bar */}
      <div className="flex items-center justify-between gap-3 px-4 py-3 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-indigo-500/20 text-indigo-400 rounded-lg border border-indigo-500/30">
            <Puzzle className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-sm font-semibold text-white leading-tight">Plugin Manager</h2>
            <p className="text-[11px] text-slate-400">Extensões ativas em data/plugins</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-2 text-slate-400" />
            <input
              type="text"
              placeholder="Buscar plugins..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="text-xs bg-slate-800/80 border border-white/10 rounded-lg pl-8 pr-3 py-1 text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500 w-48"
            />
          </div>

          <button
            onClick={handleReload}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1 bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold rounded-lg border border-white/10 transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-indigo-400' : ''}`} />
            <span>Recarregar</span>
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {statusMessage && (
        <div className="px-4 py-2 text-xs bg-indigo-500/20 text-indigo-200 border-b border-indigo-500/30 flex items-center gap-2">
          <Info className="w-4 h-4 text-indigo-400 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {/* Plugins Grid */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && plugins.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-400 gap-2">
            <RefreshCw className="w-6 h-6 animate-spin text-indigo-400" />
            <span className="text-xs">Buscando plugins instalados...</span>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-slate-500 gap-2 border border-dashed border-white/10 rounded-xl">
            <Package className="w-8 h-8 text-slate-600" />
            <p className="text-xs">Nenhum plugin encontrado.</p>
            <span className="text-[11px] text-slate-500">Adicione pastas com plugin.json em data/plugins/</span>
          </div>
        ) : (
          filtered.map((plugin) => (
            <div
              key={plugin.id}
              className="bg-slate-900/40 hover:bg-slate-900/70 border border-white/10 rounded-xl p-4 transition-all duration-200"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="p-2.5 bg-gradient-to-br from-indigo-500/20 to-purple-500/20 text-indigo-300 rounded-lg border border-indigo-500/30 mt-0.5">
                    <Package className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-bold text-white">{plugin.name}</h3>
                      <span className="text-[10px] font-mono px-2 py-0.5 bg-indigo-500/10 text-indigo-300 border border-indigo-500/20 rounded-full">
                        v{plugin.version}
                      </span>
                      <span className="text-[10px] font-mono text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
                        <CheckCircle2 className="w-2.5 h-2.5" />
                        Ativo
                      </span>
                    </div>
                    <p className="text-xs text-slate-300 mt-1 leading-relaxed">{plugin.description}</p>
                    <div className="flex items-center gap-3 mt-2 text-[11px] text-slate-400">
                      <span>Autor: <strong className="text-slate-300">{plugin.author}</strong></span>
                      <span>ID: <code className="text-slate-300 font-mono">{plugin.id}</code></span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Capabilities & Extension Points */}
              <div className="mt-3 pt-3 border-t border-white/5 flex flex-wrap gap-4 text-xs">
                {plugin.windowTypes && plugin.windowTypes.length > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Layout className="w-3.5 h-3.5 text-sky-400" />
                    <span>Janelas registradas:</span>
                    <div className="flex gap-1">
                      {plugin.windowTypes.map((w) => (
                        <span key={w.type} className="text-[10px] font-mono bg-sky-500/10 text-sky-300 px-1.5 py-0.5 rounded">
                          {w.title}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {plugin.commands && plugin.commands.length > 0 && (
                  <div className="flex items-center gap-1.5 text-slate-300">
                    <Terminal className="w-3.5 h-3.5 text-amber-400" />
                    <span>Comandos:</span>
                    <div className="flex gap-1">
                      {plugin.commands.map((c) => (
                        <span key={c.id} className="text-[10px] font-mono bg-amber-500/10 text-amber-300 px-1.5 py-0.5 rounded">
                          {c.label}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
