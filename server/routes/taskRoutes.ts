import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import path from 'path';
import { spawn, ChildProcess } from 'child_process';
import { getAllowedRoots, readOnlyGuard, validateAndResolvePath } from '../lib/security';

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
 * Reads package.json scripts and auto-discovers runnable scripts in workspace
 */
taskRouter.get('/list', async (req: Request, res: Response) => {
  try {
    const root = getAllowedRoots()[0]?.path || process.cwd();
    const pkgPath = path.join(root, 'package.json');

    let scriptList: Array<{ name: string; command: string }> = [];
    let pkgName = 'workspace';

    try {
      const content = await fs.readFile(pkgPath, 'utf8');
      const pkg = JSON.parse(content);
      pkgName = pkg.name || 'workspace';
      const scripts = pkg.scripts || {};
      scriptList = Object.entries(scripts).map(([name, command]) => ({
        name,
        command: String(command),
      }));
    } catch {}

    // Auto-discovery of script files in workspace (.py, .sh, .js, .ts)
    const discoveredCustomScripts: Array<{ name: string; path: string; type: 'python' | 'shell' | 'node'; command: string }> = [];
    const dirsToScan = [root, path.join(root, 'scripts')];

    for (const dir of dirsToScan) {
      try {
        const entries = await fs.readdir(dir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase();
            const relPath = path.relative(root, path.join(dir, entry.name)).replace(/\\/g, '/');
            if (ext === '.py') {
              discoveredCustomScripts.push({ name: entry.name, path: relPath, type: 'python', command: `python3 ${relPath}` });
            } else if (ext === '.sh') {
              discoveredCustomScripts.push({ name: entry.name, path: relPath, type: 'shell', command: `bash ${relPath}` });
            } else if (['.js', '.mjs'].includes(ext) && !entry.name.includes('config') && !entry.name.includes('test')) {
              discoveredCustomScripts.push({ name: entry.name, path: relPath, type: 'node', command: `node ${relPath}` });
            }
          }
        }
      } catch {}
    }

    // Active tasks in memory
    const activeTasksList = Array.from(activeTasks.values()).map((t) => ({
      id: t.id,
      script: t.script,
      status: t.status,
      startedAt: t.startedAt,
    }));

    res.json({
      root,
      packageName: pkgName,
      scripts: scriptList,
      customScripts: discoveredCustomScripts,
      activeTasks: activeTasksList,
    });
  } catch (err: any) {
    res.status(500).json({ error: err.message || 'Could not read package.json scripts' });
  }
});

/**
 * POST /api/tasks/run
 * Executes an npm script or auto-discovered workspace script
 */
taskRouter.post('/run', readOnlyGuard, async (req: Request, res: Response) => {
  const { script } = req.body;
  if (!script || typeof script !== 'string') {
    res.status(400).json({ error: 'Missing or invalid "script" parameter' });
    return;
  }

  // 1. Sanitização estrita contra injeção de comandos de shell
  const SCRIPT_NAME_REGEX = /^[a-zA-Z0-9_:./-]+$/;
  if (!SCRIPT_NAME_REGEX.test(script) || script.includes('..') || script.includes(';') || script.includes('|') || script.includes('&') || script.includes('`')) {
    res.status(400).json({
      error: 'Nome de script inválido. Apenas caracteres alfanuméricos, hífen, underline, barra e dois-pontos são permitidos.',
    });
    return;
  }

  const root = getAllowedRoots()[0]?.path || process.cwd();
  const pkgPath = path.join(root, 'package.json');

  let isPkgScript = false;
  let customScriptPath: string | null = null;
  let customScriptType: 'python' | 'shell' | 'node' = 'node';

  // 2. Valida se o script realmente existe no package.json ou é arquivo de script válido
  try {
    const content = await fs.readFile(pkgPath, 'utf8');
    const pkg = JSON.parse(content);
    if (pkg.scripts && Object.prototype.hasOwnProperty.call(pkg.scripts, script)) {
      isPkgScript = true;
    }
  } catch {}

  if (!isPkgScript) {
    const cleanPath = script.replace(/^custom:/, '');
    const validation = validateAndResolvePath(path.resolve(root, cleanPath));
    if (validation.resolvedPath) {
      try {
        const stat = await fs.stat(validation.resolvedPath);
        if (stat.isFile()) {
          customScriptPath = validation.resolvedPath;
          const ext = path.extname(cleanPath).toLowerCase();
          if (ext === '.py') customScriptType = 'python';
          else if (ext === '.sh') customScriptType = 'shell';
          else customScriptType = 'node';
        }
      } catch {}
    }

    if (!customScriptPath) {
      res.status(400).json({
        error: `Script "${script}" não foi encontrado em package.json.`,
      });
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

  let spawnCmd: string;
  let spawnArgs: string[];
  let startLog: string;

  if (isPkgScript) {
    spawnCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
    spawnArgs = ['run', script];
    startLog = `[Nebula Runner] Iniciando: npm run ${script}\n`;
  } else {
    if (customScriptType === 'python') {
      spawnCmd = process.platform === 'win32' ? 'python' : 'python3';
    } else if (customScriptType === 'shell') {
      spawnCmd = process.platform === 'win32' ? 'powershell.exe' : 'bash';
    } else {
      spawnCmd = 'node';
    }
    spawnArgs = [customScriptPath!];
    startLog = `[Nebula Runner] Executando script descoberto: ${path.basename(customScriptPath!)}\n`;
  }

  const taskRecord: RunningTask = {
    id: taskId,
    script,
    status: 'running',
    exitCode: null,
    startedAt: Date.now(),
    logs: [startLog],
  };

  const child = spawn(spawnCmd, spawnArgs, {
    cwd: root,
    shell: false,
    env: { ...process.env, FORCE_COLOR: '1' },
  });

  taskRecord.process = child;
  activeTasks.set(taskId, taskRecord);

  child.stdout?.on('data', (chunk) => {
    taskRecord.logs.push(chunk.toString());
    if (taskRecord.logs.length > 500) taskRecord.logs.shift();
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
