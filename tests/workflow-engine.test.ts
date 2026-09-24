import { test, describe } from 'node:test';
import assert from 'node:assert';
import { executeWorkflow, executeSandboxJS, Workflow, WorkflowNode, WorkflowConnection } from '../server/lib/workflowEngine';

describe('Workflow Engine — Unit Tests & Graph Execution', () => {

  test('Executa grafo linear ordenado topologicamente (Trigger -> Code-Box -> Log)', async () => {
    const nodes: WorkflowNode[] = [
      {
        id: 'node_code',
        type: 'code-box',
        label: 'Compute Total',
        x: 200,
        y: 100,
        config: { code: 'return { total: trigger.price * trigger.qty };' },
      },
      {
        id: 'node_trigger',
        type: 'trigger',
        label: 'Order Trigger',
        x: 50,
        y: 100,
        config: {},
      },
      {
        id: 'node_log',
        type: 'log-output',
        label: 'Log Output',
        x: 400,
        y: 100,
        config: { message: 'Order computed successfully' },
      },
    ];

    const connections: WorkflowConnection[] = [
      { id: 'c1', sourceNodeId: 'node_trigger', targetNodeId: 'node_code' },
      { id: 'c2', sourceNodeId: 'node_code', targetNodeId: 'node_log' },
    ];

    const wf: Workflow = {
      id: 'wf_linear_test',
      name: 'Linear Test',
      nodes,
      connections,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const progressLogs: string[] = [];
    const result = await executeWorkflow(
      wf,
      { price: 50, qty: 3 },
      (nodeId, status) => {
        if (status === 'success') progressLogs.push(nodeId);
      }
    );

    assert.strictEqual(result.status, 'success');
    assert.strictEqual(result.nodeResults.length, 3);

    // Ordem deve ser trigger -> code -> log mesmo os nós estando fora de ordem na lista original
    assert.strictEqual(progressLogs[0], 'node_trigger');
    assert.strictEqual(progressLogs[1], 'node_code');
    assert.strictEqual(progressLogs[2], 'node_log');

    // Verifica saída do nó code
    const codeResult = result.nodeResults.find((r) => r.nodeId === 'node_code');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(codeResult?.output)), { total: 150 });
  });

  test('Avalia nó de Condition com ramificação True e marca False como skipped', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'trig', type: 'trigger', label: 'Trigger', x: 0, y: 0, config: {} },
      {
        id: 'cond',
        type: 'condition',
        label: 'Check Age',
        x: 150,
        y: 0,
        config: { expression: 'trigger.age >= 18' },
      },
      {
        id: 'adult_path',
        type: 'code-box',
        label: 'Adult Approved',
        x: 300,
        y: -100,
        config: { code: 'return { access: "granted" };' },
      },
      {
        id: 'minor_path',
        type: 'code-box',
        label: 'Minor Blocked',
        x: 300,
        y: 100,
        config: { code: 'return { access: "denied" };' },
      },
    ];

    const connections: WorkflowConnection[] = [
      { id: 'c1', sourceNodeId: 'trig', targetNodeId: 'cond' },
      { id: 'c2', sourceNodeId: 'cond', sourcePortId: 'true', targetNodeId: 'adult_path' },
      { id: 'c3', sourceNodeId: 'cond', sourcePortId: 'false', targetNodeId: 'minor_path' },
    ];

    const wf: Workflow = {
      id: 'wf_cond_true',
      name: 'Condition True Test',
      nodes,
      connections,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    // Caso 1: age = 25 (True) -> adult_path roda, minor_path é skipped
    const resultTrue = await executeWorkflow(wf, { age: 25 });
    assert.strictEqual(resultTrue.status, 'success');

    const adultRes = resultTrue.nodeResults.find((n) => n.nodeId === 'adult_path');
    assert.strictEqual(adultRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(adultRes?.output)), { access: 'granted' });

    const minorRes = resultTrue.nodeResults.find((n) => n.nodeId === 'minor_path');
    assert.strictEqual(minorRes?.status, 'skipped');

    // Caso 2: age = 15 (False) -> minor_path roda, adult_path é skipped
    const resultFalse = await executeWorkflow(wf, { age: 15 });
    assert.strictEqual(resultFalse.status, 'success');

    const adultRes2 = resultFalse.nodeResults.find((n) => n.nodeId === 'adult_path');
    assert.strictEqual(adultRes2?.status, 'skipped');

    const minorRes2 = resultFalse.nodeResults.find((n) => n.nodeId === 'minor_path');
    assert.strictEqual(minorRes2?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(minorRes2?.output)), { access: 'denied' });
  });

  test('Tratamento resiliente de erro em nó com execução parcial', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'trig', type: 'trigger', label: 'Trigger', x: 0, y: 0, config: {} },
      {
        id: 'broken_node',
        type: 'code-box',
        label: 'Faulty Node',
        x: 150,
        y: 0,
        config: { code: 'throw new Error("Simulated runtime failure");' },
      },
      {
        id: 'after_node',
        type: 'code-box',
        label: 'Independent Step',
        x: 300,
        y: 0,
        config: { code: 'return { recovery: true };' },
      },
    ];

    const connections: WorkflowConnection[] = [
      { id: 'c1', sourceNodeId: 'trig', targetNodeId: 'broken_node' },
      { id: 'c2', sourceNodeId: 'broken_node', targetNodeId: 'after_node' },
    ];

    const wf: Workflow = {
      id: 'wf_error_handling',
      name: 'Error Handling Test',
      nodes,
      connections,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await executeWorkflow(wf, {});
    assert.strictEqual(result.status, 'partial', 'Status global deve ser partial');

    const brokenRes = result.nodeResults.find((n) => n.nodeId === 'broken_node');
    assert.strictEqual(brokenRes?.status, 'error');
    assert.ok(brokenRes?.error?.includes('Simulated runtime failure'));

    const afterRes = result.nodeResults.find((n) => n.nodeId === 'after_node');
    assert.strictEqual(afterRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(afterRes?.output)), { recovery: true });
  });

  test('Isolamento de sandbox no nó Code-Box', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'trig', type: 'trigger', label: 'Trigger', x: 0, y: 0, config: {} },
      {
        id: 'leak_attempt',
        type: 'code-box',
        label: 'Sandbox Escape Attempt',
        x: 150,
        y: 0,
        config: {
          code: `
            let leak = false;
            try {
              leak = typeof process !== 'undefined' && typeof process.exit === 'function';
            } catch {}
            return { leakedProcess: leak };
          `,
        },
      },
    ];

    const wf: Workflow = {
      id: 'wf_sandbox_test',
      name: 'Sandbox Test',
      nodes,
      connections: [{ id: 'c1', sourceNodeId: 'trig', targetNodeId: 'leak_attempt' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await executeWorkflow(wf, {});
    const leakRes = result.nodeResults.find((n) => n.nodeId === 'leak_attempt');
    assert.strictEqual(leakRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(leakRes?.output)), { leakedProcess: false });
  });

  test('Executa nó Code-Box em linguagem Python', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'trig', type: 'trigger', label: 'Trigger', x: 0, y: 0, config: {} },
      {
        id: 'py_node',
        type: 'code-box',
        label: 'Python Computation',
        x: 150,
        y: 0,
        config: {
          language: 'python',
          code: `
nums = [1, 2, 3, 4, 5]
multiplier = trigger.get('factor', 10)
return {'scaled': [n * multiplier for n in nums], 'total': sum(nums) * multiplier}
          `,
        },
      },
    ];

    const wf: Workflow = {
      id: 'wf_python_test',
      name: 'Python Test',
      nodes,
      connections: [{ id: 'c1', sourceNodeId: 'trig', targetNodeId: 'py_node' }],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await executeWorkflow(wf, { factor: 3 });
    const pyRes = result.nodeResults.find((n) => n.nodeId === 'py_node');
    assert.strictEqual(pyRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(pyRes?.output)), {
      scaled: [3, 6, 9, 12, 15],
      total: 45,
    });
  });

  test('Bloqueia padrões perigosos na sandbox JS (require, child_process, constructor escape)', () => {
    assert.throws(
      () => executeSandboxJS('require("child_process")', {}),
      /bloqueada por política de segurança/
    );

    assert.throws(
      () => executeSandboxJS('const fn = (function(){}).constructor("return process")()', {}),
      /bloqueada por política de segurança/
    );

    assert.throws(
      () => executeSandboxJS('Object.prototype.__proto__ = null', {}),
      /bloqueada por política de segurança/
    );
  });

  test('Detecta ciclos no grafo e rejeita execução com erro informativo de DAG', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'n1', type: 'trigger', label: 'Start', x: 0, y: 0, config: {} },
      { id: 'n2', type: 'log-output', label: 'A', x: 100, y: 0, config: { message: 'A' } },
      { id: 'n3', type: 'log-output', label: 'B', x: 200, y: 0, config: { message: 'B' } },
    ];
    // Grafo cíclico: n1 -> n2 -> n3 -> n2
    const connections: WorkflowConnection[] = [
      { id: 'c1', sourceNodeId: 'n1', targetNodeId: 'n2' },
      { id: 'c2', sourceNodeId: 'n2', targetNodeId: 'n3' },
      { id: 'c3', sourceNodeId: 'n3', targetNodeId: 'n2' },
    ];
    const wf: Workflow = {
      id: 'wf_cycle_test',
      name: 'Cycle Test',
      nodes,
      connections,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    await assert.rejects(
      () => executeWorkflow(wf, {}),
      /Ciclo detectado no grafo do workflow/
    );
  });

  test('Encadeia entrada e saída (I/O) entre nós sucessivos via $input, $json e items', async () => {
    const nodes: WorkflowNode[] = [
      { id: 'start', type: 'trigger', label: 'Trigger', x: 0, y: 0, config: {} },
      {
        id: 'producer',
        type: 'code-box',
        label: 'Fetch User Data',
        x: 150,
        y: 0,
        config: { code: 'return { id: 42, username: "nebula_pilot", role: "admin", scores: [10, 20, 30] };' },
      },
      {
        id: 'consumer_js',
        type: 'code-box',
        label: 'Process with JS',
        x: 350,
        y: -80,
        config: {
          code: 'return { greeting: "Hello " + $json.username, totalScore: $json.scores.reduce((a,b)=>a+b, 0), fromInput: $input.id };',
        },
      },
      {
        id: 'consumer_logger',
        type: 'log-output',
        label: 'Logger with Template',
        x: 550,
        y: -80,
        config: {
          message: 'User {{$json.greeting}} has score {{$json.totalScore}}',
        },
      },
    ];

    const connections: WorkflowConnection[] = [
      { id: 'c1', sourceNodeId: 'start', targetNodeId: 'producer' },
      { id: 'c2', sourceNodeId: 'producer', targetNodeId: 'consumer_js' },
      { id: 'c3', sourceNodeId: 'consumer_js', targetNodeId: 'consumer_logger' },
    ];

    const wf: Workflow = {
      id: 'wf_io_test',
      name: 'I/O Piping Test',
      nodes,
      connections,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };

    const result = await executeWorkflow(wf, {});
    assert.strictEqual(result.status, 'success');

    const jsRes = result.nodeResults.find((n) => n.nodeId === 'consumer_js');
    assert.strictEqual(jsRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(jsRes?.output)), {
      greeting: 'Hello nebula_pilot',
      totalScore: 60,
      fromInput: 42,
    });

    const logRes = result.nodeResults.find((n) => n.nodeId === 'consumer_logger');
    assert.strictEqual(logRes?.status, 'success');
    assert.deepStrictEqual(JSON.parse(JSON.stringify(logRes?.output)), {
      logged: 'User Hello nebula_pilot has score 60',
    });
  });
});

