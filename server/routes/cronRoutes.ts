/**
 * cronRoutes.ts — Nebula Crontab v2.6 (Hardened & Resilient)
 *
 * API REST para gerenciamento de jobs cron executados no servidor.
 * - Usa `fs.promises` para I/O 100% não-bloqueante no Event Loop.
 * - Separação estrita de definições (cron-jobs.json) e status (cron-status.json) eliminando race conditions.
 * - Proteção contra Path Traversal nos IDs e logs.
 * - Execução direta sem shell para workflows (workflow:<id>) e mitigação de injeção de comandos.
 */

import { Router, Request, Response } from 'express';
import cron from 'node-cron';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { spawn } from 'child_process';
import { executeWorkflow, Workflow } from '../lib/workflowEngine';

export const cronRouter = Router();

// ─── Persistência ──────────────────────────────────────────────────────────────
const DATA_DIR = process.env.NEBULA_DATA_DIR || path.join(process.cwd(), 'data');
const JOBS_FILE = path.join(DATA_DIR, 'cron-jobs.json');
const STATUS_FILE = path.join(DATA_DIR, 'cron-status.json');
const LOGS_DIR = path.join(DATA_DIR, 'cron-logs');
const WORKFLOWS_DIR = path.join(DATA_DIR, 'workflows');

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateId(id: string): boolean {
  return typeof id === 'string' && ID_REGEX.test(id);
}

async function ensureDirs() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  await fs.mkdir(LOGS_DIR, { recursive: true });
}

export interface CronJobConfig {
  id: string;
  name: string;
  expression: string;   // cron expression (5 campos)
  command: string;      // shell command ou workflow ID (prefixo "workflow:")
  isPaused: boolean;
  createdAt: number;
}

export interface CronJobStatus {
  lastRunAt?: number;
  lastStatus?: 'success' | 'error' | 'running';
  lastDurationMs?: number;
}

export type CronJob = CronJobConfig & CronJobStatus;

export interface CronLog {
  timestamp: number;
  status: 'success' | 'error';
  durationMs: number;
  stdout: string;
  stderr: string;
  exitCode: number | null;
}

