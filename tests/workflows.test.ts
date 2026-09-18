import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import express from 'express';
import http from 'http';
import { workflowRouter } from '../server/routes/workflowRoutes';

describe('Workflow Routes — Mini-n8n API, SSE Streaming & Security', () => {
  let app: express.Express;
  let server: http.Server;
  let baseUrl: string;
  let testWorkflowId = '';

  before(async () => {
    app = express();
    app.use(express.json());
    app.use('/api/workflows', workflowRouter);

    await new Promise<void>((resolve) => {
      server = app.listen(0, '127.0.0.1', () => {
        const addr = server.address();
        if (addr && typeof addr === 'object') {
          baseUrl = `http://127.0.0.1:${addr.port}/api/workflows`;
        }
        resolve();
      });
    });
  });

  after(async () => {
    if (testWorkflowId) {
      try {
        await fetch(`${baseUrl}/${testWorkflowId}`, { method: 'DELETE' });
      } catch {}
    }

    await new Promise<void>((resolve) => {
      server.close(() => resolve());
    });
  });

  test('Bloqueia ataques de Path Traversal no parâmetro :id', async () => {
    const maliciousIds = [
      '..',
      '../..',
      '../../etc/passwd',
      '..%2F..%2Fetc%2Fpasswd',
      'wf..secret',
      'wf/../secret',
      '../../../data/workflows',
      'wf<script>',
    ];

    for (const malId of maliciousIds) {
      const encoded = encodeURIComponent(malId);

      // GET
      const resGet = await fetch(`${baseUrl}/${encoded}`);
      assert.ok(resGet.status === 400 || resGet.status === 404, `GET deveria rejeitar ${malId} (recebeu ${resGet.status})`);

      // PUT
      const resPut = await fetch(`${baseUrl}/${encoded}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: 'Hacked' }),
      });
      assert.ok(resPut.status === 400 || resPut.status === 404, `PUT deveria rejeitar ${malId} (recebeu ${resPut.status})`);

      // DELETE
      const resDel = await fetch(`${baseUrl}/${encoded}`, { method: 'DELETE' });
      assert.ok(resDel.status === 400 || resDel.status === 404, `DELETE deveria rejeitar ${malId} (recebeu ${resDel.status})`);

      // History
      const resHist = await fetch(`${baseUrl}/${encoded}/history`);
      assert.ok(resHist.status === 400 || resHist.status === 404, `History deveria rejeitar ${malId} (recebeu ${resHist.status})`);

      // Run
      const resRun = await fetch(`${baseUrl}/${encoded}/run`, { method: 'POST' });
      assert.ok(resRun.status === 400 || resRun.status === 404, `Run deveria rejeitar ${malId} (recebeu ${resRun.status})`);
    }
  });

  test('CRUD completo de Workflow', async () => {
    // 1. Create
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Automated Test Pipeline',
        nodes: [
          { id: 'node_1', type: 'trigger', label: 'Start Trigger', x: 100, y: 100, config: {} },
          { id: 'node_2', type: 'code-box', label: 'Transform Data', x: 300, y: 100, config: { code: 'return { doubled: trigger.num * 2 };' } },
        ],
        connections: [
          { id: 'conn_1', sourceNodeId: 'node_1', targetNodeId: 'node_2' },
        ],
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const created = await createRes.json();
    assert.ok(created.id);
    assert.strictEqual(created.name, 'Automated Test Pipeline');
    testWorkflowId = created.id;

    // 2. List
    const listRes = await fetch(`${baseUrl}`);
    assert.strictEqual(listRes.status, 200);
    const workflows = await listRes.json();
    assert.ok(Array.isArray(workflows));
    const found = workflows.find((w: any) => w.id === testWorkflowId);
    assert.ok(found, 'Workflow criado deve constar na listagem');

    // 3. Get by ID
    const getRes = await fetch(`${baseUrl}/${testWorkflowId}`);
    assert.strictEqual(getRes.status, 200);
    const single = await getRes.json();
    assert.strictEqual(single.id, testWorkflowId);
    assert.strictEqual(single.nodes.length, 2);

    // 4. Update
    const updateRes = await fetch(`${baseUrl}/${testWorkflowId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Automated Test Pipeline Renamed' }),
    });
    assert.strictEqual(updateRes.status, 200);
    const updated = await updateRes.json();
    assert.strictEqual(updated.name, 'Automated Test Pipeline Renamed');

    // 5. History initially empty
    const histRes = await fetch(`${baseUrl}/${testWorkflowId}/history`);
    assert.strictEqual(histRes.status, 200);
    const history = await histRes.json();
    assert.ok(Array.isArray(history));
  });

  test('Executa workflow com streaming Server-Sent Events (SSE)', async () => {
    assert.ok(testWorkflowId, 'Deve haver um workflow criado');

    const runRes = await fetch(`${baseUrl}/${testWorkflowId}/run`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ num: 21 }),
    });

    assert.strictEqual(runRes.status, 200);
    assert.ok(runRes.headers.get('content-type')?.includes('text/event-stream'));

    const textStream = await runRes.text();
    assert.ok(textStream.includes('event: start'), 'Deve emitir evento de start');
    assert.ok(textStream.includes('event: node'), 'Deve emitir evento de node em execução');
    assert.ok(textStream.includes('event: done'), 'Deve emitir evento de finalização com sucesso');

    // History should now contain 1 execution record
    const histRes = await fetch(`${baseUrl}/${testWorkflowId}/history`);
    const history = await histRes.json();
    assert.ok(history.length >= 1, 'Histórico deve registrar a execução');
    assert.strictEqual(history[0].status, 'success');
  });

  test('Executa código JS em sandbox isolada via /exec-js', async () => {
    // Missing code
    const resEmpty = await fetch(`${baseUrl}/exec-js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    assert.strictEqual(resEmpty.status, 400);

    // Valid execution with context
    const resValid = await fetch(`${baseUrl}/exec-js`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        code: 'return 100 + 42;',
      }),
    });
    assert.strictEqual(resValid.status, 200);
    const data = await resValid.json();
    assert.strictEqual(data.result, 142);
  });

  test('Deleta o workflow criado', async () => {
    assert.ok(testWorkflowId);
    const delRes = await fetch(`${baseUrl}/${testWorkflowId}`, { method: 'DELETE' });
    assert.strictEqual(delRes.status, 200);

    // Verify 404
    const getRes = await fetch(`${baseUrl}/${testWorkflowId}`);
    assert.strictEqual(getRes.status, 404);
    testWorkflowId = '';
  });

  test('Aciona workflow externamente via Webhook (/api/workflows/webhook/:webhookId)', async () => {
    // 1. Cria workflow com nó trigger em modo webhook
    const createRes = await fetch(`${baseUrl}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Webhook Ingestion Pipeline',
        nodes: [
          {
            id: 'trig_wh',
            type: 'trigger',
            label: 'External Webhook',
            x: 50,
            y: 50,
            config: { mode: 'webhook', webhookId: 'order-webhook-test' },
          },
          {
            id: 'code_proc',
            type: 'code-box',
            label: 'Process Webhook',
            x: 250,
            y: 50,
            config: { code: 'return { processedOrder: trigger.body.orderId, receivedMethod: trigger.method };' },
          },
        ],
        connections: [{ id: 'c1', sourceNodeId: 'trig_wh', targetNodeId: 'code_proc' }],
      }),
    });
    assert.strictEqual(createRes.status, 201);
    const wf = await createRes.json();
    const wfId = wf.id;

    try {
      // 2. Dispara webhook
      const whRes = await fetch(`${baseUrl}/webhook/order-webhook-test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: 'ORD-777' }),
      });

      assert.strictEqual(whRes.status, 200);
      const whData = await whRes.json();
      assert.strictEqual(whData.ok, true);
      assert.strictEqual(whData.workflowId, wfId);
      assert.strictEqual(whData.status, 'success');

      // 3. Rejeita webhook inexistente (404)
      const nonExistentRes = await fetch(`${baseUrl}/webhook/non-existent-webhook`);
      assert.strictEqual(nonExistentRes.status, 404);
    } finally {
      // Cleanup
      await fetch(`${baseUrl}/${wfId}`, { method: 'DELETE' });
    }
  });
});
