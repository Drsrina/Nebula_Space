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
  FileCode,
  Zap,
  Activity,
} from 'lucide-react';
import { authFetch } from '../../lib/api';

interface ScriptItem {
  name: string;
  command: string;
}

interface CustomScriptItem {
  name: string;
  path: string;
  type: 'python' | 'shell' | 'node';
  command: string;
}

interface ActiveTaskItem {
  id: string;
  script: string;
  status: 'running' | 'success' | 'failed';
  startedAt: number;
}

export const TaskRunnerWindow: React.FC = () => {
  const [scripts, setScripts] = useState<ScriptItem[]>([]);
  const [customScripts, setCustomScripts] = useState<CustomScriptItem[]>([]);
  const [activeTasksList, setActiveTasksList] = useState<ActiveTaskItem[]>([]);
  const [activeTab, setActiveTab] = useState<'all' | 'npm' | 'custom' | 'running'>('all');
  const [packageName, setPackageName] = useState('workspace');
  const [isLoading, setIsLoading] = useState(false);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [runningScript, setRunningScript] = useState<string | null>(null);
  const [taskStatus, setTaskStatus] = useState<'idle' | 'running' | 'success' | 'failed'>('idle');
  const [logs, setLogs] = useState<string>(
    'Nenhuma tarefa executada ainda.\nSelecione um script do package.json ou script autodescoberto e clique em Executar.'
  );
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Load scripts from backend
  const loadScripts = async () => {
    setIsLoading(true);
    try {
      const res = await authFetch('/api/tasks/list');
      if (res.ok) {
        const data = await res.json();
        setScripts(data.scripts || []);
        setCustomScripts(data.customScripts || []);
        setActiveTasksList(data.activeTasks || []);
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
            loadScripts();
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

  const handleRunScript = async (scriptName: string, isCustom = false) => {
    setRunningScript(scriptName);
    setTaskStatus('running');
    setLogs(`[Nebula Task Runner] Iniciando script "${scriptName}"...\n`);

    try {
      const res = await authFetch('/api/tasks/run', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script: isCustom ? `custom:${scriptName}` : scriptName }),
      });

      if (res.ok) {
        const data = await res.json();
        setActiveTaskId(data.taskId);
        loadScripts();
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

  const handleStopTask = async (taskIdToStop?: string) => {
    const targetId = taskIdToStop || activeTaskId;
    if (!targetId) return;
    try {
      await authFetch('/api/tasks/stop', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ taskId: targetId }),
      });
      setTaskStatus('failed');
      loadScripts();
    } catch (err) {
      console.error('Error stopping task:', err);
    }
  };

  const runningCount = activeTasksList.filter((t) => t.status === 'running').length;

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/90 text-[#e6f0ff] font-mono text-xs select-none overflow-hidden">
      {/* Header */}
      <div className="px-3 py-2 border-b border-[#162744] bg-[#091325] flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <Package className="w-4 h-4 text-[#a78bfa]" />
          <span className="font-semibold text-[#e2edff]">{packageName}</span>
          <span className="text-[10px] text-[#7a92b8]">(Auto-Discovery & Runner)</span>
        </div>

        <div className="flex items-center gap-2">
          {runningCount > 0 && (
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#10b981]/20 text-[#5eead4] border border-[#5eead4]/30 text-[10px]">
              <Activity className="w-3 h-3 animate-pulse" />
              {runningCount} ativo(s)
            </span>
          )}
          <button
            onClick={loadScripts}
            title="Recarregar scripts autodescobertos"
            className="p-1 rounded hover:bg-[#162744] text-[#7a92b8] hover:text-[#5eead4] transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* Tabs Filter */}
      <div className="flex items-center gap-1 px-3 pt-2 pb-1 border-b border-[#162744] bg-[#060c1a] shrink-0 text-[11px]">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'all'
              ? 'bg-[#3ba9ff]/20 text-[#5eead4] border border-[#3ba9ff]/40'
              : 'text-[#7a92b8] hover:text-[#e6f0ff]'
          }`}
        >
          Todos ({scripts.length + customScripts.length})
        </button>
        <button
          onClick={() => setActiveTab('npm')}
          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'npm'
              ? 'bg-[#a78bfa]/20 text-[#c4b5fd] border border-[#a78bfa]/40'
              : 'text-[#7a92b8] hover:text-[#e6f0ff]'
          }`}
        >
          package.json ({scripts.length})
        </button>
        <button
          onClick={() => setActiveTab('custom')}
          className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
            activeTab === 'custom'
              ? 'bg-[#38bdf8]/20 text-[#7dd3fc] border border-[#38bdf8]/40'
              : 'text-[#7a92b8] hover:text-[#e6f0ff]'
          }`}
        >
          Autodescobertos ({customScripts.length})
        </button>
        {runningCount > 0 && (
          <button
            onClick={() => setActiveTab('running')}
            className={`px-2.5 py-1 rounded-lg transition-colors cursor-pointer ${
              activeTab === 'running'
                ? 'bg-[#10b981]/20 text-[#5eead4] border border-[#10b981]/40'
                : 'text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
          >
            Executando ({runningCount})
          </button>
        )}
      </div>

      {/* Scripts Grid */}
      <div className="p-3 border-b border-[#162744] bg-[#050914] max-h-52 overflow-y-auto space-y-3">
        {/* Section: Custom Discovered Scripts (.py, .sh, .js) */}
        {(activeTab === 'all' || activeTab === 'custom') && customScripts.length > 0 && (
          <div>
            <div className="text-[10px] text-[#38bdf8] uppercase tracking-wider mb-1.5 flex items-center gap-1 font-bold">
              <FileCode className="w-3.5 h-3.5" />
              Scripts Autodescobertos no Workspace ({customScripts.length})
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {customScripts.map((cs) => {
                const isThisRunning = runningScript === cs.path && taskStatus === 'running';
                return (
                  <div
                    key={cs.path}
                    className="flex items-center justify-between p-2 rounded-xl bg-[#0a1628]/85 border border-[#1b345e] hover:border-[#38bdf8]/50 transition-all group"
                  >
                    <div className="truncate mr-2">
                      <div className="flex items-center gap-1.5 font-semibold text-xs text-[#7dd3fc] truncate">
                        <span className="text-[9px] uppercase px-1 py-0.2 rounded bg-[#38bdf8]/20 text-[#38bdf8]">
                          {cs.type}
                        </span>
                        <span className="truncate">{cs.name}</span>
                      </div>
                      <div className="text-[10px] text-[#506c94] truncate">{cs.command}</div>
                    </div>

                    {isThisRunning ? (
                      <button
                        onClick={() => handleStopTask()}
                        className="p-1.5 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#f87171] border border-[#ef4444]/40 transition-all cursor-pointer shrink-0"
                        title="Interromper execução"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRunScript(cs.path, true)}
                        disabled={taskStatus === 'running'}
                        className="p-1.5 rounded-lg bg-[#38bdf8]/20 hover:bg-[#38bdf8]/30 text-[#38bdf8] border border-[#38bdf8]/40 disabled:opacity-30 transition-all cursor-pointer shrink-0"
                        title="Executar script autodescoberto"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Section: package.json Scripts */}
        {(activeTab === 'all' || activeTab === 'npm') && scripts.length > 0 && (
          <div>
            <div className="text-[10px] text-[#a78bfa] uppercase tracking-wider mb-1.5 flex items-center gap-1 font-bold">
              <Package className="w-3.5 h-3.5" />
              Scripts do package.json ({scripts.length})
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
                      <div className="text-[10px] text-[#506c94] truncate">{sc.command}</div>
                    </div>

                    {isThisRunning ? (
                      <button
                        onClick={() => handleStopTask()}
                        className="p-1.5 rounded-lg bg-[#ef4444]/20 hover:bg-[#ef4444]/30 text-[#f87171] border border-[#ef4444]/40 transition-all cursor-pointer shrink-0"
                        title="Interromper execução"
                      >
                        <Square className="w-3.5 h-3.5 fill-current" />
                      </button>
                    ) : (
                      <button
                        onClick={() => handleRunScript(sc.name)}
                        disabled={taskStatus === 'running'}
                        className="p-1.5 rounded-lg bg-[#5eead4]/20 hover:bg-[#5eead4]/30 text-[#5eead4] border border-[#5eead4]/40 disabled:opacity-20 transition-all cursor-pointer shrink-0"
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
        )}
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
