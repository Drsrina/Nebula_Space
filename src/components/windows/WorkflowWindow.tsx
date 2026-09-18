import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  Play, Plus, Trash2, ChevronRight, Circle, CheckCircle, XCircle,
  Globe, Code2, GitBranch, Zap, Terminal, Clock, AlertCircle, RefreshCw,
  Save, LayoutGrid, MessageSquare, Send, Copy, Check
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

type NodeType =
  | 'trigger'
  | 'http-request'
  | 'code-box'
  | 'condition'
  | 'log-output'
  | 'discord-webhook'
  | 'telegram-bot';

interface WFNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  config: Record<string, unknown>;
}

interface WFConnection {
  id: string;
  sourceNodeId: string;
  sourcePortId?: string;
  targetNodeId: string;
}

interface Workflow {
  id: string;
  name: string;
  nodes: WFNode[];
  connections: WFConnection[];
  createdAt: number;
  updatedAt: number;
}

interface NodeStatus {
  [nodeId: string]: 'idle' | 'running' | 'success' | 'error';
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 180;
const NODE_HEIGHT = 60;

const NODE_CONFIGS: Record<NodeType, { label: string; color: string; icon: React.ReactNode }> = {
  'trigger': { label: 'Trigger', color: '#3ba9ff', icon: <Zap className="w-3.5 h-3.5" /> },
  'http-request': { label: 'HTTP Request', color: '#34d399', icon: <Globe className="w-3.5 h-3.5" /> },
  'code-box': { label: 'Code Box (JS/Py)', color: '#a78bfa', icon: <Code2 className="w-3.5 h-3.5" /> },
  'condition': { label: 'Condition', color: '#fbbf24', icon: <GitBranch className="w-3.5 h-3.5" /> },
  'discord-webhook': { label: 'Discord', color: '#6366f1', icon: <MessageSquare className="w-3.5 h-3.5" /> },
  'telegram-bot': { label: 'Telegram', color: '#38bdf8', icon: <Send className="w-3.5 h-3.5" /> },
  'log-output': { label: 'Log Output', color: '#fb7185', icon: <Terminal className="w-3.5 h-3.5" /> },
};

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

// ─── Bezier Connection SVG ────────────────────────────────────────────────────

const ConnectionLine: React.FC<{
  sourceX: number; sourceY: number; targetX: number; targetY: number; color?: string;
}> = ({ sourceX, sourceY, targetX, targetY, color = '#3ba9ff' }) => {
  const dx = Math.abs(targetX - sourceX) * 0.5;
  const d = `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;
  return (
    <path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeOpacity={0.7}
      strokeDasharray="none"
    />
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const WorkflowWindow: React.FC = () => {
  const [workflow, setWorkflow] = useState<Workflow>({
    id: generateId(),
    name: 'Novo Workflow',
    nodes: [
      { id: 'node-trigger-1', type: 'trigger', label: 'Manual Trigger', x: 60, y: 120, config: { mode: 'manual' } },
    ],
    connections: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [nodeStatus, setNodeStatus] = useState<NodeStatus>({});
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<Array<{ nodeId: string; status: string; output?: unknown }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showList, setShowList] = useState(false);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });

  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Load workflows list
  useEffect(() => {
    fetch('/api/workflows', { headers: { Authorization: `Bearer ${sessionStorage.getItem('nebula_token') ?? ''}` } })
      .then((r) => r.ok ? r.json() : [])
      .then(setWorkflows)
      .catch(() => {});
  }, []);

  // ─── Add node ────────────────────────────────────────────────────────────────
  const addNode = (type: NodeType) => {
    const id = `node-${type}-${generateId()}`;
    const meta = NODE_CONFIGS[type];
    const newNode: WFNode = {
      id,
      type,
      label: meta.label,
      x: 80 + workflow.nodes.length * 40,
      y: 80 + (workflow.nodes.length % 3) * 100,
      config: {},
    };
    setWorkflow((wf) => ({ ...wf, nodes: [...wf.nodes, newNode], updatedAt: Date.now() }));
  };

  const deleteNode = (nodeId: string) => {
    setWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      connections: wf.connections.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId),
      updatedAt: Date.now(),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
  };

  // ─── Node Drag ───────────────────────────────────────────────────────────────
  const handleNodeDragStart = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    const startX = e.clientX;
    const startY = e.clientY;
    const node = workflow.nodes.find((n) => n.id === nodeId)!;
    const startNodeX = node.x;
    const startNodeY = node.y;

    const move = (ev: PointerEvent) => {
      setWorkflow((wf) => ({
        ...wf,
        nodes: wf.nodes.map((n) =>
          n.id === nodeId
            ? { ...n, x: startNodeX + (ev.clientX - startX), y: startNodeY + (ev.clientY - startY) }
            : n
        ),
      }));
    };
    const up = () => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ─── Canvas Pan ──────────────────────────────────────────────────────────────
  const handleCanvasDragStart = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest('[data-wf-node]')) return;
    setIsPanningCanvas(true);
    panStartRef.current = { x: e.clientX, y: e.clientY, ox: canvasOffset.x, oy: canvasOffset.y };

    const move = (ev: PointerEvent) => {
      setCanvasOffset({
        x: panStartRef.current.ox + (ev.clientX - panStartRef.current.x),
        y: panStartRef.current.oy + (ev.clientY - panStartRef.current.y),
      });
    };
    const up = () => {
      setIsPanningCanvas(false);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };

  // ─── Run Workflow ────────────────────────────────────────────────────────────
  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setNodeStatus({});
    setExecutionLog([]);
    setShowLog(true);

    const wfToRun = savedId
      ? { ...workflow, id: savedId }
      : workflow;

    // If not saved, use inline mode via exec-js simulation
    // For full SSE run, save first then run
    const token = sessionStorage.getItem('nebula_token') ?? '';

    if (savedId) {
      const resp = await fetch(`/api/workflows/${savedId}/run`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        body: JSON.stringify({}),
      });

      if (!resp.ok || !resp.body) {
        setIsRunning(false);
        return;
      }

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop() ?? '';

        for (const chunk of lines) {
          const eventLine = chunk.split('\n').find((l) => l.startsWith('event:'));
          const dataLine = chunk.split('\n').find((l) => l.startsWith('data:'));
          if (!dataLine) continue;
          const event = eventLine?.replace('event:', '').trim() ?? 'message';
          const data = JSON.parse(dataLine.replace('data:', '').trim());

          if (event === 'node') {
            setNodeStatus((prev) => ({ ...prev, [data.nodeId]: data.status }));
            setExecutionLog((prev) => [...prev, data]);
          } else if (event === 'done' || event === 'error') {
            setIsRunning(false);
          }
        }
      }
    } else {
      // Local simulation without server persistence
      for (const node of workflow.nodes) {
        setNodeStatus((prev) => ({ ...prev, [node.id]: 'running' }));
        await new Promise((r) => setTimeout(r, 400));
        setNodeStatus((prev) => ({ ...prev, [node.id]: 'success' }));
        setExecutionLog((prev) => [...prev, { nodeId: node.id, status: 'success', output: 'Executado localmente (save para run real)' }]);
      }
      setIsRunning(false);
    }
  };

  // ─── Save Workflow ───────────────────────────────────────────────────────────
  const saveWorkflow = async () => {
    setIsSaving(true);
    const token = sessionStorage.getItem('nebula_token') ?? '';
    const payload = { ...workflow, name: workflowName };

    try {
      let resp;
      if (savedId) {
        resp = await fetch(`/api/workflows/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      } else {
        resp = await fetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
          body: JSON.stringify(payload),
        });
      }
      const saved: Workflow = await resp.json();
      setSavedId(saved.id);
      setWorkflow(saved);
    } catch {}
    setIsSaving(false);
  };

  // ─── Node Status Color ───────────────────────────────────────────────────────
  const statusColor: Record<string, string> = {
    idle: '#3a4a6a',
    running: '#f97316',
    success: '#22c55e',
    error: '#ef4444',
  };

  const statusIcon: Record<string, React.ReactNode> = {
    idle: <Circle className="w-3 h-3" />,
    running: <RefreshCw className="w-3 h-3 animate-spin" />,
    success: <CheckCircle className="w-3 h-3" />,
    error: <XCircle className="w-3 h-3" />,
  };

  return (
    <div className="flex flex-col h-full bg-[#060d1c]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e]">
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="flex-1 bg-transparent text-xs text-[#e6f0ff] font-mono border border-[#1a2a4a] rounded px-2 py-0.5 focus:outline-none focus:border-[#3ba9ff]/50"
          placeholder="Nome do workflow"
        />

        <button
          onClick={() => setShowList((v) => !v)}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
          title="Listar workflows salvos"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
        </button>

        <button
          onClick={saveWorkflow}
          disabled={isSaving}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-[#1a2a4a] hover:bg-[#1e3253] text-[#5eead4] transition-all"
        >
          <Save className="w-3 h-3" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>

        <button
          onClick={runWorkflow}
          disabled={isRunning}
          className="flex items-center gap-1 px-3 py-1 rounded text-xs font-semibold bg-[#22c55e]/15 hover:bg-[#22c55e]/25 text-[#22c55e] border border-[#22c55e]/30 transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5" />
          {isRunning ? 'Rodando...' : 'Executar'}
        </button>
      </div>

      {/* Node Palette */}
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1a2a4a] bg-[#08101e] overflow-x-auto">
        <span className="text-[9px] font-mono text-[#4a6080] shrink-0 mr-1">ADICIONAR NÓ:</span>
        {(Object.entries(NODE_CONFIGS) as [NodeType, (typeof NODE_CONFIGS)[NodeType]][]).map(([type, meta]) => (
          <button
            key={type}
            onClick={() => addNode(type)}
            className="flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-all hover:opacity-90 shrink-0"
            style={{ borderColor: `${meta.color}40`, color: meta.color, background: `${meta.color}10` }}
          >
            {meta.icon}
            {meta.label}
          </button>
        ))}
      </div>

      {/* Canvas + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* SVG Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-hidden"
          style={{ cursor: isPanningCanvas ? 'grabbing' : 'grab', background: 'radial-gradient(circle at 50% 50%, #0a1628 0%, #060d1c 100%)' }}
          onPointerDown={handleCanvasDragStart}
          onClick={() => setSelectedNodeId(null)}
        >
          {/* Dot grid */}
          <svg className="absolute inset-0 w-full h-full pointer-events-none" style={{ opacity: 0.12 }}>
            <defs>
              <pattern id="wf-dot" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
                <circle cx="1" cy="1" r="1" fill="#3ba9ff" />
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#wf-dot)" />
          </svg>

          <div
            style={{ transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`, position: 'absolute', inset: 0 }}
          >
            {/* Connection SVG */}
            <svg className="absolute inset-0 pointer-events-none" style={{ width: 4000, height: 3000, left: 0, top: 0 }}>
              {workflow.connections.map((conn) => {
                const src = workflow.nodes.find((n) => n.id === conn.sourceNodeId);
                const tgt = workflow.nodes.find((n) => n.id === conn.targetNodeId);
                if (!src || !tgt) return null;
                return (
                  <ConnectionLine
                    key={conn.id}
                    sourceX={src.x + NODE_WIDTH}
                    sourceY={src.y + NODE_HEIGHT / 2}
                    targetX={tgt.x}
                    targetY={tgt.y + NODE_HEIGHT / 2}
                    color={NODE_CONFIGS[src.type]?.color ?? '#3ba9ff'}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {workflow.nodes.map((node) => {
              const meta = NODE_CONFIGS[node.type] ?? NODE_CONFIGS['trigger'];
              const status = nodeStatus[node.id] ?? 'idle';
              const isSelected = selectedNodeId === node.id;

              return (
                <div
                  key={node.id}
                  data-wf-node={node.id}
                  onPointerDown={(e) => { e.stopPropagation(); handleNodeDragStart(e, node.id); }}
                  onClick={(e) => { e.stopPropagation(); setSelectedNodeId(node.id); }}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    borderRadius: 10,
                    border: `2px solid ${isSelected ? meta.color : `${meta.color}50`}`,
                    background: `linear-gradient(135deg, ${meta.color}18 0%, #0a1628 100%)`,
                    boxShadow: isSelected ? `0 0 18px ${meta.color}55` : `0 4px 12px rgba(0,0,0,0.4)`,
                    cursor: 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '0 12px',
                    transition: 'box-shadow 0.2s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span style={{ fontSize: 11, fontFamily: 'monospace', color: '#e6f0ff', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {node.label}
                    </span>
                    <span style={{ color: statusColor[status] ?? '#3a4a6a' }}>
                      {statusIcon[status]}
                    </span>
                  </div>
                  <div style={{ fontSize: 9, fontFamily: 'monospace', color: '#4a6080', marginTop: 2 }}>
                    {node.type}
                  </div>

                  {/* Delete button */}
                  <button
                    onPointerDown={(e) => e.stopPropagation()}
                    onClick={(e) => { e.stopPropagation(); deleteNode(node.id); }}
                    style={{
                      position: 'absolute', top: -6, right: -6,
                      background: '#0a1628', border: '1px solid #ef4444', borderRadius: '50%',
                      width: 16, height: 16, display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', color: '#ef4444', opacity: isSelected ? 1 : 0,
                      transition: 'opacity 0.15s',
                    }}
                    title="Remover nó"
                  >
                    <Trash2 style={{ width: 9, height: 9 }} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Side Panel: Node Config */}
        {selectedNode && (
          <div className="w-56 border-l border-[#1a2a4a] bg-[#080f1e] flex flex-col overflow-hidden">
            <div className="px-3 py-2 border-b border-[#1a2a4a] text-[10px] font-mono text-[#7a92b8] flex items-center gap-1.5">
              <span style={{ color: NODE_CONFIGS[selectedNode.type]?.color }}>
                {NODE_CONFIGS[selectedNode.type]?.icon}
              </span>
              {selectedNode.type}
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              <div>
                <label className="block text-[9px] font-mono text-[#4a6080] mb-1">LABEL</label>
                <input
                  value={selectedNode.label}
                  onChange={(e) => {
                    const label = e.target.value;
                    setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, label } : n) }));
                  }}
                  className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#3ba9ff]/50"
                />
              </div>

              {selectedNode.type === 'http-request' && (
                <>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MÉTODO</label>
                    <select
                      value={String(selectedNode.config.method ?? 'GET')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, method: e.target.value } } : n) }))}
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                    >
                      {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">URL</label>
                    <input
                      value={String(selectedNode.config.url ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, url: e.target.value } } : n) }))}
                      placeholder="https://api.exemplo.com/endpoint"
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#34d399]/50"
                    />
                  </div>
                </>
              )}

              {selectedNode.type === 'code-box' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">LINGUAGEM</label>
                    <select
                      value={String(selectedNode.config.language ?? 'javascript')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, language: e.target.value } } : n) }))}
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                    >
                      <option value="javascript">JavaScript</option>
                      <option value="python">Python</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">
                      {String(selectedNode.config.language ?? 'javascript') === 'python' ? 'CÓDIGO PYTHON' : 'CÓDIGO JS'}
                    </label>
                    <textarea
                      value={String(selectedNode.config.code ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, code: e.target.value } } : n) }))}
                      rows={8}
                      placeholder={
                        String(selectedNode.config.language ?? 'javascript') === 'python'
                          ? "# variáveis: context, trigger\nreturn {'status': 'processed'}"
                          : "// variáveis: response, trigger, result\nreturn response?.body;"
                      }
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#a78bfa]/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'condition' && (
                <div>
                  <label className="block text-[9px] font-mono text-[#4a6080] mb-1">EXPRESSÃO (JS)</label>
                  <input
                    value={String(selectedNode.config.expression ?? '')}
                    onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, expression: e.target.value } } : n) }))}
                    placeholder="response.status === 200"
                    className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#fbbf24]/50"
                  />
                  <p className="text-[9px] text-[#4a6080] mt-1 font-mono">Retorna true/false para bifurcar o fluxo.</p>
                </div>
              )}

              {selectedNode.type === 'discord-webhook' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">DISCORD WEBHOOK URL</label>
                    <input
                      value={String(selectedNode.config.webhookUrl ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, webhookUrl: e.target.value } } : n) }))}
                      placeholder="https://discord.com/api/webhooks/..."
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#6366f1]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MENSAGEM (opcional)</label>
                    <textarea
                      value={String(selectedNode.config.content ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, content: e.target.value } } : n) }))}
                      rows={3}
                      placeholder="Deixe vazio para enviar a saída do nó anterior"
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#6366f1]/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'telegram-bot' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">BOT TOKEN</label>
                    <input
                      type="password"
                      value={String(selectedNode.config.botToken ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, botToken: e.target.value } } : n) }))}
                      placeholder="123456:ABC-DEF..."
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#38bdf8]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">CHAT ID</label>
                    <input
                      value={String(selectedNode.config.chatId ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, chatId: e.target.value } } : n) }))}
                      placeholder="@canal ou 12345678"
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#38bdf8]/50"
                    />
                  </div>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MENSAGEM (opcional)</label>
                    <textarea
                      value={String(selectedNode.config.message ?? '')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, message: e.target.value } } : n) }))}
                      rows={3}
                      placeholder="Deixe vazio para enviar a saída do nó anterior"
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#38bdf8]/50 resize-none"
                    />
                  </div>
                </div>
              )}

              {selectedNode.type === 'log-output' && (
                <div>
                  <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MENSAGEM (opcional)</label>
                  <input
                    value={String(selectedNode.config.message ?? '')}
                    onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, message: e.target.value } } : n) }))}
                    placeholder="{{result}}"
                    className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#fb7185]/50"
                  />
                </div>
              )}

              {selectedNode.type === 'trigger' && (
                <div className="space-y-2">
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MODO</label>
                    <select
                      value={String(selectedNode.config.mode ?? 'manual')}
                      onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, mode: e.target.value } } : n) }))}
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                    >
                      <option value="manual">Manual</option>
                      <option value="webhook">Webhook (Externo)</option>
                      <option value="cron">Cron (via Crontab)</option>
                    </select>
                  </div>
                  {selectedNode.config.mode === 'webhook' && (
                    <div>
                      <label className="block text-[9px] font-mono text-[#4a6080] mb-1">WEBHOOK ID</label>
                      <input
                        value={String(selectedNode.config.webhookId ?? selectedNode.id)}
                        onChange={(e) => setWorkflow((wf) => ({ ...wf, nodes: wf.nodes.map((n) => n.id === selectedNode.id ? { ...n, config: { ...n.config, webhookId: e.target.value } } : n) }))}
                        className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#3ba9ff]/50"
                      />
                      <div className="mt-1.5 p-1.5 bg-black/40 rounded border border-white/5 text-[9px] font-mono text-slate-400 break-all">
                        <span className="text-[#3ba9ff]">URL:</span> /api/workflows/webhook/{String(selectedNode.config.webhookId ?? selectedNode.id)}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Execution Log Panel */}
      {showLog && (
        <div className="h-36 border-t border-[#1a2a4a] bg-[#060d1c] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a2a4a]">
            <span className="text-[10px] font-mono text-[#7a92b8]">LOG DE EXECUÇÃO</span>
            <button onClick={() => setShowLog(false)} className="text-[#4a6080] hover:text-[#e6f0ff] text-xs">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs">
            {executionLog.length === 0 && (
              <div className="text-[#4a6080] text-[10px]">Aguardando execução...</div>
            )}
            {executionLog.map((entry, i) => {
              const node = workflow.nodes.find((n) => n.id === entry.nodeId);
              const color = entry.status === 'success' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#f97316';
              return (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color }} className="shrink-0">
                    {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '⟳'}
                  </span>
                  <span className="text-[#5a7a9a] shrink-0">{node?.label ?? entry.nodeId}</span>
                  <span className="text-[#3a5a7a] truncate text-[10px]">
                    {entry.output ? JSON.stringify(entry.output).slice(0, 120) : ''}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
