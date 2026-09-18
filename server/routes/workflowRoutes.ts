/**
 * workflowRoutes.ts — Nebula Mini-n8n v2.6
 *
 * API REST para criação, leitura, atualização, remoção e execução de workflows.
 * Workflows são persistidos como arquivos JSON em DATA_DIR/workflows/.
 * A execução usa SSE (Server-Sent Events) para streaming de progresso em tempo real.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs';
import path from 'path';
import { executeWorkflow, Workflow, ExecutionResult } from '../lib/workflowEngine';

export const workflowRouter = Router();

// Diretório de persistência de workflows
const DATA_DIR = process.env.NEBULA_DATA_DIR || path.join(process.cwd(), 'data');
const WORKFLOWS_DIR = path.join(DATA_DIR, 'workflows');
const HISTORY_DIR = path.join(DATA_DIR, 'workflow-history');

const ID_REGEX = /^[a-zA-Z0-9_-]+$/;

function validateId(id: string): boolean {
  return typeof id === 'string' && ID_REGEX.test(id);
}

function ensureDirs() {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
  fs.mkdirSync(HISTORY_DIR, { recursive: true });
}

function getWorkflowPath(id: string): string | null {
  if (!validateId(id)) return null;
  const target = path.resolve(WORKFLOWS_DIR, `${id}.json`);
  if (!target.startsWith(path.resolve(WORKFLOWS_DIR))) return null;
  return target;
}

function getHistoryPath(id: string): string | null {
  if (!validateId(id)) return null;
  const target = path.resolve(HISTORY_DIR, `${id}.json`);
  if (!target.startsWith(path.resolve(HISTORY_DIR))) return null;
  return target;
}

function listWorkflows(): Workflow[] {
  ensureDirs();
  try {
    return fs
      .readdirSync(WORKFLOWS_DIR)
      .filter((f) => f.endsWith('.json'))
      .map((f) => JSON.parse(fs.readFileSync(path.join(WORKFLOWS_DIR, f), 'utf-8')))
      .sort((a: Workflow, b: Workflow) => b.updatedAt - a.updatedAt);
  } catch {
    return [];
  }
}

function saveWorkflow(workflow: Workflow): boolean {
  ensureDirs();
  const p = getWorkflowPath(workflow.id);
  if (!p) return false;
  fs.writeFileSync(p, JSON.stringify(workflow, null, 2), 'utf-8');
  return true;
}

function saveExecutionHistory(result: ExecutionResult) {
  ensureDirs();
  const histPath = getHistoryPath(result.workflowId);
  if (!histPath) return;
  let history: ExecutionResult[] = [];
  try {
    history = JSON.parse(fs.readFileSync(histPath, 'utf-8'));
  } catch {}
  history.unshift(result);
  if (history.length > 50) history = history.slice(0, 50);
  fs.writeFileSync(histPath, JSON.stringify(history, null, 2), 'utf-8');
}

// ─── ALL /api/workflows/webhook/:webhookId ────────────────────────────────────
// Endpoint público para disparos externos de automações via Webhook
workflowRouter.all('/webhook/:webhookId', async (req: Request, res: Response) => {
  const { webhookId } = req.params;
  if (!validateId(webhookId)) {
    res.status(400).json({ error: 'Identificador de webhook inválido.' });
    return;
  }

  const workflows = listWorkflows();
  const targetWf = workflows.find((wf) =>
    wf.nodes.some(
      (n) => n.type === 'trigger' && (n.config?.webhookId === webhookId || n.id === webhookId)
    )
  );

  if (!targetWf) {
    res.status(404).json({ error: `Nenhum workflow ativo associado ao webhook "${webhookId}".` });
    return;
  }

  const triggerPayload = {
    method: req.method,
    query: req.query,
    body: req.body,
    headers: req.headers,
    webhookId,
    receivedAt: Date.now(),
  };

  try {
    const result = await executeWorkflow(targetWf, triggerPayload);
    saveExecutionHistory(result);
    res.json({
      ok: true,
      workflowId: targetWf.id,
      workflowName: targetWf.name,
      executionId: result.executionId,
      status: result.status,
      durationMs: result.durationMs,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Erro ao executar workflow via webhook.' });
  }
});

// ─── GET /api/workflows ────────────────────────────────────────────────────────
workflowRouter.get('/', (_req: Request, res: Response) => {
  res.json(listWorkflows());
});

// ─── POST /api/workflows ───────────────────────────────────────────────────────
workflowRouter.post('/', (req: Request, res: Response) => {
  const now = Date.now();
  const customId = req.body.id;
  const id = customId && validateId(customId) ? customId : `wf-${now}`;

  const workflow: Workflow = {
    name: 'Novo Workflow',
    nodes: [],
    connections: [],
    ...req.body,
    id,
    createdAt: now,
    updatedAt: now,
  };
  saveWorkflow(workflow);
  res.status(201).json(workflow);
});

// ─── GET /api/workflows/:id ────────────────────────────────────────────────────
workflowRouter.get('/:id', (req: Request, res: Response) => {
  const p = getWorkflowPath(req.params.id);
  if (!p) { res.status(400).json({ error: 'ID de workflow inválido.' }); return; }
  if (!fs.existsSync(p)) { res.status(404).json({ error: 'Workflow não encontrado.' }); return; }
  res.json(JSON.parse(fs.readFileSync(p, 'utf-8')));
});

// ─── PUT /api/workflows/:id ────────────────────────────────────────────────────
workflowRouter.put('/:id', (req: Request, res: Response) => {
  const p = getWorkflowPath(req.params.id);
  if (!p) { res.status(400).json({ error: 'ID de workflow inválido.' }); return; }
  if (!fs.existsSync(p)) { res.status(404).json({ error: 'Workflow não encontrado.' }); return; }
  const existing: Workflow = JSON.parse(fs.readFileSync(p, 'utf-8'));
  const updated: Workflow = { ...existing, ...req.body, id: req.params.id, updatedAt: Date.now() };
  saveWorkflow(updated);
  res.json(updated);
});

// ─── DELETE /api/workflows/:id ────────────────────────────────────────────────
workflowRouter.delete('/:id', (req: Request, res: Response) => {
  const p = getWorkflowPath(req.params.id);
  if (!p) { res.status(400).json({ error: 'ID de workflow inválido.' }); return; }
  if (!fs.existsSync(p)) { res.status(404).json({ error: 'Workflow não encontrado.' }); return; }
  fs.unlinkSync(p);
  res.json({ ok: true });
});

// ─── GET /api/workflows/:id/history ───────────────────────────────────────────
workflowRouter.get('/:id/history', (req: Request, res: Response) => {
  const histPath = getHistoryPath(req.params.id);
  if (!histPath) { res.status(400).json({ error: 'ID de workflow inválido.' }); return; }
  if (!fs.existsSync(histPath)) { res.json([]); return; }
  res.json(JSON.parse(fs.readFileSync(histPath, 'utf-8')));
});

// ─── POST /api/workflows/:id/run ──────────────────────────────────────────────
// Executa o workflow com SSE para streaming de progresso em tempo real.
workflowRouter.post('/:id/run', async (req: Request, res: Response) => {
  const p = getWorkflowPath(req.params.id);
  if (!p) { res.status(400).json({ error: 'ID de workflow inválido.' }); return; }
  if (!fs.existsSync(p)) { res.status(404).json({ error: 'Workflow não encontrado.' }); return; }

  const workflow: Workflow = JSON.parse(fs.readFileSync(p, 'utf-8'));

  // Setup SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disable nginx buffering

  const send = (event: string, data: unknown) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  };

  send('start', { workflowId: workflow.id, workflowName: workflow.name, timestamp: Date.now() });

  try {
    const result = await executeWorkflow(
      workflow,
      req.body ?? {},
      (nodeId, status, output) => {
        send('node', { nodeId, status, output, timestamp: Date.now() });
      }
    );

    saveExecutionHistory(result);
    send('done', result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    send('error', { error: msg });
  } finally {
    res.end();
  }
});

// ─── POST /api/workflows/exec-js ──────────────────────────────────────────────
// Executa um trecho JS sandboxado (usado pelo Code Box standalone).
workflowRouter.post('/exec-js', async (req: Request, res: Response) => {
  const { code, context } = req.body as { code?: string; context?: Record<string, unknown> };
  if (!code || typeof code !== 'string') {
    res.status(400).json({ error: 'Campo "code" obrigatório.' });
    return;
  }

  try {
    const { executeSandboxJS } = await import('../lib/workflowEngine');
    const result = executeSandboxJS(code, context ?? {});
    res.json({ result });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
});