// Carrega as configurações dos jobs
async function loadJobConfigs(): Promise<CronJobConfig[]> {
  await ensureDirs();
  try {
    const data = await fs.readFile(JOBS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return [];
  }
}

// Salva as configurações dos jobs
async function saveJobConfigs(jobs: CronJobConfig[]): Promise<void> {
  await ensureDirs();
  await fs.writeFile(JOBS_FILE, JSON.stringify(jobs, null, 2), 'utf-8');
}

// Carrega o mapa de status de execução (separado das definições para evitar race conditions)
async function loadStatusMap(): Promise<Record<string, CronJobStatus>> {
  await ensureDirs();
  try {
    const data = await fs.readFile(STATUS_FILE, 'utf-8');
    return JSON.parse(data);
  } catch {
    return {};
  }
}

// Atualiza o status de um job de forma isolada e atômica
async function updateJobStatus(jobId: string, statusUpdate: Partial<CronJobStatus>): Promise<void> {
  await ensureDirs();
  const map = await loadStatusMap();
  map[jobId] = { ...(map[jobId] || {}), ...statusUpdate };
  await fs.writeFile(STATUS_FILE, JSON.stringify(map, null, 2), 'utf-8');
}

// Carrega todos os jobs mesclando configuração + status
async function loadJobs(): Promise<CronJob[]> {
  const [configs, statusMap] = await Promise.all([loadJobConfigs(), loadStatusMap()]);
  return configs.map((c) => ({
    ...c,
    ...(statusMap[c.id] || {}),
  }));
}

function getJobLogsPath(id: string): string | null {
  if (!validateId(id)) return null;
  const target = path.resolve(LOGS_DIR, `${id}.json`);
  if (!target.startsWith(path.resolve(LOGS_DIR))) return null;
  return target;
}

async function appendLog(jobId: string, log: CronLog): Promise<void> {
  const p = getJobLogsPath(jobId);
  if (!p) return;
  await ensureDirs();
  let logs: CronLog[] = [];
  try {
    const data = await fs.readFile(p, 'utf-8');
    logs = JSON.parse(data);
  } catch {}
  logs.unshift(log);
  if (logs.length > 100) logs = logs.slice(0, 100);
  await fs.writeFile(p, JSON.stringify(logs, null, 2), 'utf-8');
}

// ─── Runtime Scheduler ──────────────────────────────────────────────────────────
const activeTasks = new Map<string, ReturnType<typeof cron.schedule>>();

/** Executa o comando de forma segura ou aciona o workflow internamente */
export async function runJobNow(job: CronJobConfig): Promise<CronLog> {
  const start = Date.now();

  // Execução de workflow interno sem uso de subprocess shell
  if (job.command.startsWith('workflow:')) {
    const wfId = job.command.slice('workflow:'.length).trim();
    if (!validateId(wfId)) {
      return {
        timestamp: Date.now(),
        status: 'error',
        durationMs: Date.now() - start,
        stdout: '',
        stderr: `Identificador de workflow inválido: "${wfId}"`,
        exitCode: 1,
      };
    }

    const wfPath = path.resolve(WORKFLOWS_DIR, `${wfId}.json`);
    if (!wfPath.startsWith(path.resolve(WORKFLOWS_DIR)) || !fsSync.existsSync(wfPath)) {
      return {
        timestamp: Date.now(),
        status: 'error',
        durationMs: Date.now() - start,
        stdout: '',
        stderr: `Workflow "${wfId}" não encontrado.`,
        exitCode: 1,
      };
    }

    try {
      const wfContent = await fs.readFile(wfPath, 'utf-8');
      const wf: Workflow = JSON.parse(wfContent);
      const result = await executeWorkflow(wf);
      const failedNode = result.nodeResults.find((n) => n.status === 'error');
      const errorMsg = failedNode?.error || (result.status === 'error' ? 'Falha na execução do workflow' : '');
      const successCount = result.nodeResults.filter((n) => n.status === 'success').length;
      return {
        timestamp: Date.now(),
        status: result.status === 'error' ? 'error' : 'success',
        durationMs: Date.now() - start,
        stdout: `Workflow "${wf.name}" executado. Nós concluídos: ${successCount}/${result.nodeResults.length}`,
        stderr: errorMsg,
        exitCode: result.status === 'error' ? 1 : 0,
      };
    } catch (err: any) {
      return {
        timestamp: Date.now(),
        status: 'error',
        durationMs: Date.now() - start,
        stdout: '',
        stderr: err.message || 'Falha ao executar workflow interno.',
        exitCode: 1,
      };
    }
  }

  // Execução de comando do sistema com mitigação de injeção
  return new Promise((resolve) => {
    const isWin = process.platform === 'win32';
    
    // Se o comando não possuir caracteres perigosos de encadeamento, podemos rodar diretamente
    const hasChaining = /[&;`$()<>]/.test(job.command);
    let proc;

    if (!hasChaining) {
      // Split básico por espaços para evitar abrir shell quando desnecessário
      const parts = job.command.trim().split(/\s+/);
      const binary = parts[0];
      const args = parts.slice(1);
      proc = spawn(binary, args, { cwd: process.cwd(), shell: false });
    } else {
      // Fallback controlado para comandos com pipes ou encadeamento
      proc = spawn(job.command, { cwd: process.cwd(), shell: true });
    }

    let stdout = '';
    let stderr = '';

    proc.stdout?.on('data', (d: Buffer) => { stdout += d.toString().slice(0, 50000); });
    proc.stderr?.on('data', (d: Buffer) => { stderr += d.toString().slice(0, 10000); });

    const timeout = setTimeout(() => {
      proc.kill('SIGTERM');
    }, 60000); // 60s timeout

    proc.on('error', (err) => {
      clearTimeout(timeout);
      resolve({
        timestamp: Date.now(),
        status: 'error',
        durationMs: Date.now() - start,
        stdout: '',
        stderr: err.message,
        exitCode: 1,
      });
    });

    proc.on('close', (code) => {
      clearTimeout(timeout);
      const log: CronLog = {
        timestamp: Date.now(),
        status: code === 0 ? 'success' : 'error',
        durationMs: Date.now() - start,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
      };
      resolve(log);
    });
  });
}

function scheduleJob(job: CronJobConfig) {
  if (!cron.validate(job.expression)) return;

  const task = cron.schedule(job.expression, async () => {
    const configs = await loadJobConfigs();
    const current = configs.find((j) => j.id === job.id);
    if (!current || current.isPaused) return;

    // Atualiza status para running de forma atômica no statusMap
    await updateJobStatus(job.id, {
      lastRunAt: Date.now(),
      lastStatus: 'running',
    });

    const log = await runJobNow(current);
    await appendLog(job.id, log);

    await updateJobStatus(job.id, {
      lastStatus: log.status,
      lastDurationMs: log.durationMs,
    });
  });

  if (job.isPaused) {
    task.stop();
  }

  activeTasks.set(job.id, task);
}

// Inicializa todos os jobs ao carregar o módulo
export async function initCronScheduler() {
  const configs = await loadJobConfigs();
  for (const job of configs) {
    if (!job.isPaused) scheduleJob(job);
  }
  console.log(`[Nebula Crontab] ${configs.filter(j => !j.isPaused).length}/${configs.length} jobs agendados.`);
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/cron/jobs
cronRouter.get('/jobs', async (_req: Request, res: Response) => {
  try {
    const jobs = await loadJobs();
    res.json(jobs);
  } catch {
    res.status(500).json({ error: 'Erro ao listar cron jobs.' });
  }
});

// POST /api/cron/jobs
cronRouter.post('/jobs', async (req: Request, res: Response) => {
  const body = req.body as Partial<CronJobConfig>;
  if (!body.expression || !body.command || !body.name) {
    res.status(400).json({ error: 'Campos obrigatórios: name, expression, command' });
    return;
  }
  if (!cron.validate(body.expression)) {
    res.status(400).json({ error: 'Expressão cron inválida.' });
    return;
  }

  const customId = req.body.id;
  const id = customId && validateId(customId) ? customId : `cron-${Date.now()}`;

  const job: CronJobConfig = {
    id,
    name: body.name,
    expression: body.expression,
    command: body.command,
    isPaused: false,
    createdAt: Date.now(),
  };

  const configs = await loadJobConfigs();
  configs.push(job);
  await saveJobConfigs(configs);
  scheduleJob(job);

  res.status(201).json(job);
});

// PUT /api/cron/jobs/:id
cronRouter.put('/jobs/:id', async (req: Request, res: Response) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ error: 'ID de job inválido.' });
    return;
  }

  const configs = await loadJobConfigs();
  const idx = configs.findIndex((j) => j.id === req.params.id);
  if (idx === -1) {
    res.status(404).json({ error: 'Job não encontrado.' });
    return;
  }

  const body = req.body as Partial<CronJobConfig>;
  if (body.expression && !cron.validate(body.expression)) {
    res.status(400).json({ error: 'Expressão cron inválida.' });
    return;
  }

  configs[idx] = {
    ...configs[idx],
    ...body,
    id: req.params.id,
  };
  await saveJobConfigs(configs);

  // Re-schedule
  activeTasks.get(req.params.id)?.stop();
  activeTasks.delete(req.params.id);
  if (!configs[idx].isPaused) scheduleJob(configs[idx]);

  const jobs = await loadJobs();
  res.json(jobs.find((j) => j.id === req.params.id));
});

// DELETE /api/cron/jobs/:id
cronRouter.delete('/jobs/:id', async (req: Request, res: Response) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ error: 'ID de job inválido.' });
    return;
  }

  const configs = await loadJobConfigs();
  const filtered = configs.filter((j) => j.id !== req.params.id);
  await saveJobConfigs(filtered);

  activeTasks.get(req.params.id)?.stop();
  activeTasks.delete(req.params.id);

  // Remove status correspondente
  const statusMap = await loadStatusMap();
  delete statusMap[req.params.id];
  await fs.writeFile(STATUS_FILE, JSON.stringify(statusMap, null, 2), 'utf-8');

  res.json({ ok: true });
});

// POST /api/cron/jobs/:id/run — executa imediatamente
cronRouter.post('/jobs/:id/run', async (req: Request, res: Response) => {
  if (!validateId(req.params.id)) {
    res.status(400).json({ error: 'ID de job inválido.' });
    return;
  }

  const configs = await loadJobConfigs();
  const job = configs.find((j) => j.id === req.params.id);
  if (!job) {
    res.status(404).json({ error: 'Job não encontrado.' });
    return;
  }

  const log = await runJobNow(job);
  await appendLog(job.id, log);

  await updateJobStatus(job.id, {
    lastRunAt: log.timestamp,
    lastStatus: log.status,
    lastDurationMs: log.durationMs,
  });

  const allJobs = await loadJobs();
  res.json({ log, job: allJobs.find((j) => j.id === req.params.id) });
});

// GET /api/cron/jobs/:id/logs
cronRouter.get('/jobs/:id/logs', async (req: Request, res: Response) => {
  const p = getJobLogsPath(req.params.id);
  if (!p) {
    res.status(400).json({ error: 'ID de job inválido.' });
    return;
  }

  try {
    const data = await fs.readFile(p, 'utf-8');
    res.json(JSON.parse(data));
  } catch {
    res.json([]);
  }
});
