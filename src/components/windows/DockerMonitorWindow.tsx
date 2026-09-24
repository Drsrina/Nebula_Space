import React, { useState, useEffect } from 'react';
import {
  Server,
  Play,
  Square,
  RefreshCw,
  Search,
  Terminal,
  AlertTriangle,
  CheckCircle2,
  Clock,
  Layers,
  Info,
  X,
  Copy,
  Check,
} from 'lucide-react';
import { authFetch } from '../../lib/api';

interface ContainerInfo {
  id: string;
  fullId?: string;
  names: string[];
  image: string;
  command?: string;
  state: string; // running, exited, paused, etc.
  status: string;
  created?: string | number;
  ports?: any;
}

export const DockerMonitorWindow: React.FC = () => {
  const [containers, setContainers] = useState<ContainerInfo[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedLogsId, setSelectedLogsId] = useState<string | null>(null);
  const [logsContent, setLogsContent] = useState<string>('');
  const [isLoadingLogs, setIsLoadingLogs] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const fetchContainers = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await authFetch('/api/docker/containers');
      if (res.ok) {
        const data = await res.json();
        if (data.error && (!data.containers || data.containers.length === 0)) {
          setError(data.error);
        } else {
          setContainers(data.containers || []);
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setError(err.error || 'Falha ao buscar dados do Docker.');
      }
    } catch (err: any) {
      setError(`Erro de conexão com a API do Docker: ${err.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 8000);
    return () => clearInterval(interval);
  }, []);

  const handleAction = async (id: string, action: 'start' | 'stop' | 'restart') => {
    setActionInProgress(`${id}-${action}`);
    try {
      const res = await authFetch('/api/docker/action', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, action }),
      });
      if (res.ok) {
        await fetchContainers();
      } else {
        const err = await res.json().catch(() => ({}));
        alert(`Erro ao executar ${action}: ${err.error || res.statusText}`);
      }
    } catch (err: any) {
      alert(`Falha de comunicação: ${err.message}`);
    } finally {
      setActionInProgress(null);
    }
  };

  const openLogs = async (id: string) => {
    setSelectedLogsId(id);
    setIsLoadingLogs(true);
    setLogsContent('');
    try {
      const res = await authFetch(`/api/docker/logs/${id}`);
      if (res.ok) {
        const data = await res.json();
        setLogsContent(data.logs || 'Sem logs disponíveis.');
      } else {
        setLogsContent('Não foi possível carregar os logs.');
      }
    } catch (err: any) {
      setLogsContent(`Erro: ${err.message}`);
    } finally {
      setIsLoadingLogs(false);
    }
  };

  const copyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const filtered = containers.filter((c) => {
    const term = search.toLowerCase();
    const nameMatch = c.names.some((n) => n.toLowerCase().includes(term));
    const imageMatch = c.image.toLowerCase().includes(term);
    const idMatch = c.id.toLowerCase().includes(term);
    return nameMatch || imageMatch || idMatch;
  });

  const runningCount = containers.filter((c) => c.state === 'running').length;
  const stoppedCount = containers.filter((c) => c.state !== 'running').length;

  return (
    <div className="flex flex-col h-full bg-[#050b17] text-[#e6f0ff] font-sans overflow-hidden">
      {/* Top Header & Stats */}
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 bg-[#081224] border-b border-[#3ba9ff]/20">
        <div className="flex items-center gap-3">
          <div className="p-2 rounded-xl bg-[#6ee7b7]/15 text-[#6ee7b7]">
            <Server className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-xs font-bold font-mono uppercase tracking-wider text-[#e6f0ff] flex items-center gap-2">
              <span>Docker Monitor</span>
              <span className="text-[10px] text-[#6ee7b7] bg-[#6ee7b7]/15 px-2 py-0.5 rounded-full font-mono">
                {containers.length} Containers
              </span>
            </h3>
            <div className="flex items-center gap-3 text-[11px] text-[#7a92b8] mt-0.5 font-mono">
              <span className="flex items-center gap-1 text-[#34d399]">
                <span className="w-1.5 h-1.5 rounded-full bg-[#34d399] animate-pulse" />
                {runningCount} Ativos
              </span>
              <span>•</span>
              <span className="text-[#94a3b8]">{stoppedCount} Parados</span>
            </div>
          </div>
        </div>

        {/* Search & Refresh */}
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a92b8]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filtrar por nome ou imagem..."
              className="pl-8 pr-3 py-1.5 bg-[#060e1d] border border-[#3ba9ff]/30 rounded-lg text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4] w-48 sm:w-60"
            />
          </div>

          <button
            type="button"
            onClick={fetchContainers}
            disabled={isLoading}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#e6f0ff] text-xs font-mono transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#5eead4]' : ''}`} />
            <span className="hidden sm:inline">Atualizar</span>
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {error && (
          <div className="p-3.5 rounded-xl bg-[#ff5c7a]/10 border border-[#ff5c7a]/30 text-[#ff8ba7] text-xs font-mono flex items-start gap-2.5">
            <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#ff5c7a]" />
            <div className="space-y-1">
              <strong className="block text-white">Docker Daemon não detectado ou socket inacessível</strong>
              <p className="text-[11px] text-[#7a92b8]">{error}</p>
              <div className="mt-2 p-2 rounded bg-[#060c18] border border-white/10 text-[10px] text-[#5eead4]">
                💡 <strong>Dica de Ativação:</strong> No arquivo <code className="text-white">docker-compose.yml</code>, monte o socket do host no container:
                <pre className="mt-1 text-white bg-black/40 p-1.5 rounded overflow-x-auto">
volumes:
  - /var/run/docker.sock:/var/run/docker.sock:ro
                </pre>
              </div>
            </div>
          </div>
        )}

        {filtered.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center p-8 text-center bg-[#081224]/60 border border-[#3ba9ff]/15 rounded-2xl">
            <Server className="w-10 h-10 text-[#7a92b8] opacity-30 mb-2" />
            <div className="text-xs font-mono text-[#e6f0ff] font-semibold">Nenhum container encontrado</div>
            <p className="text-[11px] text-[#7a92b8] max-w-sm mt-1">
              Verifique se o serviço Docker está em execução e se os containers foram criados no host ou no Docker Desktop.
            </p>
          </div>
        )}

        {/* Container Cards List */}
        <div className="grid grid-cols-1 gap-2.5">
          {filtered.map((c) => {
            const isRunning = c.state === 'running';
            const name = c.names[0] || c.id;

            return (
              <div
                key={c.id}
                className="p-3 rounded-xl bg-[#081224]/80 border border-[#3ba9ff]/20 hover:border-[#3ba9ff]/40 transition-all flex flex-col md:flex-row md:items-center justify-between gap-3 shadow-[0_2px_12px_rgba(0,0,0,0.4)]"
              >
                {/* Info Column */}
                <div className="flex items-start gap-3 min-w-0 flex-1">
                  <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${isRunning ? 'bg-[#34d399] shadow-[0_0_8px_#34d399]' : 'bg-[#ef4444]'}`} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-bold text-white font-mono truncate">{name}</span>
                      <button
                        type="button"
                        onClick={() => copyId(c.id)}
                        className="text-[10px] text-[#7a92b8] hover:text-[#5eead4] font-mono flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-[#050b17] border border-[#3ba9ff]/20"
                        title="Copiar ID do Container"
                      >
                        {copiedId === c.id ? <Check className="w-2.5 h-2.5 text-[#34d399]" /> : <Copy className="w-2.5 h-2.5" />}
                        <span>{c.id}</span>
                      </button>
                      <span className={`text-[10px] font-mono px-2 py-0.2 rounded-full border ${
                        isRunning
                          ? 'bg-[#34d399]/15 text-[#34d399] border-[#34d399]/30'
                          : 'bg-[#ef4444]/15 text-[#f87171] border-[#ef4444]/30'
                      }`}>
                        {c.state.toUpperCase()}
                      </span>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 text-[11px] text-[#7a92b8] font-mono mt-1">
                      <span className="truncate max-w-[280px]" title={c.image}>
                        <Layers className="w-3 h-3 inline mr-1 text-[#3ba9ff]" />
                        {c.image}
                      </span>
                      <span>•</span>
                      <span className="truncate">
                        <Clock className="w-3 h-3 inline mr-1 text-[#a78bfa]" />
                        {c.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Actions Column */}
                <div className="flex items-center gap-1.5 self-end md:self-center shrink-0">
                  {isRunning ? (
                    <button
                      type="button"
                      onClick={() => handleAction(c.id, 'stop')}
                      disabled={Boolean(actionInProgress)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#ef4444]/15 hover:bg-[#ef4444]/25 border border-[#ef4444]/30 text-[#f87171] text-xs font-mono transition-all cursor-pointer disabled:opacity-40"
                      title="Parar container"
                    >
                      <Square className="w-3 h-3 fill-current" />
                      <span>Stop</span>
                    </button>
                  ) : (
                    <button
                      type="button"
                      onClick={() => handleAction(c.id, 'start')}
                      disabled={Boolean(actionInProgress)}
                      className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#34d399]/15 hover:bg-[#34d399]/25 border border-[#34d399]/30 text-[#34d399] text-xs font-mono transition-all cursor-pointer disabled:opacity-40"
                      title="Iniciar container"
                    >
                      <Play className="w-3 h-3 fill-current" />
                      <span>Start</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => handleAction(c.id, 'restart')}
                    disabled={Boolean(actionInProgress)}
                    className="p-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#3ba9ff] transition-all cursor-pointer disabled:opacity-40"
                    title="Reiniciar container"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${actionInProgress === `${c.id}-restart` ? 'animate-spin' : ''}`} />
                  </button>

                  <button
                    type="button"
                    onClick={() => openLogs(c.id)}
                    className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 border border-[#a78bfa]/30 text-[#c4b5fd] text-xs font-mono transition-all cursor-pointer"
                    title="Ver logs do container"
                  >
                    <Terminal className="w-3 h-3" />
                    <span>Logs</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal de Logs */}
      {selectedLogsId && (
        <div className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-3xl bg-[#060c18] border border-[#3ba9ff]/30 rounded-2xl shadow-2xl flex flex-col max-h-[80vh] overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 bg-[#0a1628] border-b border-[#3ba9ff]/20">
              <div className="flex items-center gap-2 font-mono text-xs text-[#5eead4]">
                <Terminal className="w-4 h-4 text-[#3ba9ff]" />
                <span>Logs do Container ({selectedLogsId})</span>
              </div>
              <button
                type="button"
                onClick={() => setSelectedLogsId(null)}
                className="p-1 rounded text-[#7a92b8] hover:text-white hover:bg-white/10"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex-1 p-3 overflow-y-auto bg-black font-mono text-xs text-[#a0c4ff] select-text">
              {isLoadingLogs ? (
                <div className="flex items-center justify-center py-8 text-[#7a92b8]">
                  <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                  Carregando logs...
                </div>
              ) : (
                <pre className="whitespace-pre-wrap break-all leading-relaxed">{logsContent}</pre>
              )}
            </div>

            <div className="flex justify-end p-2.5 bg-[#0a1628] border-t border-[#3ba9ff]/20">
              <button
                type="button"
                onClick={() => setSelectedLogsId(null)}
                className="px-3 py-1 rounded-lg bg-[#3ba9ff]/20 text-[#5eead4] text-xs font-mono hover:bg-[#3ba9ff]/30"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
