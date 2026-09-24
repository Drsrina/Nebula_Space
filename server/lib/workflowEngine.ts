/**
 * workflowEngine.ts — Nebula Mini-n8n v2.6
 *
 * Motor de execução de workflows estilo n8n.
 * Percorre um grafo de nós em ordem topológica e executa cada nó em sequência.
 * Suporta SSE (Server-Sent Events) para streaming do progresso ao frontend.
 *
 * Nós suportados na Fase 1:
 * - trigger: dispara o início (manual, webhook ou cron)
 * - http-request: requisição HTTP externa
 * - code-box: executa JS em sandbox via node:vm
 * - condition: ramifica o fluxo (if/else) com expressão JS
 * - log-output: registra saída no histórico de execução
 */

import vm from 'vm';
import https from 'https';
import http from 'http';
import { spawn } from 'child_process';

export type NodeType =
  | 'trigger'
  | 'http-request'
  | 'code-box'
  | 'condition'
  | 'log-output'
  | 'discord-webhook'
  | 'telegram-bot';

export interface WorkflowNodePort {
  id: string;
  label?: string;
}

export interface WorkflowNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
  outputs?: WorkflowNodePort[];
}

export interface WorkflowConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
  targetPortId?: string;
}

export interface Workflow {
  id: string;
  name: string;
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
  createdAt: number;
  updatedAt: number;
}

export interface NodeResult {
  nodeId: string;
  status: 'success' | 'error' | 'skipped';
  output: unknown;
  error?: string;
  durationMs: number;
}

export interface ExecutionResult {
  executionId: string;
  workflowId: string;
  status: 'success' | 'error' | 'partial';
  startedAt: number;
  finishedAt: number;
  durationMs: number;
  nodeResults: NodeResult[];
}

export type ProgressCallback = (nodeId: string, status: 'running' | 'success' | 'error', output?: unknown) => void;

/**
 * Constrói a ordem topológica dos nós do workflow usando Kahn's algorithm.
 */
function topologicalSort(nodes: WorkflowNode[], connections: WorkflowConnection[]): WorkflowNode[] {
  const inDegree = new Map<string, number>();
  const adjList = new Map<string, string[]>();

  for (const node of nodes) {
    inDegree.set(node.id, 0);
    adjList.set(node.id, []);
  }

  for (const conn of connections) {
    inDegree.set(conn.targetNodeId, (inDegree.get(conn.targetNodeId) ?? 0) + 1);
    adjList.get(conn.sourceNodeId)?.push(conn.targetNodeId);
  }

  const queue: string[] = [];
  for (const [id, deg] of inDegree) {
    if (deg === 0) queue.push(id);
  }

  const sorted: string[] = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);
    for (const neighbor of adjList.get(current) ?? []) {
      const newDeg = (inDegree.get(neighbor) ?? 0) - 1;
      inDegree.set(neighbor, newDeg);
      if (newDeg === 0) queue.push(neighbor);
    }
  }

  // Prevenção contra grafos cíclicos (Fix 1f50b18f)
  if (sorted.length < nodes.length) {
    throw new Error('Ciclo detectado no grafo do workflow. Workflows devem ser estritamente acíclicos (DAG).');
  }

  return sorted.map((id) => nodes.find((n) => n.id === id)!).filter(Boolean);
}

/**
 * Executa uma requisição HTTP simples (sem dependências externas).
 */
function httpFetch(url: string, options: Record<string, unknown>): Promise<{ status: number; body: string; headers: Record<string, string> }> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const isHttps = parsed.protocol === 'https:';
    const reqLib = isHttps ? https : http;

    const method = String(options.method ?? 'GET').toUpperCase();
    const body = options.body ? JSON.stringify(options.body) : undefined;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'User-Agent': 'Nebula-Workflow/2.6',
      ...(options.headers as Record<string, string> ?? {}),
    };
    if (body) headers['Content-Length'] = String(Buffer.byteLength(body));

    const req = reqLib.request({
      hostname: parsed.hostname,
      port: parsed.port || (isHttps ? 443 : 80),
      path: parsed.pathname + parsed.search,
      method,
      headers,
      timeout: 30000,
    }, (res) => {
      let data = '';
      res.on('data', (chunk: Buffer) => { data += chunk.toString(); });
      res.on('end', () => {
        resolve({
          status: res.statusCode ?? 0,
          body: data,
          headers: res.headers as Record<string, string>,
        });
      });
    });

    req.on('error', reject);
    req.on('timeout', () => { req.destroy(); reject(new Error('HTTP request timed out')); });

    if (body) req.write(body);
    req.end();
  });
}

