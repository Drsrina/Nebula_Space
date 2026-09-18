import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { taskRouter } from '../server/routes/taskRoutes';

describe('Task Runner Routes — Command Injection & Execution Guardrails', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/tasks', taskRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/tasks`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('Lista scripts existentes no package.json', async () => {
    const res = await fetch(`${baseUrl}/list`);
    assert.strictEqual(res.status, 200);
    const data = await res.json();
    assert.ok(Array.isArray(data.scripts));
    assert.ok(data.scripts.some((s: any) => s.name === 'test' || s.name === 'build'));
  });

  test('Rejeita execução sem parâmetro script', async () => {
    const res = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /Missing or invalid "script"/i);
  });

  test('Bloqueia injeção de comando com operadores de shell (;, &&, |, `)', async () => {
    const maliciousPayloads = [
      'test; rm -rf /',
      'build && echo pwned',
      'dev | cat /etc/passwd',
      '`whoami`',
      'test > /dev/null',
      'test & calc.exe',
      'test\nwhoami',
    ];

    for (const script of maliciousPayloads) {
      const res = await fetch(`${baseUrl}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ script }),
      });
      assert.strictEqual(res.status, 400, `Deveria ter rejeitado: ${script}`);
      const data = await res.json();
      assert.match(data.error, /Nome de script inválido/i);
    }
  });

  test('Bloqueia execução de scripts não declarados em package.json', async () => {
    const res = await fetch(`${baseUrl}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ script: 'non_existent_exploit_script_123' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.match(data.error, /não foi encontrado em package\.json/i);
  });
});
