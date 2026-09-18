import React, { useState, useEffect } from 'react';
import {
  Plus, Play, Pause, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  ChevronDown, ChevronRight, Edit2, Save, X, AlertCircle,
} from 'lucide-react';

interface CronJob {
  id: string;
  name: string;
  expression: string;
  command: string;
  isPaused: boolean;
  createdAt: number;
  lastRunAt?: number;
  lastStatus?: 'success' | 'error' | 'running';
  lastDurationMs?: number;
}

interface CronLog {
  timestamp: number;
  status: 'success' | 'error';
  durationMs: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

function cronValidate(expr: string): boolean {
  const parts = expr.trim().split(/\s+/);
  return parts.length === 5;
}

function formatDuration(ms?: number): string {
  if (!ms) return '-';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function formatDate(ts?: number): string {
  if (!ts) return 'Nunca';
  return new Date(ts).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
}

const CRON_EXAMPLES = [
  { expr: '* * * * *', desc: 'Todo minuto' },
  { expr: '*/5 * * * *', desc: 'A cada 5 min' },
  { expr: '0 * * * *', desc: 'A cada hora' },
  { expr: '0 9 * * 1-5', desc: 'Dias úteis 9h' },
  { expr: '0 0 * * *', desc: 'Meia-noite' },
];

export const CrontabWindow: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<string, CronLog[]>>({});
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formExpr, setFormExpr] = useState('*/5 * * * *');
  const [formCommand, setFormCommand] = useState('');
  const [formError, setFormError] = useState('');

  const token = sessionStorage.getItem('nebula_token') ?? '';
  const authHeaders = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' };

  const fetchJobs = async () => {
    try {
      const resp = await fetch('/api/cron/jobs', { headers: authHeaders });
      if (resp.ok) setJobs(await resp.json());
    } catch {}
    setIsLoading(false);
  };

  useEffect(() => { fetchJobs(); }, []);

  const fetchLogs = async (jobId: string) => {
    try {
      const resp = await fetch(`/api/cron/jobs/${jobId}/logs`, { headers: authHeaders });
      if (resp.ok) {
        const data = await resp.json();
        setJobLogs((prev) => ({ ...prev, [jobId]: data }));
      }
    } catch {}
  };

  const handleToggleExpand = (jobId: string) => {
    if (expandedJobId === jobId) {
      setExpandedJobId(null);
    } else {
      setExpandedJobId(jobId);
      fetchLogs(jobId);
    }
  };

  const handleRunNow = async (job: CronJob) => {
    setRunningJobs((prev) => new Set([...prev, job.id]));
    try {
      const resp = await fetch(`/api/cron/jobs/${job.id}/run`, { method: 'POST', headers: authHeaders });
      if (resp.ok) {
        await fetchJobs();
        if (expandedJobId === job.id) await fetchLogs(job.id);
      }
    } catch {}
    setRunningJobs((prev) => { const n = new Set(prev); n.delete(job.id); return n; });
  };

  const handleTogglePause = async (job: CronJob) => {
    try {
      await fetch(`/api/cron/jobs/${job.id}`, {
        method: 'PUT',
        headers: authHeaders,
        body: JSON.stringify({ isPaused: !job.isPaused }),
      });
      await fetchJobs();
    } catch {}
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Remover este job cron?')) return;
    try {
      await fetch(`/api/cron/jobs/${jobId}`, { method: 'DELETE', headers: authHeaders });
      await fetchJobs();
    } catch {}
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Nome é obrigatório.'); return; }
    if (!cronValidate(formExpr)) { setFormError('Expressão cron inválida (5 campos separados por espaço).'); return; }
    if (!formCommand.trim()) { setFormError('Comando é obrigatório.'); return; }

    try {
      if (editingJob) {
        await fetch(`/api/cron/jobs/${editingJob.id}`, {
          method: 'PUT',
          headers: authHeaders,
          body: JSON.stringify({ name: formName, expression: formExpr, command: formCommand }),
        });
      } else {
        await fetch('/api/cron/jobs', {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({ name: formName, expression: formExpr, command: formCommand }),
        });
      }
      setShowCreateForm(false);
      setEditingJob(null);
      setFormName(''); setFormExpr('*/5 * * * *'); setFormCommand('');
      await fetchJobs();
    } catch { setFormError('Erro ao salvar job.'); }
  };