/**
 * Verificação preventiva de padrões perigosos em código JS sandboxado (Fix 2846de1c)
 */
function checkDangerousJSPatterns(code: string): void {
  const DANGEROUS = [
    /\.constructor/,
    /\[\s*['"`]constructor['"`]\s*\]/,
    /__proto__/,
    /\bFunction\s*\(/,
    /\bimport\s*\(/,
    /\brequire\s*\(/,
    /\bchild_process\b/,
    /\bprocess\.mainModule\b/,
    /\bprocess\.binding\b/,
    /\bfs\s*\./,
  ];
  for (const pattern of DANGEROUS) {
    if (pattern.test(code)) {
      throw new Error(`Execução bloqueada por política de segurança da sandbox: padrão proibido detectado (${pattern})`);
    }
  }
}

/**
 * Executa um trecho de código JavaScript em sandbox isolada via node:vm com proteção contra prototype escape.
 * O código tem acesso às variáveis de contexto do fluxo.
 */
export function executeSandboxJS(code: string, context: Record<string, unknown>): unknown {
  checkDangerousJSPatterns(code);

  const safeContext = JSON.parse(JSON.stringify(context));
  const sandbox = Object.create(null);
  Object.assign(sandbox, safeContext);

  sandbox.console = Object.freeze({
    log: (...args: unknown[]) => console.log('[Nebula VM]', ...args),
    error: (...args: unknown[]) => console.error('[Nebula VM]', ...args),
    warn: (...args: unknown[]) => console.warn('[Nebula VM]', ...args),
  });
  sandbox.result = undefined;

  const script = new vm.Script(`result = (function() { 'use strict'; ${code} })()`);
  const vmContext = vm.createContext(sandbox);
  script.runInContext(vmContext, { timeout: 10000 });
  return sandbox.result;
}

/**
 * Interpolação de templates {{ $json.chave }} ou {{ trigger.prop }} em strings de configuração.
 */
export function interpolateTemplates(text: string, context: Record<string, unknown>): string {
  if (!text || typeof text !== 'string') return text;
  return text.replace(/\{\{\s*([\w$.]+)\s*\}\}/g, (_, expr) => {
    try {
      const parts = expr.split('.');
      let current: any = context;
      for (const p of parts) {
        if (current == null) return '';
        current = current[p];
      }
      if (current === undefined || current === null) return '';
      return typeof current === 'object' ? JSON.stringify(current) : String(current);
    } catch {
      return '';
    }
  });
}

/**
 * Executa um trecho de script Python via subprocess isolado no host.
 */
function executePythonScript(code: string, context: Record<string, unknown>): Promise<unknown> {
  return new Promise((resolve, reject) => {
    const serialized = JSON.stringify(context);
    const pythonRunner = `
import json, sys

raw = sys.stdin.read()
context = json.loads(raw) if raw else {}
trigger = context.get('trigger', {})
input_data = context.get('$input')
json_data = context.get('$json')
items = context.get('items', [])

def run():
${code.split('\n').map((l) => '    ' + l).join('\n')}

res = run()
if res is not None:
    print(json.dumps({'result': res}))
`;

    const isWin = process.platform === 'win32';
    const pyCmd = isWin ? 'python' : 'python3';
    const proc = spawn(pyCmd, ['-c', pythonRunner], { timeout: 15000 });

    let stdout = '';
    let stderr = '';

    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.stdin.write(serialized);
    proc.stdin.end();

    proc.on('error', (err) => {
      reject(new Error(`Falha ao invocar Python: ${err.message}. Certifique-se de que o Python está instalado no servidor.`));
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        reject(new Error(stderr.trim() || `Script Python encerrou com erro (código ${code})`));
      } else {
        const trimmed = stdout.trim();
        try {
          const parsed = JSON.parse(trimmed);
          resolve(parsed.result !== undefined ? parsed.result : parsed);
        } catch {
          resolve(trimmed);
        }
      }
    });
  });
}

/**
 * Motor principal: executa um workflow completo.
 * Chama progressCallback a cada transição de estado de nó.
 */
export async function executeWorkflow(
  workflow: Workflow,
  triggerPayload: Record<string, unknown> = {},
  progressCallback?: ProgressCallback
): Promise<ExecutionResult> {
  const executionId = `exec-${Date.now()}`;
  const startedAt = Date.now();
  const nodeResults: NodeResult[] = [];

  // Contexto compartilhado entre os nós (variáveis de fluxo)
  const flowContext: Record<string, unknown> = {
    trigger: triggerPayload,
  };

  // Rastreia quais nós estão "ativos" por ramo (para condition branches)
  const skipNodes = new Set<string>();

  let executionStatus: 'success' | 'error' | 'partial' = 'success';

  // Ordena nós topologicamente
  const orderedNodes = topologicalSort(workflow.nodes, workflow.connections);
  const nodeOutputs = new Map<string, unknown>();

  for (const node of orderedNodes) {
    if (skipNodes.has(node.id)) {
      nodeResults.push({ nodeId: node.id, status: 'skipped', output: null, durationMs: 0 });
      continue;
    }

    const nodeStart = Date.now();
    progressCallback?.(node.id, 'running');

    // Mapeamento de I/O: coletar saídas dos nós predecessores conectados
    const incomingConns = workflow.connections.filter((c) => c.targetNodeId === node.id);
    const incomingOutputs = incomingConns
      .map((c) => nodeOutputs.get(c.sourceNodeId))
      .filter((v) => v !== undefined);

    let rawInput: unknown = null;
    if (incomingOutputs.length === 1) {
      rawInput = incomingOutputs[0];
    } else if (incomingOutputs.length > 1) {
      rawInput = incomingOutputs;
    } else {
      rawInput = flowContext['trigger'] ?? triggerPayload;
    }

    // Extrair $json do input (se for http-request { status, body }, extrai body)
    let jsonPayload: unknown = rawInput;
    if (rawInput && typeof rawInput === 'object' && 'body' in (rawInput as Record<string, unknown>)) {
      jsonPayload = (rawInput as Record<string, unknown>).body;
    }

    const items = Array.isArray(jsonPayload)
      ? jsonPayload
      : jsonPayload !== null && jsonPayload !== undefined
      ? [jsonPayload]
      : [];

    // Contexto de execução local do nó
    const nodeContext: Record<string, unknown> = {
      ...flowContext,
      $input: rawInput,
      $json: jsonPayload,
      $prev: rawInput,
      input: rawInput,
      items,
    };

    try {
      let output: unknown = null;

      switch (node.type) {
        case 'trigger': {
          output = triggerPayload;
          flowContext['trigger'] = output;
          break;
        }

        case 'http-request': {
          let url = String(node.config.url ?? '');
          const method = String(node.config.method ?? 'GET').toUpperCase();
          const headers = (node.config.headers as Record<string, string>) || {};
          let body = node.config.body;

          if (!url) throw new Error('URL não configurada no nó HTTP Request');

          // Interpolação de templates {{ $json.chave }} ou {{ trigger.prop }} na URL
          url = interpolateTemplates(url, nodeContext);

          // Se body for string, interpola variáveis
          if (typeof body === 'string') {
            const interpolated = interpolateTemplates(body, nodeContext);
            try { body = JSON.parse(interpolated); } catch { body = interpolated; }
          } else if (!body && ['POST', 'PUT', 'PATCH'].includes(method) && jsonPayload && typeof jsonPayload === 'object') {
            // Repassa automaticamente o payload JSON do nó anterior se nenhum body for fornecido
            body = jsonPayload;
          }

          const response = await httpFetch(url, { method, headers, body });
          let parsedBody: unknown = response.body;
          try { parsedBody = JSON.parse(response.body); } catch {}

          output = { status: response.status, body: parsedBody, headers: response.headers };
          flowContext[`${node.id}_response`] = output;
          flowContext['response'] = output;
          break;
        }

        case 'code-box': {
          const code = String(node.config.code ?? '');
          const language = String(node.config.language ?? 'javascript').toLowerCase();
          if (!code.trim()) { output = null; break; }

          if (language === 'python') {
            output = await executePythonScript(code, nodeContext);
          } else {
            output = executeSandboxJS(code, nodeContext);
          }

          flowContext[`${node.id}_result`] = output;
          flowContext['result'] = output;
          break;
        }

        case 'condition': {
          const expression = String(node.config.expression ?? 'false');
          let condResult = false;
          try {
            condResult = Boolean(executeSandboxJS(`return (${expression})`, nodeContext));
          } catch {}

          output = { conditionMet: condResult };

          // Determinar nós nos ramos true/false para skip recursivo (Fix 1f50b18f)
          const truePortId = 'true';
          const falsePortId = 'false';

          const addDescendantsToSkip = (startNodeId: string) => {
            const queue = [startNodeId];
            while (queue.length > 0) {
              const curr = queue.shift()!;
              skipNodes.add(curr);
              for (const c of workflow.connections) {
                if (c.sourceNodeId === curr && !skipNodes.has(c.targetNodeId)) {
                  queue.push(c.targetNodeId);
                }
              }
            }
          };

          for (const conn of workflow.connections) {
            if (conn.sourceNodeId === node.id) {
              if (!condResult && conn.sourcePortId === truePortId) {
                addDescendantsToSkip(conn.targetNodeId);
              } else if (condResult && conn.sourcePortId === falsePortId) {
                addDescendantsToSkip(conn.targetNodeId);
              }
            }
          }
          break;
        }

        case 'discord-webhook': {
          const webhookUrl = String(node.config.webhookUrl ?? '');
          if (!webhookUrl) throw new Error('URL do Discord Webhook não configurada');
          const rawContent = node.config.content ? String(node.config.content) : '';
          const content = rawContent
            ? interpolateTemplates(rawContent, nodeContext)
            : (typeof jsonPayload === 'string'
              ? jsonPayload
              : JSON.stringify(jsonPayload ?? flowContext['result'] ?? flowContext, null, 2));

          const username = node.config.username ? String(node.config.username) : 'Nebula Workflow';
          const avatarUrl = node.config.avatarUrl ? String(node.config.avatarUrl) : undefined;

          const payload: Record<string, unknown> = { content, username };
          if (avatarUrl) payload.avatar_url = avatarUrl;

          const response = await httpFetch(webhookUrl, {
            method: 'POST',
            body: payload,
          });

          output = { status: response.status, body: response.body };
          flowContext[`${node.id}_result`] = output;
          break;
        }

        case 'telegram-bot': {
          const botToken = String(node.config.botToken ?? '');
          const chatId = String(node.config.chatId ?? '');
          if (!botToken || !chatId) throw new Error('Bot Token e Chat ID são obrigatórios no nó Telegram Bot');
          const rawMessage = node.config.message ? String(node.config.message) : '';
          const message = rawMessage
            ? interpolateTemplates(rawMessage, nodeContext)
            : (typeof jsonPayload === 'string'
              ? jsonPayload
              : JSON.stringify(jsonPayload ?? flowContext['result'] ?? flowContext, null, 2));

          const telegramUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

          const response = await httpFetch(telegramUrl, {
            method: 'POST',
            body: {
              chat_id: chatId,
              text: message,
              parse_mode: node.config.parseMode ?? 'HTML',
            },
          });

          output = { status: response.status, body: response.body };
          flowContext[`${node.id}_result`] = output;
          break;
        }

        case 'log-output': {
          const template = node.config.message ? String(node.config.message) : '';
          const message = template
            ? interpolateTemplates(template, nodeContext)
            : JSON.stringify(jsonPayload ?? rawInput ?? flowContext['result'] ?? flowContext, null, 2);
          output = { logged: message };
          console.log(`[Nebula Workflow ${workflow.id}] Node ${node.label}:`, message);
          break;
        }
      }

      const durationMs = Date.now() - nodeStart;
      nodeOutputs.set(node.id, output);
      nodeResults.push({ nodeId: node.id, status: 'success', output, durationMs });
      progressCallback?.(node.id, 'success', output);

    } catch (err) {
      const durationMs = Date.now() - nodeStart;
      const errorMsg = err instanceof Error ? err.message : String(err);
      nodeResults.push({ nodeId: node.id, status: 'error', output: null, error: errorMsg, durationMs });
      progressCallback?.(node.id, 'error', { error: errorMsg });
      executionStatus = 'partial';
      // Continua execução dos nós restantes mesmo após erro em um nó
    }
  }

  const finishedAt = Date.now();
  return {
    executionId,
    workflowId: workflow.id,
    status: executionStatus,
    startedAt,
    finishedAt,
    durationMs: finishedAt - startedAt,
    nodeResults,
  };
}
