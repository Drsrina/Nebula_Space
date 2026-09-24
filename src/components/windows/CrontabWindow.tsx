import React, { useState, useEffect, useRef } from 'react';
import {
  Plus, Play, Pause, Trash2, RefreshCw, CheckCircle, XCircle, Clock,
  Edit2, Save, X, AlertCircle, Download, Upload, HardDrive, Zap, Terminal,
  ChevronDown, ChevronRight
} from 'lucide-react';
import { authFetch } from '../../lib/api';

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

interface WorkflowBrief {
  id: string;
  name: string;
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
  { expr: '0 8 * * *', desc: 'Todo dia 08:00' },
  { expr: '0 9 * * 1-5', desc: 'Dias úteis 9h' },
  { expr: '0 0 * * *', desc: 'Meia-noite' },
];

export const CrontabWindow: React.FC = () => {
  const [jobs, setJobs] = useState<CronJob[]>([]);
  const [workflows, setWorkflows] = useState<WorkflowBrief[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedJobId, setExpandedJobId] = useState<string | null>(null);
  const [jobLogs, setJobLogs] = useState<Record<string, CronLog[]>>({});
  const [runningJobs, setRunningJobs] = useState<Set<string>>(new Set());
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [editingJob, setEditingJob] = useState<CronJob | null>(null);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState('');
  const [formExpr, setFormExpr] = useState('*/5 * * * *');
  const [formCommand, setFormCommand] = useState('');
  const [commandType, setCommandType] = useState<'workflow' | 'shell'>('shell');
  const [selectedWorkflowId, setSelectedWorkflowId] = useState('');
  const [formError, setFormError] = useState('');

  const fileInputRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const fetchJobs = async () => {
    try {
      const resp = await authFetch('/api/cron/jobs');
      if (resp.ok) setJobs(await resp.json());
    } catch {}
    setIsLoading(false);
  };

  const fetchWorkflows = async () => {
    try {
      const resp = await authFetch('/api/workflows');
      if (resp.ok) {
        const data = await resp.json();
        setWorkflows(data.map((w: any) => ({ id: w.id, name: w.name })));
      }
    } catch {}
  };

  useEffect(() => {
    fetchJobs();
    fetchWorkflows();
  }, []);

  const fetchLogs = async (jobId: string) => {
    try {
      const resp = await authFetch(`/api/cron/jobs/${jobId}/logs`);
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
      const resp = await authFetch(`/api/cron/jobs/${job.id}/run`, { method: 'POST' });
      if (resp.ok) {
        await fetchJobs();
        if (expandedJobId === job.id) await fetchLogs(job.id);
        showToast(`Job "${job.name}" executado com sucesso.`);
      }
    } catch {
      showToast(`Falha ao executar job "${job.name}".`);
    }
    setRunningJobs((prev) => { const n = new Set(prev); n.delete(job.id); return n; });
  };

  const handleTogglePause = async (job: CronJob) => {
    try {
      await authFetch(`/api/cron/jobs/${job.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isPaused: !job.isPaused }),
      });
      await fetchJobs();
      showToast(job.isPaused ? `Job "${job.name}" retomado.` : `Job "${job.name}" pausado.`);
    } catch {}
  };

  const handleDelete = async (jobId: string) => {
    if (!confirm('Remover este job cron?')) return;
    try {
      await authFetch(`/api/cron/jobs/${jobId}`, { method: 'DELETE' });
      await fetchJobs();
      showToast('Job removido.');
    } catch {}
  };

  const handleSave = async () => {
    setFormError('');
    if (!formName.trim()) { setFormError('Nome é obrigatório.'); return; }
    if (!cronValidate(formExpr)) { setFormError('Expressão cron inválida (5 campos separados por espaço).'); return; }
    
    let cmd = formCommand.trim();
    if (commandType === 'workflow') {
      if (!selectedWorkflowId) {
        setFormError('Selecione um Mini-Workflow para o gatilho.');
        return;
      }
      cmd = `workflow:${selectedWorkflowId}`;
    }

    if (!cmd) { setFormError('Comando é obrigatório.'); return; }

    try {
      if (editingJob) {
        await authFetch(`/api/cron/jobs/${editingJob.id}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, expression: formExpr, command: cmd }),
        });
        showToast('Job atualizado com sucesso!');
      } else {
        await authFetch('/api/cron/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: formName, expression: formExpr, command: cmd }),
        });
        showToast('Job criado e agendado com sucesso!');
      }
      setShowCreateForm(false);
      setEditingJob(null);
      setFormName(''); setFormExpr('*/5 * * * *'); setFormCommand('');
      setSelectedWorkflowId('');
      await fetchJobs();
    } catch { setFormError('Erro ao salvar job.'); }
  };

  const startEdit = (job: CronJob) => {
    setEditingJob(job);
    setFormName(job.name);
    setFormExpr(job.expression);
    setFormCommand(job.command);
    if (job.command.startsWith('workflow:')) {
      setCommandType('workflow');
      setSelectedWorkflowId(job.command.replace('workflow:', ''));
    } else {
      setCommandType('shell');
      setSelectedWorkflowId('');
    }
    setShowCreateForm(true);
    setFormError('');
  };

  const cancelForm = () => {
    setShowCreateForm(false);
    setEditingJob(null);
    setFormName(''); setFormExpr('*/5 * * * *'); setFormCommand('');
    setSelectedWorkflowId('');
    setFormError('');
  };

  // ─── Export / Backup ────────────────────────────────────────────────────────
  const exportCrontabJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(jobs, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `nebula_crontab_backup_${Date.now()}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Crontab exportado como arquivo JSON.');
  };

  const saveBackupToWorkspace = async () => {
    try {
      const resp = await authFetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: 'crontab_backup.json',
          content: JSON.stringify(jobs, null, 2),
        }),
      });
      if (resp.ok) {
        showToast('Backup salvo no Workspace em /crontab_backup.json!');
      } else {
        exportCrontabJSON();
      }
    } catch {
      exportCrontabJSON();
    }
  };

  const handleImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (Array.isArray(parsed)) {
          let count = 0;
          for (const item of parsed) {
            if (item.name && item.expression && item.command) {
              await authFetch('/api/cron/jobs', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  name: item.name,
                  expression: item.expression,
                  command: item.command,
                }),
              });
              count++;
            }
          }
          await fetchJobs();
          showToast(`${count} jobs importados com sucesso!`);
        } else {
          showToast('Formato inválido: esperado array de jobs cron.');
        }
      } catch (err: any) {
        showToast(`Erro ao importar: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  return (
    <div className="flex flex-col h-full bg-[#060d1c] text-xs font-mono relative">
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleImportFile}
        accept=".json"
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded bg-[#10b981] text-black font-semibold text-[11px] shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle className="w-3.5 h-3.5" />
          {toastMsg}
        </div>
      )}

      {/* Header & Action Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e] flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-[#a78bfa]" />
          <span className="text-[#e6f0ff] font-semibold">Crontab — Agendador</span>
          <span className="text-[#4a6080] text-[10px]">({jobs.filter((j) => !j.isPaused).length}/{jobs.length} ativos)</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={fetchJobs}
            className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
            title="Atualizar"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button
            onClick={saveBackupToWorkspace}
            className="flex items-center gap-1 px-2 py-1 rounded text-[#5eead4] hover:bg-[#5eead4]/15 border border-[#5eead4]/30 transition-all text-[10px]"
            title="Salvar cópia de backup do crontab no workspace"
          >
            <HardDrive className="w-3 h-3" />
            Salvar
          </button>

          <button
            onClick={exportCrontabJSON}
            className="flex items-center gap-1 px-2 py-1 rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all text-[10px]"
            title="Baixar crontab em arquivo JSON"
          >
            <Download className="w-3 h-3" />
            Exportar
          </button>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-1 px-2 py-1 rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all text-[10px]"
            title="Restaurar jobs a partir de arquivo JSON"
          >
            <Upload className="w-3 h-3" />
            Importar
          </button>

          <button
            onClick={() => { setShowCreateForm(true); setEditingJob(null); }}
            className="flex items-center gap-1 px-2.5 py-1 rounded bg-[#a78bfa]/15 hover:bg-[#a78bfa]/25 text-[#a78bfa] border border-[#a78bfa]/30 transition-all text-[10px] font-semibold"
          >
            <Plus className="w-3 h-3" />
            Novo Job
          </button>
        </div>
      </div>

      {/* Create/Edit Form */}
      {showCreateForm && (
        <div className="border-b border-[#1a2a4a] bg-[#08101e] p-3 space-y-2.5 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[#a78bfa] text-[10px] font-semibold">{editingJob ? 'EDITAR JOB' : 'NOVO JOB AGENDADO'}</span>
            <button onClick={cancelForm}><X className="w-3.5 h-3.5 text-[#4a6080] hover:text-[#e6f0ff]" /></button>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="block text-[9px] text-[#4a6080] mb-0.5">NOME DO JOB</label>
              <input
                value={formName}
                onChange={(e) => setFormName(e.target.value)}
                placeholder="Ex: Pulso diário de logs"
                className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#a78bfa]/50"
              />
            </div>
            <div>
              <label className="block text-[9px] text-[#4a6080] mb-0.5">EXPRESSÃO CRON</label>
              <input
                value={formExpr}
                onChange={(e) => setFormExpr(e.target.value)}
                placeholder="* * * * *"
                className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#a78bfa]/50"
              />
              <div className="flex gap-1 mt-1 flex-wrap">
                {CRON_EXAMPLES.map((ex) => (
                  <button key={ex.expr} onClick={() => setFormExpr(ex.expr)}
                    className="text-[8px] px-1 py-0.5 rounded border border-[#1a2a4a] text-[#4a6080] hover:text-[#a78bfa] hover:border-[#a78bfa]/30"
                    title={ex.expr}>{ex.desc}</button>
                ))}
              </div>
            </div>
          </div>

          {/* Trigger Type Toggle */}
          <div>
            <label className="block text-[9px] text-[#4a6080] mb-1">TIPO DE GATILHO</label>
            <div className="flex gap-2 mb-2">
              <button
                type="button"
                onClick={() => setCommandType('workflow')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] border transition-all ${
                  commandType === 'workflow'
                    ? 'bg-[#f97316]/20 border-[#f97316] text-[#f97316]'
                    : 'bg-[#0a1628] border-[#1a2a4a] text-[#7a92b8]'
                }`}
              >
                <Zap className="w-3 h-3" />
                Disparar Mini-Workflow
              </button>
              <button
                type="button"
                onClick={() => setCommandType('shell')}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded text-[10px] border transition-all ${
                  commandType === 'shell'
                    ? 'bg-[#3ba9ff]/20 border-[#3ba9ff] text-[#3ba9ff]'
                    : 'bg-[#0a1628] border-[#1a2a4a] text-[#7a92b8]'
                }`}
              >
                <Terminal className="w-3 h-3" />
                Comando Shell / Script
              </button>
            </div>

            {commandType === 'workflow' ? (
              <div>
                <label className="block text-[9px] text-[#4a6080] mb-0.5">SELECIONAR MINI-WORKFLOW</label>
                {workflows.length === 0 ? (
                  <div className="text-[10px] text-[#fbbf24] bg-[#fbbf24]/10 p-2 rounded border border-[#fbbf24]/30">
                    Nenhum workflow salvo encontrado. Crie um workflow primeiro na janela "Mini-Workflows".
                  </div>
                ) : (
                  <select
                    value={selectedWorkflowId}
                    onChange={(e) => {
                      const id = e.target.value;
                      setSelectedWorkflowId(id);
                      setFormCommand(`workflow:${id}`);
                      const found = workflows.find((w) => w.id === id);
                      if (found && !formName) setFormName(`Workflow: ${found.name}`);
                    }}
                    className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#f97316]/50"
                  >
                    <option value="">-- Escolha um Mini-Workflow --</option>
                    {workflows.map((wf) => (
                      <option key={wf.id} value={wf.id}>
                        {wf.name} ({wf.id})
                      </option>
                    ))}
                  </select>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-[9px] text-[#4a6080] mb-0.5">COMANDO SHELL</label>
                <input
                  value={formCommand}
                  onChange={(e) => setFormCommand(e.target.value)}
                  placeholder="Ex: python scripts/timestamp_logger.py ou node server.js"
                  className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#3ba9ff]/50"
                />
              </div>
            )}
          </div>

          {formError && (
            <div className="flex items-center gap-1 text-[#ef4444] text-[10px]">
              <AlertCircle className="w-3 h-3" /> {formError}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button onClick={cancelForm} className="px-2 py-1 rounded text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all">
              Cancelar
            </button>
            <button onClick={handleSave} className="flex items-center gap-1 px-3 py-1 rounded bg-[#a78bfa]/20 hover:bg-[#a78bfa]/30 text-[#a78bfa] border border-[#a78bfa]/40 transition-all font-semibold">
              <Save className="w-3 h-3" />
              {editingJob ? 'Salvar alterações' : 'Salvar e Agendar'}
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
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        <span className="text-[#a78bfa] text-[9px] font-semibold">{job.expression}</span>
                        {job.command.startsWith('workflow:') ? (
                          <span className="flex items-center gap-1 text-[#f97316] text-[9px] bg-[#f97316]/10 px-1.5 py-0.5 rounded border border-[#f97316]/30">
                            <Zap className="w-2.5 h-2.5" />
                            Workflow: {workflows.find((w) => w.id === job.command.replace('workflow:', ''))?.name || job.command.replace('workflow:', '')}
                          </span>
                        ) : (
                          <span className="text-[#3a5a7a] text-[9px] truncate max-w-[220px]" title={job.command}>
                            {job.command}
                          </span>
                        )}
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