  const startEdit = (job: CronJob) => {
    setEditingJob(job);
    setFormName(job.name);
    setFormExpr(job.expression);
    setFormCommand(job.command);
    setShowCreateForm(true);
    setFormError('');
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingJob(null);
    setFormName(''); setFormExpr('*/5 * * * *'); setFormCommand('');
    setFormError('');
  };

  return (
    <div className="flex flex-col h-full bg-[#060d1c] text-xs font-mono">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e]">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#a78bfa]" />
          <span className="text-[#e6f0ff] font-semibold">Crontab — Agendador</span>
          <span className="text-[#4a6080] text-[10px]">({jobs.filter((j) => !j.isPaused).length}/{jobs.length} ativos)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchJobs}
            className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setShowCreateForm(true); setEditingJob(null); }}
            className="flex items-center gap-1 px-2 py-1 rounded bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 text-[#a78bfa] border border-[#a78bfa]/30 transition-all"
          >
            <Plus className="w-3 h-3" />
            Novo Job
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="border-b border-[#1a2a4a] bg-[#08101e] p-3 space-y-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#a78bfa] text-[10px] font-semibold">{editingJob ? 'EDITAR JOB' : 'NOVO JOB'}</span>
            <button onClick={cancelForm}><X className="w-3.5 h-3.5 text-[#4a6080] hover:text-[#e6f0ff]" /></button>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-[#4a6080] mb-0.5">NOME</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Meu job"
                className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#a78bfa]/50"
              />
            </div>
            <div>
              <label className="block text-[9px] text-[#4a6080] mb-0.5">EXPRESSÃO CRON</label>
              <div className="flex gap-1">
                <input
                  value={formExpr}
                  onChange={(e) => setFormExpr(e.target.value)}
                  placeholder="* * * * *"
                  className="flex-1 bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#a78bfa]/50"
                />
              </div>
              <div className="flex gap-1 mt-1 flex-wrap">
                {CRON_EXAMPLES.map((ex) => (
                  <button key={ex.expr} onClick={() => setFormExpr(ex.expr)}
                    className="text-[8px] px-1 py-0.5 rounded border border-[#1a2a4a] text-[#4a6080] hover:text-[#a78bfa] hover:border-[#a78bfa]/30"
                    title={ex.expr}>{ex.desc}</button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className="block text-[9px] text-[#4a6080] mb-0.5">COMANDO (shell)</label>
            <input
              value={formCommand}
              onChange={(e) => setFormCommand(e.target.value)}
              placeholder="echo hello world ou node /caminho/script.js"
              className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#a78bfa]/50"
            />
          </div>
          {formError && (
            <div className="flex items-center gap-1 text-[#ef4444] text-[10px]">
              <AlertCircle className="w-3 h-3" /> {formError}
            </div>
          )}
          <div className="flex justify-end gap-2">
            <button onClick={cancelForm} className="px-2 py-1 rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} className="flex items-center gap-1 px-2 py-1 rounded bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 text-[#a78bfa] border border-[#a78bfa]/30 transition-all">
              <Save className="w-3 h-3" />
              {editingJob ? 'Salvar alterações' : 'Criar job'}
            </button>
          </div>
        </div>
      )}

      {/* Jobs List */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center h-full text-[#4a6080]">
            <RefreshCw className="w-4 h-4 animate-spin mr-2" /> Carregando...
          </div>
        ) : jobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#4a6080] gap-2">
            <Clock className="w-8 h-8 opacity-30" />
            <p>Nenhum job agendado</p>
            <button
              onClick={() => setShowCreateForm(true)}
              className="flex items-center gap-1 px-3 py-1.5 rounded bg-[#a78bfa]/10 hover:bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/20 transition-all"
            >
              <Plus className="w-3.5 h-3.5" /> Criar primeiro job
            </button>
          </div>
        ) : (
          <div className="divide-y divide-[#0f1e30]">
            {jobs.map((job) => {
              const isExpanded = expandedJobId === job.id;
              const isRunning = runningJobs.has(job.id) || job.lastStatus === 'running';
              const logs = jobLogs[job.id] ?? [];

              return (
                <div key={job.id} className="hover:bg-[#0a1628]/50 transition-colors">
                  <div className="flex items-center gap-2 px-3 py-2">
                    {/* Expand */}
                    <button
                      onClick={() => handleToggleExpand(job.id)}
                      className="text-[#4a6080] hover:text-[#e6f0ff] shrink-0 transition-colors"
                    >
                      {isExpanded ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    </button>

                    {/* Status indicator */}
                    <div
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{
                        background: job.isPaused ? '#4a6080'
                          : job.lastStatus === 'success' ? '#22c55e'
                          : job.lastStatus === 'error' ? '#ef4444'
                          : '#a78bfa',
                        boxShadow: !job.isPaused ? '0 0 6px currentColor' : 'none',
                      }}
                    />

                    {/* Name + expression */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[#e6f0ff] truncate">{job.name}</span>
                        {job.isPaused && <span className="text-[9px] text-[#4a6080] border border-[#1a2a4a] rounded px-1">pausado</span>}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[#a78bfa] text-[9px]">{job.expression}</span>
                        <span className="text-[#3a5a7a] text-[9px] truncate max-w-[140px]" title={job.command}>{job.command}</span>
                      </div>
                    </div>

                    {/* Last run info */}
                    <div className="text-right text-[9px] text-[#4a6080] shrink-0">
                      <div>{formatDate(job.lastRunAt)}</div>
                      <div>{formatDuration(job.lastDurationMs)}</div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        onClick={() => handleRunNow(job)}
                        disabled={isRunning}
                        title="Executar agora"
                        className="w-6 h-6 flex items-center justify-center rounded text-[#22c55e] hover:bg-[#22c55e]/15 transition-all disabled:opacity-40"
                      >
                        {isRunning ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Play className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => handleTogglePause(job)}
                        title={job.isPaused ? 'Retomar' : 'Pausar'}
                        className="w-6 h-6 flex items-center justify-center rounded text-[#fbbf24] hover:bg-[#fbbf24]/15 transition-all"
                      >
                        {job.isPaused ? <Play className="w-3 h-3" /> : <Pause className="w-3 h-3" />}
                      </button>
                      <button
                        onClick={() => startEdit(job)}
                        title="Editar"
                        className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
                      >
                        <Edit2 className="w-3 h-3" />
                      </button>
                      <button
                        onClick={() => handleDelete(job.id)}
                        title="Remover"
                        className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>

                  {/* Expanded Logs */}
                  {isExpanded && (
                    <div className="mx-3 mb-2 rounded border border-[#1a2a4a] bg-[#060d1c] overflow-hidden">
                      <div className="px-2 py-1 border-b border-[#1a2a4a] text-[9px] text-[#4a6080] flex items-center justify-between">
                        <span>HISTÓRICO (últimas {logs.length} execuções)</span>
                        <button onClick={() => fetchLogs(job.id)} className="hover:text-[#e6f0ff]">
                          <RefreshCw className="w-2.5 h-2.5" />
                        </button>
                      </div>
                      {logs.length === 0 ? (
                        <div className="p-2 text-[9px] text-[#3a5a7a]">Nenhuma execução registrada.</div>
                      ) : (
                        <div className="divide-y divide-[#0f1e30] max-h-48 overflow-y-auto">
                          {logs.map((log, i) => (
                            <div key={i} className="p-2 space-y-1">
                              <div className="flex items-center gap-2">
                                {log.status === 'success'
                                  ? <CheckCircle className="w-3 h-3 text-[#22c55e]" />
                                  : <XCircle className="w-3 h-3 text-[#ef4444]" />}
                                <span className="text-[9px] text-[#7a92b8]">{formatDate(log.timestamp)}</span>
                                <span className="text-[9px] text-[#4a6080]">{formatDuration(log.durationMs)}</span>
                                <span className="text-[9px] text-[#3a5a7a]">exit: {log.exitCode ?? '-'}</span>
                              </div>
                              {log.stdout && (
                                <pre className="text-[9px] text-[#5eead4] bg-[#0a1628] rounded p-1 overflow-x-auto max-h-16 whitespace-pre-wrap">{log.stdout.slice(0, 500)}</pre>
                              )}
                              {log.stderr && (
                                <pre className="text-[9px] text-[#ef4444] bg-[#0a1628] rounded p-1 overflow-x-auto max-h-12 whitespace-pre-wrap">{log.stderr.slice(0, 300)}</pre>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
