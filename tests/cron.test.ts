import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import fs from 'fs/promises';
import path from 'path';
import { cronRouter } from '../server/routes/cronRoutes';

describe('Cron Routes — Crontab API & Path Traversal Protection', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;
  let testJobId = '';

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/cron', cronRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/cron`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    // Cleanup any test job created
    if (testJobId) {
      try {
        await fetch(`${baseUrl}/jobs/${testJobId}`, { method: 'DELETE' });
      } catch {}
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('Rejeita criação de job com campos obrigatórios ausentes', async () => {
    const res = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Incomplete' }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Campos obrigatórios: name, expression, command');
  });

  test('Rejeita expressão cron sintaticamente inválida', async () => {
    const res = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Invalid Cron',
        expression: 'not a valid cron expression',
        command: 'echo "hello"',
      }),
    });
    assert.strictEqual(res.status, 400);
    const data = await res.json();
    assert.strictEqual(data.error, 'Expressão cron inválida.');
  });

  test('Bloqueia ataques de Path Traversal no parâmetro :id', async () => {
    const maliciousIds = [
      '..',
      '../..',
      '../../etc/passwd',
      '..%2F..%2Fetc%2Fpasswd',
      'job..secret',
      'job/../secret',
      '../../../data/cron-jobs',
      'job<script>',
    ];

    for (const malId of maliciousIds) {
      const encoded = encodeURIComponent(malId);

      // Test GET logs
      const resLogs = await fetch(`${baseUrl}/jobs/${encoded}/logs`);
      assert.ok(resLogs.status === 400 || resLogs.status === 404, `Logs deveria rejeitar ${malId} (recebeu ${resLogs.status})`);

      // Test PUT
      const resPut = await fetch(`${baseUrl}/jobs/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked' }),
      });
      assert.ok(resPut.status === 400 || resPut.status === 404, `PUT deveria rejeitar ${malId} (recebeu ${resPut.status})`);

      // Test DELETE
      const resDel = await fetch(`${baseUrl}/jobs/${encoded}`, { method: 'DELETE' });
      assert.ok(resDel.status === 400 || resDel.status === 404, `DELETE deveria rejeitar ${malId} (recebeu ${resDel.status})`);

      // Test Run
      const resRun = await fetch(`${baseUrl}/jobs/${encoded}/run`, { method: 'POST' });
      assert.ok(resRun.status === 400 || resRun.status === 404, `Run deveria rejeitar ${malId} (recebeu ${resRun.status})`);
    }
  });

  test('Cria, lista, atualiza, executa e remove um cron job com sucesso', async () => {
    // 1. Create
    const createRes = await fetch(`${baseUrl}/jobs`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Test Automation Job',
        expression: '*/15 * * * *',
        command: 'node -v',
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);
    assert.strictEqual(created.name, 'Test Automation Job');
    testJobId = created.id;

    // 2. List
    const listRes = await fetch(`${baseUrl}/jobs`);
    assert.strictEqual(listRes.status, 200);
    const jobs = await listRes.json();
    assert.ok(Array.isArray(jobs));
    const found = jobs.find((j: any) => j.id === testJobId);
    assert.ok(found, 'O job criado deve constar na listagem');

    // 3. Update
    const updateRes = await fetch(`${baseUrl}/jobs/${testJobId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Updated Automation Job', isPaused: true }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.strictEqual(updated.name, 'Updated Automation Job');
    assert.strictEqual(updated.isPaused, true);

    // 4. Run Immediately
    const runRes = await fetch(`${baseUrl}/jobs/${testJobId}/run`, { method: 'POST' });
    assert.strictEqual(runRes.status, 200);
    const runData = await runRes.json();
    assert.ok(runData.log);
    assert.strictEqual(runData.log.status, 'success');
    assert.ok(runData.log.stdout.startsWith('v'), `stdout deveria ser versao do node: ${runData.log.stdout}`);

    // 5. Read Logs
    const logsRes = await fetch(`${baseUrl}/jobs/${testJobId}/logs`);
    assert.strictEqual(logsRes.status, 200);
    const logs = await logsRes.json();
    assert.ok(Array.isArray(logs));
    assert.ok(logs.length >= 1);
    assert.strictEqual(logs[0].status, 'success');

    // 6. Delete
    const delRes = await fetch(`${baseUrl}/jobs/${testJobId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 200);

    // 7. Verify deletion
    const verifyListRes = await fetch(`${baseUrl}/jobs`);
    const afterJobs = await verifyListRes.json();
    assert.ok(!afterJobs.some((j: any) => j.id === testJobId));
    testJobId = '';
  });
});
