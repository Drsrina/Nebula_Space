import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getAllowedRoots, readOnlyGuard } from '../lib/security';

export const taskRouter = Router();

interface RunningTask {
  id: string;
  script: string;
  status: 'running' | 'success' | 'failed';
  exitCode: number | null;
  startedAt: number;
  logs: string[];
  process?: ChildProcess;
}

const activeTasks = new Map<string, RunningTask>();

/**
 * GET /api/tasks/list
 * Reads package.json scripts from the primary root directory
 */
taskRouter.get('/list', async (req: Request, res: Response) => {
  try {
    const root = getAllowedRoots()[0]?.path || process.cwd();
    const pkgPath = path.join(root, 'package.json');

    const content = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content);
    const scripts = pkg.scripts || {};

    const scriptList = Object.entries(scripts).map(([name, command]) => ({
      name,
      command: String(command),
    }));

    res.json({
      root,
      packageName: pkg.name || 'workspace',
      scripts: scriptList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not read package.json scripts' });
  }
});

/**
 * POST /api/tasks/run
 * Executes an npm script
 */
taskRouter.post('/run', readOnlyGuard, async (req: Request, res: Response) => {
  const { script } = req.body;
  if (!script || typeof script !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "script" parameter' });
    return;
  }

  // 1. Sanitização estrita contra injeção de comandos de shell
  const SCRIPT_NAME_REGEX = /^[a-zA-Z0-9_:.-]+$/;
  if (!SCRIPT_NAME_REGEX.test(script)) {
    res.status(400).json({
      error: 'Nome de script inválido. Apenas caracteres alfanuméricos, hífen, underline e dois-pontos são permitidos.',
    });
    return;
  }

  const root = getAllowedRoots()[0]?.path || process.cwd();
  const pkgPath = path.join(root, 'package.json');

  // 2. Valida se o script realmente existe no package.json
  try {
    const content = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content);
    if (!pkg.scripts || !Object.prototype.hasOwnProperty.call(pkg.scripts, script)) {
      res.status(400).json({
        error: `Script "${script}" não foi encontrado em package.json.`,
      });
      return;
    }
  } catch (err: any) {
    if (err.code !== 'ENOENT') {
      res.status(500).json({ error: 'Erro ao validar scripts do package.json' });
      return;
    }
  }

  // 3. Prevenção de vazamento de memória em activeTasks (mantém até 50 tarefas recentes)
  if (activeTasks.size >= 50) {
    const sorted = Array.from(activeTasks.values()).sort((a, b) => a.startedAt - b.startedAt);
    for (const t of sorted) {
      if (t.status !== 'running') {
        activeTasks.delete(t.id);
        if (activeTasks.size < 40) break;
      }
    }
  }

  const taskId = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

  const taskRecord: RunningTask = {
    id: taskId,
    script,
    status: 'running',
    exitCode: null,
    startedAt: Date.now(),
    logs: [`[Nebula Runner] Iniciando: npm run ${script}\n`],
  };

  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  const child = spawn(npmCmd, ['run', script], {
    cwd: root,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  taskRecord.process = child;
  activeTasks.set(taskId, taskRecord);

  child.stdout?.on('data', (chunk) => {
    taskRecord.logs.push(chunk.toString());
    if (taskRecord.logs.length > 500) taskRecord.logs.shift(); // keep last 500 lines
  });

  child.stderr?.on('data', (chunk) => {
    taskRecord.logs.push(chunk.toString());
    if (taskRecord.logs.length > 500) taskRecord.logs.shift();
  });

  child.on('close', (code) => {
    taskRecord.status = code === 0 ? 'success' : 'failed';
    taskRecord.exitCode = code;
    taskRecord.logs.push(`\n[Nebula Runner] Processo finalizado com código ${code}`);
  });

  child.on('error', (err) => {
    taskRecord.status = 'failed';
    taskRecord.logs.push(`\n[Nebula Runner] Erro ao executar: ${err.message}`);
  });

  res.json({
    taskId,
    script,
    status: 'running',
  });
});

/**
 * GET /api/tasks/status?taskId=...
 * Checks the status and retrieves accumulated logs of a task
 */
taskRouter.get('/status', (req: Request, res: Response) => {
  const taskId = req.query.taskId as string;
  if (!taskId || !activeTasks.has(taskId)) {
    res.status(404).json({ error: 'Task não encontrada' });
    return;
  }

  const task = activeTasks.get(taskId)!;
  res.json({
    id: task.id,
    script: task.script,
    status: task.status,
    exitCode: task.exitCode,
    startedAt: task.startedAt,
    logs: task.logs.join(''),
  });
});

/**
 * POST /api/tasks/stop
 * Terminates a running task
 */
taskRouter.post('/stop', (req: Request, res: Response) => {
  const { taskId } = req.body;
  if (!taskId || !activeTasks.has(taskId)) {
    res.status(404).json({ error: 'Task não encontrada' });
    return;
  }

  const task = activeTasks.get(taskId)!;
  if (task.process && task.status === 'running') {
    task.process.kill();
    task.status = 'failed';
    task.logs.push('\n[Nebula Runner] Execução interrompida pelo usuário.');
  }

  res.json({ success: true, taskId });
});
