import React, { useState, useEffect, useRef } from 'react';
import {
  Play,
  Square,
  RefreshCw,
  Terminal,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Trash2,
  Package,
} from 'lucide-react';
import { authFetch } from '../../lib/api';

interface ScriptItem {
  name: string;
  command: string;
}

export const TaskRunnerWindow: React.FC = () => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [packageName, setPackageName] = useState('workspace');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningScript, setRunningScript] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [logs, setLogs] = useState<string>('Nenhuma tarefa executada ainda.\nSelecione um script acima e clique em Executar.');
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load scripts from backend
  const loadScripts = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/tasks/list');
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
        if (data.packageName) setPackageName(data.packageName);
      }
    } catch (err) {
      console.error('Error fetching tasks:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadScripts();
  }, []);

  // Poll for task status and logs if a task is running
  useEffect(() => {
    if (!activeTaskId || taskStatus !== 'running') return;

    const interval = setInterval(async () => {
      try {
        const res = await authFetch(`/api/tasks/status?taskId=${encodeURIComponent(activeTaskId)}`);
        if (res.ok) {
          const data = await res.json();
          setLogs(data.logs || '');
          if (data.status !== 'running') {
            setTaskStatus(data.status);
          }
        }
      } catch {
        // ignore polling errors
      }
    }, 400);

    return () => clearInterval(interval);
  }, [activeTaskId, taskStatus]);

  // Auto-scroll logs
  useEffect(() => {
    terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  const handleRunScript = async (scriptName: string) => {
    setRunningScript(scriptName);
    setTaskStatus('running');
    setLogs(`[Nebula Task Runner] Iniciando script "${scriptName}"...\n`);

    try {
      const res = await authFetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: scriptName }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveTaskId(data.taskId);
      } else {
        const err = await res.json();
        setTaskStatus('failed');
        setLogs((prev) => prev + `\nErro ao iniciar: ${err.error || 'Falha na requisição'}`);
      }
    } catch (err: any) {
      setTaskStatus('failed');
      setLogs((prev) => prev + `\nErro de rede: ${err.message}`);
    }
  };

  const handleStopTask = async () => {
    if (!activeTaskId) return;
    try {
      await authFetch('/api/tasks/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: activeTaskId }),
      });
      setTaskStatus('failed');
    } catch (err) {
      console.error('Error stopping task:', err);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/90 text-[#e6f0ff] font-mono text-xs select-none overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#162744] bg-[#091325] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#a78bfa]" />
          <span className="font-semibold text-[#e2edff]">{packageName}</span>
          <span className="text-[10px] text-[#7a92b8]">(package.json)</span>
        </div>

        <button
          onClick={loadScripts}
          title="Recarregar scripts"
          className="p-1 rounded hover:bg-[#162744] text-[#7a92b8] hover:text-[#5eead4] transition-colors cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      {/* Scripts Grid */}
      <div className="p-3 border-b border-[#162744] bg-[#050914] max-h-48 overflow-y-auto">
        <div className="text-[10px] text-[#7a92b8] uppercase tracking-wider mb-2">
          Scripts Disponíveis ({scripts.length})
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          {scripts.map((sc) => {
            const isThisRunning = runningScript === sc.name && taskStatus === 'running';
            return (
              <div
                key={sc.name}
                className="flex items-center justify-between p-2 rounded-xl bg-[#0a1628]/75 border border-[#162744] hover:border-[#a78bfa]/40 transition-all group"
              >
                <div className="truncate mr-2">
                  <div className="font-semibold text-xs text-[#a78bfa] group-hover:text-[#c4b5fd] truncate">
                    npm run {sc.name}
                  </div>
                  <div className="text-[10px] text-[#506c94] truncate">
                    {sc.command}
                  </div>
                </div>

                {isThisRunning ? (
                  <button
                    onClick={handleStopTask}
                    className="p-1.5 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#f87171] border border-[#ef4444]/40 transition-all cursor-pointer shrink-0"
                    title="Interromper execução"
                  >
                    <Square className="w-3.5 h-3.5 fill-current" />
                  </button>
                ) : (
                  <button
                    onClick={() => handleRunScript(sc.name)}
                    disabled={taskStatus === 'running'}
                    className="p-1.5 rounded-lg bg-[#5eead4]/20 hover:bg-[#5eead4]/30 text-[#5eead4] border border-[#5eead4]/40 disabled:opacity-20 disabled:cursor-not-allowed transition-all cursor-pointer shrink-0"
                    title="Executar script"
                  >
                    <Play className="w-3.5 h-3.5 fill-current" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Terminal Log View */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#040711]">
        <div className="px-3 py-1.5 bg-[#060a17] border-b border-[#14233d] flex items-center justify-between text-[11px] text-[#7a92b8]">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-[#3ba9ff]" />
            <span>Output Console:</span>
            {taskStatus === 'running' && (
              <span className="flex items-center gap-1 text-[#5eead4]">
                <Loader2 className="w-3 h-3 animate-spin" /> Executando {runningScript}...
              </span>
            )}
            {taskStatus === 'success' && (
              <span className="flex items-center gap-1 text-[#10b981]">
                <CheckCircle2 className="w-3 h-3" /> Concluído com sucesso
              </span>
            )}
            {taskStatus === 'failed' && (
              <span className="flex items-center gap-1 text-[#ef4444]">
                <AlertCircle className="w-3 h-3" /> Falha ou interrompido
              </span>
            )}
          </div>

          <button
            onClick={() => setLogs('')}
            title="Limpar console"
            className="p-1 rounded hover:bg-[#162744] text-[#7a92b8] hover:text-[#e2edff] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        <div className="flex-1 p-3 font-mono text-[11px] leading-relaxed text-[#cbd5e1] overflow-y-auto whitespace-pre-wrap select-text">
          {logs}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
};
