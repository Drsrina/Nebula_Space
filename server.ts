import express from 'express';
import path from 'path';
import { fsRouter } from './server/routes/fsRoutes';
import { taskRouter } from './server/routes/taskRoutes';
import { authRouter } from './server/routes/authRoutes';
import { workflowRouter } from './server/routes/workflowRoutes';
import { cronRouter, initCronScheduler } from './server/routes/cronRoutes';
import { proxyRouter } from './server/routes/proxyRoutes';
import { pluginRouter } from './server/routes/pluginRoutes';
import { dockerRouter } from './server/routes/dockerRoutes';
import { requireAuth } from './server/lib/auth';
import { getAllowedRoots } from './server/lib/security';

async function startServer() {
  const app = express();
  const PORT = Number(process.env.PORT || 3000);

  // Increase payload limit for file writes (up to 15MB)
  app.use(express.json({ limit: '15mb' }));
  app.use(express.urlencoded({ extended: true, limit: '15mb' }));

  // CORS headers
  app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Methods', 'GET,PUT,POST,DELETE,OPTIONS');
    res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    if (req.method === 'OPTIONS') {
      res.sendStatus(200);
      return;
    }
    next();
  });

  // =========================================================================
  // AUTH ROUTES — Abertas, sem requireAuth
  // =========================================================================
  app.use('/api/auth', authRouter);

  // =========================================================================
  // SYSTEM HEALTH & STATUS CHECK
  // =========================================================================
  app.get('/api/health', (req, res) => {
    const roots = getAllowedRoots();
    const isReadOnly = process.env.NEBULA_READONLY === 'true';
    const authRequired = Boolean(process.env.NEBULA_ADMIN_PASSWORD);
    const mfaEnabled = Boolean(process.env.NEBULA_MFA_SECRET);

    res.json({
      status: 'ok',
      service: 'nebula-filesystem-api',
      version: '2.6.0',
      mode: isReadOnly ? 'readonly' : 'readwrite',
      authRequired,
      mfaEnabled,
      roots: roots.map((r) => ({ name: r.name, path: r.path })),
      timestamp: new Date().toISOString(),
    });
  });

  // =========================================================================
  // FILESYSTEM API ROUTES — Protegidas por requireAuth
  // =========================================================================

  app.use('/api/fs', requireAuth, fsRouter);
  app.use('/api/tasks', requireAuth, taskRouter);

  // =========================================================================
  // WORKFLOW & CRON API — v2.6 / v2.7
  // =========================================================================
  // Webhooks públicos abertos para serviços externos (/api/workflows/webhook/:webhookId)
  // Todas as demais rotas de /api/workflows exigem autenticação via requireAuth
  app.use(
    '/api/workflows',
    (req, res, next) => {
      if (req.path.startsWith('/webhook/')) {
        return next();
      }
      return requireAuth(req, res, next);
    },
    workflowRouter
  );
  app.use('/api/cron', requireAuth, cronRouter);
  app.use('/api/proxy', requireAuth, proxyRouter);
  app.use('/api/plugins', requireAuth, pluginRouter);
  app.use('/api/docker', requireAuth, dockerRouter);


  // =========================================================================
  // TERMINAL API — Executa comandos no servidor (selfhosted only)
  // Restrito: só permite execução se NEBULA_READONLY != 'true' e autenticado
  // =========================================================================
  app.post('/api/terminal/exec', requireAuth, async (req, res) => {
    if (process.env.NEBULA_READONLY === 'true') {
      res.status(403).json({ error: 'Terminal desabilitado em modo readonly.' });
      return;
    }

    const { command, cwd } = req.body as { command: string; cwd?: string };
    if (!command || typeof command !== 'string') {
      res.status(400).json({ error: 'Comando inválido.' });
      return;
    }

    const { exec } = await import('child_process');
    const { getAllowedRoots, validateAndResolvePath } = await import('./server/lib/security');
    const fs = await import('fs');
    const path = await import('path');
    const allowedRoots = getAllowedRoots().map((r) => r.path);

    // Validação estrita do diretório de trabalho contra as raízes permitidas
    let workDir = allowedRoots[0] || process.cwd();
    if (cwd && cwd !== '~') {
      const resolved = validateAndResolvePath(cwd);
      if (resolved.error || !resolved.resolvedPath) {
        res.status(403).json({ error: resolved.error || 'Diretório fora das raízes permitidas.' });
        return;
      }
      workDir = resolved.resolvedPath;
    }

    const trimmedCmd = command.trim();

    // Tratamento nativo e persistente do comando `cd`
    if (trimmedCmd === 'cd' || trimmedCmd === 'cd ~') {
      const homeRoot = allowedRoots[0] || process.cwd();
      res.json({ stdout: '', stderr: '', cwd: homeRoot });
      return;
    }

    if (trimmedCmd.startsWith('cd ')) {
      const targetRaw = trimmedCmd.slice(3).trim().replace(/^['"]|['"]$/g, '');
      const targetResolved = path.resolve(workDir, targetRaw);
      const validation = validateAndResolvePath(targetResolved);

      if (validation.error || !validation.resolvedPath) {
        res.json({
          stdout: '',
          stderr: `cd: ${targetRaw}: Diretório fora das raízes permitidas.\n`,
          cwd: workDir,
        });
        return;
      }

      if (!fs.existsSync(validation.resolvedPath) || !fs.statSync(validation.resolvedPath).isDirectory()) {
        res.json({
          stdout: '',
          stderr: `cd: ${targetRaw}: Diretório não encontrado ou não é uma pasta.\n`,
          cwd: workDir,
        });
        return;
      }

      res.json({ stdout: '', stderr: '', cwd: validation.resolvedPath });
      return;
    }

    // Execução assíncrona não bloqueante com timeout e buffer controlado
    const shellBin = process.platform === 'win32' ? undefined : (fs.existsSync('/bin/bash') ? '/bin/bash' : '/bin/sh');
    exec(
      command,
      {
        cwd: workDir,
        shell: shellBin,
        timeout: 20000,
        maxBuffer: 2 * 1024 * 1024, // 2MB
        encoding: 'utf8',
        env: {
          ...process.env,
          TERM: 'xterm-256color',
          COLORTERM: 'truecolor',
          FORCE_COLOR: '1',
          PWD: workDir,
        },
      },
      (err, stdout, stderr) => {
        res.json({
          stdout: stdout || '',
          stderr: (stderr || '') + (err && !stderr ? err.message : ''),
          cwd: workDir,
        });
      }
    );
  });

  // =========================================================================
  // AI CHAT API — Integração com Gemini (requer GEMINI_API_KEY e requireAuth)
  // =========================================================================
  app.post('/api/ai/chat', requireAuth, async (req, res) => {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      res.status(503).json({ error: 'GEMINI_API_KEY não configurada no .env do servidor.' });
      return;
    }

    const { prompt, systemPrompt } = req.body as { prompt: string; systemPrompt?: string };
    if (!prompt) {
      res.status(400).json({ error: 'Prompt obrigatório.' });
      return;
    }

    try {
      const { GoogleGenAI } = await import('@google/genai');
      const ai = new GoogleGenAI({ apiKey });
      const result = await ai.models.generateContent({
        model: 'gemini-2.0-flash',
        contents: prompt,
        config: systemPrompt ? { systemInstruction: systemPrompt } : undefined,
      });
      res.json({ response: result.text });
    } catch (err: any) {
      console.error('[Nebula AI] Erro:', err.message);
      res.status(500).json({ error: err.message });
    }
  });

  // =========================================================================
  // VITE DEV MIDDLEWARE OR PRODUCTION STATIC SERVING
  // =========================================================================
  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`[Nebula Server] Running on http://0.0.0.0:${PORT}`);
    console.log(`[Nebula Server] Permitted Roots:`, getAllowedRoots().map((r) => r.path).join(', '));
    if (process.env.NEBULA_TOKEN) {
      console.log(`[Nebula Server] Bearer Token authentication is ACTIVE.`);
    } else {
      console.log(`[Nebula Server] NOTICE: No NEBULA_TOKEN set. Dev mode open access.`);
    }
    // Initialize cron scheduler after server is listening
    initCronScheduler();
  });
}

startServer().catch((err) => {
  console.error('[Nebula Server] Fatal startup error:', err);
  process.exit(1);
});
