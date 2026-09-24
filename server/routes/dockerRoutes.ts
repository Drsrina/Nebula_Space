/**
 * dockerRoutes.ts — Docker Monitor API do Nebula Workspace
 *
 * Suporta comunicação híbrida com o Docker Daemon:
 * 1. Docker Socket Unix (/var/run/docker.sock) em Linux / Mac / Containers
 * 2. Docker Windows Named Pipe (//./pipe/docker_engine)
 * 3. Fallback automático para Docker CLI (docker ps, docker start, docker stop)
 */

import { Router, Request, Response } from 'express';
import http from 'http';
import fs from 'fs';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);
export const dockerRouter = Router();

// Detecta socket ou pipe disponível
function getDockerConnection() {
  if (process.platform === 'win32') {
    // Windows Named Pipe ou socket padrão
    if (fs.existsSync('//./pipe/docker_engine')) {
      return { type: 'pipe', path: '//./pipe/docker_engine' };
    }
  }
  if (fs.existsSync('/var/run/docker.sock')) {
    return { type: 'socket', path: '/var/run/docker.sock' };
  }
  return null;
}

// Faz requisição HTTP direta ao Docker Socket / Pipe
function queryDockerSocket(path: string, method: string = 'GET'): Promise<{ status: number; data: any }> {
  return new Promise((resolve, reject) => {
    const conn = getDockerConnection();
    if (!conn) {
      return reject(new Error('Nenhum socket Docker encontrado.'));
    }

    const options: http.RequestOptions = {
      socketPath: conn.path,
      path,
      method,
      headers: {
        'Host': 'localhost',
        'Accept': 'application/json',
      },
    };

    const req = http.request(options, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => {
        try {
          const parsed = body ? JSON.parse(body) : null;
          resolve({ status: res.statusCode || 200, data: parsed });
        } catch {
          resolve({ status: res.statusCode || 200, data: body });
        }
      });
    });

    req.on('error', (err) => reject(err));
    req.setTimeout(5000, () => {
      req.destroy();
      reject(new Error('Timeout ao conectar no Docker socket.'));
    });
    req.end();
  });
}

// GET /api/docker/status
dockerRouter.get('/status', async (req: Request, res: Response) => {
  const conn = getDockerConnection();
  if (conn) {
    try {
      const ping = await queryDockerSocket('/_ping');
      if (ping.status === 200) {
        res.json({
          available: true,
          method: 'socket',
          socketPath: conn.path,
          platform: process.platform,
        });
        return;
      }
    } catch {
      // continua para fallback CLI
    }
  }

  // Tenta Docker CLI como fallback
  try {
    const { stdout } = await execAsync('docker version --format "{{.Server.Version}}"');
    res.json({
      available: true,
      method: 'cli',
      version: stdout.trim(),
      platform: process.platform,
    });
  } catch {
    res.json({
      available: false,
      socketFound: Boolean(conn),
      platform: process.platform,
      help: 'Certifique-se de que o Docker está rodando e monte o socket no docker-compose.yml: volumes: ["/var/run/docker.sock:/var/run/docker.sock:ro"]',
    });
  }
});

// GET /api/docker/containers
dockerRouter.get('/containers', async (req: Request, res: Response) => {
  const conn = getDockerConnection();

  // 1. Tenta via Socket direto
  if (conn) {
    try {
      const resp = await queryDockerSocket('/containers/json?all=1');
      if (Array.isArray(resp.data)) {
        const containers = resp.data.map((c: any) => ({
          id: (c.Id || '').slice(0, 12),
          fullId: c.Id,
          names: (c.Names || []).map((n: string) => n.replace(/^\//, '')),
          image: c.Image,
          command: c.Command,
          state: c.State, // running, exited, paused
          status: c.Status,
          created: c.Created,
          ports: (c.Ports || []).map((p: any) => ({
            ip: p.IP,
            privatePort: p.PrivatePort,
            publicPort: p.PublicPort,
            type: p.Type,
          })),
        }));

        res.json({ containers, source: 'socket' });
        return;
      }
    } catch {
      // fallback CLI
    }
  }

  // 2. Tenta via Docker CLI
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{json .}}"');
    const lines = stdout.trim().split('\n').filter(Boolean);
    const containers = lines.map((line) => {
      try {
        const item = JSON.parse(line);
        return {
          id: item.ID || '',
          fullId: item.ID || '',
          names: [item.Names || ''],
          image: item.Image || '',
          command: item.Command || '',
          state: (item.State || '').toLowerCase(),
          status: item.Status || '',
          created: item.CreatedAt || '',
          ports: item.Ports || '',
        };
      } catch {
        return null;
      }
    }).filter(Boolean);

    res.json({ containers, source: 'cli' });
  } catch (err: any) {
    res.json({
      containers: [],
      error: 'Não foi possível listar containers. Verifique a montagem do socket do Docker no docker-compose.',
      details: err.message,
    });
  }
});

// POST /api/docker/action (start, stop, restart)
dockerRouter.post('/action', async (req: Request, res: Response) => {
  const { id, action } = req.body as { id: string; action: 'start' | 'stop' | 'restart' };

  if (!id || !['start', 'stop', 'restart'].includes(action)) {
    res.status(400).json({ error: 'ID e ação válidos são obrigatórios (start, stop, restart).' });
    return;
  }

  // Sanitização estrita do ID (hexadecimal ou nome seguro)
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
    res.status(400).json({ error: 'ID de container inválido.' });
    return;
  }

  const conn = getDockerConnection();
  if (conn) {
    try {
      const resp = await queryDockerSocket(`/containers/${encodeURIComponent(id)}/${action}`, 'POST');
      if (resp.status >= 200 && resp.status < 300) {
        res.json({ success: true, action, id });
        return;
      }
    } catch {
      // fallback
    }
  }

  // Fallback CLI
  try {
    await execAsync(`docker ${action} ${id}`);
    res.json({ success: true, action, id });
  } catch (err: any) {
    res.status(500).json({ error: `Falha ao executar ${action}: ${err.message}` });
  }
});

// GET /api/docker/logs/:id
dockerRouter.get('/logs/:id', async (req: Request, res: Response) => {
  const { id } = req.params;
  if (!/^[a-zA-Z0-9_\-\.]+$/.test(id)) {
    res.status(400).json({ error: 'ID inválido.' });
    return;
  }

  try {
    const { stdout, stderr } = await execAsync(`docker logs --tail 100 ${id}`);
    res.json({ logs: stdout || stderr || 'Nenhum log registrado.' });
  } catch (err: any) {
    res.status(500).json({ error: `Erro ao obter logs: ${err.message}` });
  }
});
