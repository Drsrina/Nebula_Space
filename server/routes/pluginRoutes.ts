/**
 * pluginRoutes.ts — Nebula Plugin System v2.6 (Cached & Non-blocking)
 *
 * Endpoint /api/plugins para carregar e listar plugins instalados.
 * Plugins ficam no diretório DATA_DIR/plugins/.
 * Implementa cache em memória com TTL de 60s e endpoint de recarregamento.
 */

import { Router, Request, Response } from 'express';
import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';

export const pluginRouter = Router();

const DATA_DIR = process.env.NEBULA_DATA_DIR || path.join(process.cwd(), 'data');
const PLUGINS_DIR = path.join(DATA_DIR, 'plugins');

// Cache em memória
let cachedPlugins: unknown[] | null = null;
let cacheExpiry = 0;
const CACHE_TTL_MS = 60000; // 60 segundos

async function ensurePluginsDir() {
  await fs.mkdir(PLUGINS_DIR, { recursive: true });
  // Ensure hello-world sample plugin exists
  const sampleDir = path.join(PLUGINS_DIR, 'hello-world');
  if (!fsSync.existsSync(sampleDir)) {
    await fs.mkdir(sampleDir, { recursive: true });
    const manifest = {
      id: 'hello-world',
      name: 'Hello World Plugin',
      version: '1.0.0',
      description: 'Plugin de demonstração do sistema de extensões Nebula v2.6',
      author: 'Nebula Team',
      icon: 'sparkles',
      windowTypes: [
        {
          type: 'hello-world-view',
          title: 'Hello World Extension',
          defaultWidth: 480,
          defaultHeight: 320,
        },
      ],
      commands: [
        {
          id: 'hello:greet',
          label: 'Hello World: Mostrar Saudação',
        },
      ],
    };
    await fs.writeFile(path.join(sampleDir, 'plugin.json'), JSON.stringify(manifest, null, 2), 'utf-8');
  }
}

async function scanPlugins(): Promise<unknown[]> {
  await ensurePluginsDir();
  const dirs = await fs.readdir(PLUGINS_DIR);
  const plugins = [];

  for (const dir of dirs) {
    const manifestPath = path.join(PLUGINS_DIR, dir, 'plugin.json');
    try {
      const content = await fs.readFile(manifestPath, 'utf-8');
      plugins.push(JSON.parse(content));
    } catch {
      // Ignora diretórios sem manifest válido
    }
  }

  return plugins;
}

// GET /api/plugins — Retorna plugins usando cache
pluginRouter.get('/', async (_req: Request, res: Response) => {
  const now = Date.now();
  if (cachedPlugins && now < cacheExpiry) {
    res.json(cachedPlugins);
    return;
  }

  try {
    cachedPlugins = await scanPlugins();
    cacheExpiry = now + CACHE_TTL_MS;
    res.json(cachedPlugins);
  } catch (err) {
    res.status(500).json({ error: 'Erro ao listar plugins.' });
  }
});

// POST /api/plugins/reload — Invalida cache e recarrega do disco
pluginRouter.post('/reload', async (_req: Request, res: Response) => {
  try {
    cachedPlugins = await scanPlugins();
    cacheExpiry = Date.now() + CACHE_TTL_MS;
    res.json({ ok: true, count: cachedPlugins.length });
  } catch (err) {
    res.status(500).json({ error: 'Erro ao recarregar plugins.' });
  }
});
