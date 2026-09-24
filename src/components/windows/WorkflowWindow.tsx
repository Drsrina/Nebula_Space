import React, { useState, useRef, useEffect } from 'react';
import {
  Play, Plus, Trash2, Circle, CheckCircle, XCircle,
  Globe, Code2, GitBranch, Zap, Terminal, Clock, AlertCircle, RefreshCw,
  Save, LayoutGrid, MessageSquare, Send, Copy, Check, Download, Upload,
  HardDrive, FileJson, ArrowRight, Unlink, ExternalLink
} from 'lucide-react';
import { authFetch } from '../../lib/api';

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
  targetPortId?: string;
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

interface NodeRunData {
  input?: unknown;
  output?: unknown;
  error?: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const NODE_WIDTH = 200;
const NODE_HEIGHT = 68;

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
  sourceX: number;
  sourceY: number;
  targetX: number;
  targetY: number;
  color?: string;
  onDelete?: () => void;
}> = ({ sourceX, sourceY, targetX, targetY, color = '#3ba9ff', onDelete }) => {
  const dx = Math.abs(targetX - sourceX) * 0.5;
  const d = `M ${sourceX} ${sourceY} C ${sourceX + dx} ${sourceY}, ${targetX - dx} ${targetY}, ${targetX} ${targetY}`;
  const midX = (sourceX + targetX) / 2;
  const midY = (sourceY + targetY) / 2;

  return (
    <g className="group cursor-pointer">
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeWidth={2}
        strokeOpacity={0.75}
        className="transition-all group-hover:stroke-width-3 group-hover:stroke-opacity-100"
      />
      {/* Invisible wider path for easy hover/clicking */}
      <path
        d={d}
        fill="none"
        stroke="transparent"
        strokeWidth={14}
        onClick={(e) => {
          e.stopPropagation();
          onDelete?.();
        }}
      />
      {onDelete && (
        <circle
          cx={midX}
          cy={midY}
          r={7}
          fill="#060d1c"
          stroke="#ef4444"
          strokeWidth={1.5}
          className="opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
        />
      )}
    </g>
  );
};

// ─── Main Component ───────────────────────────────────────────────────────────

export const WorkflowWindow: React.FC = () => {
  const [workflow, setWorkflow] = useState<Workflow>({
    id: generateId(),
    name: 'Novo Mini-Workflow',
    nodes: [
      { id: 'node-trigger-1', type: 'trigger', label: 'Manual Trigger', x: 60, y: 120, config: { mode: 'manual' } },
    ],
    connections: [],
    createdAt: Date.now(),
    updatedAt: Date.now(),
  });

  const [nodeStatus, setNodeStatus] = useState<NodeStatus>({});
  const [nodeRunData, setNodeRunData] = useState<Record<string, NodeRunData>>({});
  const [isRunning, setIsRunning] = useState(false);
  const [executionLog, setExecutionLog] = useState<Array<{ nodeId: string; status: string; output?: unknown }>>([]);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'config' | 'input' | 'output'>('config');
  const [canvasOffset, setCanvasOffset] = useState({ x: 0, y: 0 });
  const [isPanningCanvas, setIsPanningCanvas] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [workflowName, setWorkflowName] = useState(workflow.name);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [workflows, setWorkflows] = useState<Workflow[]>([]);
  const [showList, setShowList] = useState(false);
  const [toastMsg, setToastMsg] = useState<string | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  // Connecting state
  const [connectingSourceNodeId, setConnectingSourceNodeId] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);
  const panStartRef = useRef({ x: 0, y: 0, ox: 0, oy: 0 });
  const fileImportRef = useRef<HTMLInputElement>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg(null), 3500);
  };

  const copyText = (text: string, key: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2000);
  };

  const selectedNode = workflow.nodes.find((n) => n.id === selectedNodeId) ?? null;

  // Load workflows list
  const loadWorkflowsList = async () => {
    try {
      const resp = await authFetch('/api/workflows');
      if (resp.ok) {
        const data = await resp.json();
        setWorkflows(data);
      }
    } catch {}
  };

  useEffect(() => {
    loadWorkflowsList();
  }, []);

  // ─── Add node ────────────────────────────────────────────────────────────────
  const addNode = (type: NodeType) => {
    const id = `node-${type}-${generateId()}`;
    const meta = NODE_CONFIGS[type];
    const newNode: WFNode = {
      id,
      type,
      label: meta.label,
      x: 80 + workflow.nodes.length * 50,
      y: 80 + (workflow.nodes.length % 3) * 110,
      config: type === 'trigger' ? { mode: 'manual' } : {},
    };
    setWorkflow((wf) => ({ ...wf, nodes: [...wf.nodes, newNode], updatedAt: Date.now() }));
    setSelectedNodeId(id);
  };

  const deleteNode = (nodeId: string) => {
    setWorkflow((wf) => ({
      ...wf,
      nodes: wf.nodes.filter((n) => n.id !== nodeId),
      connections: wf.connections.filter((c) => c.sourceNodeId !== nodeId && c.targetNodeId !== nodeId),
      updatedAt: Date.now(),
    }));
    if (selectedNodeId === nodeId) setSelectedNodeId(null);
    if (connectingSourceNodeId === nodeId) setConnectingSourceNodeId(null);
  };

  // ─── Connections Management ──────────────────────────────────────────────────
  const startConnecting = (sourceNodeId: string) => {
    setConnectingSourceNodeId(sourceNodeId);
    showToast('Clique em um nó de destino para concluir a conexão (ou ESC para cancelar).');
  };

  const completeConnection = (targetNodeId: string) => {
    if (!connectingSourceNodeId) return;
    if (connectingSourceNodeId === targetNodeId) {
      setConnectingSourceNodeId(null);
      return;
    }

    // Check if connection already exists
    const exists = workflow.connections.some(
      (c) => c.sourceNodeId === connectingSourceNodeId && c.targetNodeId === targetNodeId
    );

    if (exists) {
      showToast('Esta conexão já existe.');
      setConnectingSourceNodeId(null);
      return;
    }

    const newConn: WFConnection = {
      id: `conn-${generateId()}`,
      sourceNodeId: connectingSourceNodeId,
      targetNodeId,
    };

    setWorkflow((wf) => ({
      ...wf,
      connections: [...wf.connections, newConn],
      updatedAt: Date.now(),
    }));
    setConnectingSourceNodeId(null);
    showToast('Nós conectados com sucesso!');
  };

  const deleteConnection = (connId: string) => {
    setWorkflow((wf) => ({
      ...wf,
      connections: wf.connections.filter((c) => c.id !== connId),
      updatedAt: Date.now(),
    }));
    showToast('Conexão removida.');
  };

  // ─── Node Drag ───────────────────────────────────────────────────────────────
  const handleNodeDragStart = (e: React.PointerEvent, nodeId: string) => {
    e.stopPropagation();
    if (connectingSourceNodeId) {
      completeConnection(nodeId);
      return;
    }

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
    if (connectingSourceNodeId) {
      setConnectingSourceNodeId(null);
      return;
    }
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

  // ─── Run Workflow (SSE with I/O inspection) ───────────────────────────────────
  const runWorkflow = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setNodeStatus({});
    setExecutionLog([]);
    setShowLog(true);

    let activeWfId = savedId;

    // Se o workflow ainda não foi salvo no servidor, salva antes de disparar o SSE
    if (!activeWfId) {
      try {
        const payload = { ...workflow, name: workflowName };
        const saveResp = await authFetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (saveResp.ok) {
          const saved = await saveResp.json();
          activeWfId = saved.id;
          setSavedId(saved.id);
          setWorkflow(saved);
        }
      } catch {}
    }

    if (activeWfId) {
      try {
        const resp = await authFetch(`/api/workflows/${activeWfId}/run`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        });

        if (!resp.ok || !resp.body) {
          setIsRunning(false);
          showToast('Erro ao iniciar execução no servidor.');
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
              setNodeRunData((prev) => ({
                ...prev,
                [data.nodeId]: {
                  output: data.output,
                  error: data.error,
                },
              }));
            } else if (event === 'done') {
              setIsRunning(false);
              showToast('Execução do Mini-Workflow concluída com sucesso!');
              // Preenche dados de execução completa
              if (data.nodeResults && Array.isArray(data.nodeResults)) {
                for (const nr of data.nodeResults) {
                  setNodeRunData((prev) => ({
                    ...prev,
                    [nr.nodeId]: {
                      output: nr.output,
                      error: nr.error,
                    },
                  }));
                }
              }
            } else if (event === 'error') {
              setIsRunning(false);
              showToast(`Erro na execução: ${data.error}`);
            }
          }
        }
      } catch (err: any) {
        setIsRunning(false);
        showToast(`Falha de conexão: ${err.message}`);
      }
    } else {
      // Simulação local de segurança
      for (const node of workflow.nodes) {
        setNodeStatus((prev) => ({ ...prev, [node.id]: 'running' }));
        await new Promise((r) => setTimeout(r, 300));
        setNodeStatus((prev) => ({ ...prev, [node.id]: 'success' }));
        setExecutionLog((prev) => [...prev, { nodeId: node.id, status: 'success', output: 'Executado localmente' }]);
      }
      setIsRunning(false);
    }
  };

  // ─── Save Workflow ───────────────────────────────────────────────────────────
  const saveWorkflow = async (asNew = false) => {
    setIsSaving(true);
    const targetId = asNew || !savedId ? generateId() : savedId;
    const payload = { ...workflow, id: targetId, name: workflowName, updatedAt: Date.now() };

    try {
      let resp;
      if (!asNew && savedId) {
        resp = await authFetch(`/api/workflows/${savedId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      } else {
        resp = await authFetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
      }

      if (resp.ok) {
        const saved: Workflow = await resp.json();
        setSavedId(saved.id);
        setWorkflow(saved);
        setWorkflowName(saved.name);
        showToast(`Workflow "${saved.name}" salvo com sucesso!`);
        loadWorkflowsList();
      } else {
        showToast('Erro ao salvar workflow.');
      }
    } catch (err: any) {
      showToast(`Falha ao salvar: ${err.message}`);
    }
    setIsSaving(false);
  };

  // ─── Save into Workspace File System ─────────────────────────────────────────
  const saveToWorkspaceFS = async () => {
    try {
      const fileName = `${workflowName.toLowerCase().replace(/[^a-z0-9_-]/g, '_') || 'workflow'}.json`;
      const filePath = `workflows/${fileName}`;
      const resp = await authFetch('/api/fs/write', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          path: filePath,
          content: JSON.stringify(workflow, null, 2),
        }),
      });

      if (resp.ok) {
        showToast(`Arquivo salvo no workspace em: ${filePath}`);
      } else {
        exportJSON();
      }
    } catch {
      exportJSON();
    }
  };

  // ─── Export & Import JSON ────────────────────────────────────────────────────
  const exportJSON = () => {
    const dataStr = 'data:text/json;charset=utf-8,' + encodeURIComponent(JSON.stringify(workflow, null, 2));
    const a = document.createElement('a');
    a.setAttribute('href', dataStr);
    a.setAttribute('download', `${workflowName.toLowerCase().replace(/\s+/g, '_') || 'workflow'}.json`);
    document.body.appendChild(a);
    a.click();
    a.remove();
    showToast('Arquivo JSON exportado.');
  };

  const handleImportJSON = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const parsed = JSON.parse(ev.target?.result as string);
        if (parsed.nodes && Array.isArray(parsed.nodes)) {
          const imported: Workflow = {
            id: generateId(),
            name: parsed.name || 'Workflow Importado',
            nodes: parsed.nodes,
            connections: parsed.connections || [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
          };
          setWorkflow(imported);
          setWorkflowName(imported.name);
          setSavedId(null);
          showToast(`Workflow "${imported.name}" importado para o canvas.`);
        } else {
          showToast('JSON inválido: esperado objeto de workflow.');
        }
      } catch (err: any) {
        showToast(`Erro ao importar: ${err.message}`);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ─── Trigger -> Agendar no Crontab ───────────────────────────────────────────
  const scheduleOnCrontab = async (expr = '0 8 * * *') => {
    // Certificar de salvar o workflow antes de agendar
    let activeWfId = savedId;
    if (!activeWfId) {
      try {
        const payload = { ...workflow, name: workflowName };
        const saveResp = await authFetch('/api/workflows', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        if (saveResp.ok) {
          const saved = await saveResp.json();
          activeWfId = saved.id;
          setSavedId(saved.id);
          setWorkflow(saved);
        }
      } catch {}
    }

    if (!activeWfId) {
      showToast('Por favor, salve o workflow antes de agendar no Crontab.');
      return;
    }

    try {
      const resp = await authFetch('/api/cron/jobs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Workflow: ${workflowName}`,
          expression: expr,
          command: `workflow:${activeWfId}`,
        }),
      });

      if (resp.ok) {
        showToast(`Agendamento criado no Crontab (${expr}) com sucesso!`);
      } else {
        const err = await resp.json().catch(() => ({}));
        showToast(`Erro ao agendar: ${err.error || 'Falha no servidor'}`);
      }
    } catch (err: any) {
      showToast(`Erro ao agendar: ${err.message}`);
    }
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

  // Predecessores e Sucessores do nó selecionado
  const incomingNodes = selectedNode
    ? workflow.connections
        .filter((c) => c.targetNodeId === selectedNode.id)
        .map((c) => ({
          connectionId: c.id,
          node: workflow.nodes.find((n) => n.id === c.sourceNodeId),
        }))
        .filter((item) => item.node !== undefined)
    : [];

  const outgoingNodes = selectedNode
    ? workflow.connections
        .filter((c) => c.sourceNodeId === selectedNode.id)
        .map((c) => ({
          connectionId: c.id,
          node: workflow.nodes.find((n) => n.id === c.targetNodeId),
        }))
        .filter((item) => item.node !== undefined)
    : [];

  return (
    <div className="flex flex-col h-full bg-[#060d1c] relative font-mono text-xs select-none">
      <input
        type="file"
        ref={fileImportRef}
        onChange={handleImportJSON}
        accept=".json"
        className="hidden"
      />

      {/* Toast Notification */}
      {toastMsg && (
        <div className="absolute top-2 right-2 z-50 px-3 py-1.5 rounded bg-[#10b981] text-black font-semibold text-[11px] shadow-lg flex items-center gap-1.5 animate-in fade-in">
          <CheckCircle className="w-3.5 h-3.5" />
          {toastMsg}
        </div>
      )}

      {/* Main Toolbar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e] flex-wrap">
        <input
          value={workflowName}
          onChange={(e) => setWorkflowName(e.target.value)}
          className="bg-transparent text-xs text-[#e6f0ff] font-mono border border-[#1a2a4a] rounded px-2 py-1 focus:outline-none focus:border-[#3ba9ff]/50 min-w-[180px] max-w-[280px]"
          placeholder="Nome do Mini-Workflow"
        />

        {savedId && (
          <span className="text-[9px] text-[#4a6080] bg-[#0a1628] border border-[#1a2a4a] px-1.5 py-0.5 rounded truncate max-w-[120px]">
            ID: {savedId}
          </span>
        )}

        <div className="h-4 w-[1px] bg-[#1a2a4a]" />

        {/* Gerenciador / Lista */}
        <button
          onClick={() => {
            setShowList((v) => !v);
            loadWorkflowsList();
          }}
          className={`flex items-center gap-1 px-2 py-1 rounded text-xs transition-all ${
            showList ? 'bg-[#1a2a4a] text-[#5eead4]' : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a]'
          }`}
          title="Listar e carregar workflows salvos"
        >
          <LayoutGrid className="w-3.5 h-3.5" />
          <span>Workflows</span>
        </button>

        {/* Salvar */}
        <button
          onClick={() => saveWorkflow(false)}
          disabled={isSaving}
          className="flex items-center gap-1 px-2.5 py-1 rounded text-xs bg-[#1a2a4a] hover:bg-[#1e3253] text-[#5eead4] border border-[#5eead4]/30 transition-all font-semibold"
          title="Salvar alterações no servidor"
        >
          <Save className="w-3.5 h-3.5" />
          {isSaving ? 'Salvando...' : 'Salvar'}
        </button>

        {/* Salvar no Workspace */}
        <button
          onClick={saveToWorkspaceFS}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
          title="Gravar arquivo .json no workspace (/workflows/)"
        >
          <HardDrive className="w-3.5 h-3.5" />
          <span>No Workspace</span>
        </button>

        {/* Exportar JSON */}
        <button
          onClick={exportJSON}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
          title="Baixar arquivo JSON do workflow"
        >
          <Download className="w-3.5 h-3.5" />
          <span>Exportar</span>
        </button>

        {/* Importar JSON */}
        <button
          onClick={() => fileImportRef.current?.click()}
          className="flex items-center gap-1 px-2 py-1 rounded text-xs text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a] transition-all"
          title="Carregar arquivo JSON no canvas"
        >
          <Upload className="w-3.5 h-3.5" />
          <span>Importar</span>
        </button>

        <div className="flex-1" />

        {/* Executar */}
        <button
          onClick={runWorkflow}
          disabled={isRunning}
          className="flex items-center gap-1.5 px-3 py-1 rounded text-xs font-semibold bg-[#22c55e]/20 hover:bg-[#22c55e]/30 text-[#22c55e] border border-[#22c55e]/40 transition-all disabled:opacity-50"
        >
          <Play className="w-3.5 h-3.5 fill-current" />
          {isRunning ? 'Executando...' : 'Executar Workflow'}
        </button>
      </div>

      {/* Saved Workflows Modal / Drawer */}
      {showList && (
        <div className="border-b border-[#1a2a4a] bg-[#07101f] p-3 max-h-56 overflow-y-auto space-y-2 animate-in slide-in-from-top-2">
          <div className="flex items-center justify-between text-[11px] text-[#7a92b8] font-semibold border-b border-[#1a2a4a] pb-1">
            <span>WORKFLOWS SALVOS ({workflows.length})</span>
            <button onClick={() => setShowList(false)} className="hover:text-white">✕</button>
          </div>
          {workflows.length === 0 ? (
            <div className="text-[10px] text-[#4a6080] py-2">Nenhum workflow salvo no servidor.</div>
          ) : (
            <div className="grid grid-cols-3 gap-2">
              {workflows.map((wf) => (
                <div
                  key={wf.id}
                  className={`p-2 rounded border transition-all flex items-center justify-between gap-2 ${
                    savedId === wf.id
                      ? 'border-[#5eead4] bg-[#5eead4]/10'
                      : 'border-[#1a2a4a] bg-[#0a1628] hover:border-[#3ba9ff]/40'
                  }`}
                >
                  <div
                    className="flex-1 min-w-0 cursor-pointer"
                    onClick={() => {
                      setWorkflow(wf);
                      setWorkflowName(wf.name);
                      setSavedId(wf.id);
                      setShowList(false);
                      showToast(`Workflow "${wf.name}" carregado.`);
                    }}
                  >
                    <div className="text-[#e6f0ff] font-semibold truncate text-[11px]">{wf.name}</div>
                    <div className="text-[9px] text-[#4a6080]">
                      {wf.nodes.length} nós • {new Date(wf.updatedAt).toLocaleDateString()}
                    </div>
                  </div>
                  <button
                    onClick={async (e) => {
                      e.stopPropagation();
                      if (!confirm(`Excluir workflow "${wf.name}"?`)) return;
                      await authFetch(`/api/workflows/${wf.id}`, { method: 'DELETE' });
                      loadWorkflowsList();
                      if (savedId === wf.id) setSavedId(null);
                    }}
                    className="text-[#4a6080] hover:text-[#ef4444] p-1 rounded"
                    title="Excluir"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Node Palette Bar */}
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

        {connectingSourceNodeId && (
          <div className="ml-auto flex items-center gap-1 text-[10px] text-[#f97316] bg-[#f97316]/10 px-2 py-0.5 rounded border border-[#f97316]/30 animate-pulse">
            <span>Conectando... clique no nó de destino</span>
            <button onClick={() => setConnectingSourceNodeId(null)} className="ml-1 text-white hover:text-[#ef4444]">✕</button>
          </div>
        )}
      </div>

      {/* Canvas + Side Panel */}
      <div className="flex flex-1 overflow-hidden">
        {/* SVG Canvas */}
        <div
          ref={canvasRef}
          className="relative flex-1 overflow-hidden"
          style={{
            cursor: isPanningCanvas ? 'grabbing' : 'grab',
            background: 'radial-gradient(circle at 50% 50%, #0a1628 0%, #060d1c 100%)',
          }}
          onPointerDown={handleCanvasDragStart}
          onClick={() => {
            setSelectedNodeId(null);
            if (connectingSourceNodeId) setConnectingSourceNodeId(null);
          }}
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
            style={{
              transform: `translate(${canvasOffset.x}px, ${canvasOffset.y}px)`,
              position: 'absolute',
              inset: 0,
            }}
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
                    onDelete={() => deleteConnection(conn.id)}
                  />
                );
              })}
            </svg>

            {/* Nodes */}
            {workflow.nodes.map((node) => {
              const meta = NODE_CONFIGS[node.type] ?? NODE_CONFIGS['trigger'];
              const status = nodeStatus[node.id] ?? 'idle';
              const isSelected = selectedNodeId === node.id;
              const isSource = connectingSourceNodeId === node.id;

              return (
                <div
                  key={node.id}
                  data-wf-node={node.id}
                  onPointerDown={(e) => {
                    e.stopPropagation();
                    handleNodeDragStart(e, node.id);
                  }}
                  onClick={(e) => {
                    e.stopPropagation();
                    if (connectingSourceNodeId) {
                      completeConnection(node.id);
                    } else {
                      setSelectedNodeId(node.id);
                    }
                  }}
                  style={{
                    position: 'absolute',
                    left: node.x,
                    top: node.y,
                    width: NODE_WIDTH,
                    height: NODE_HEIGHT,
                    borderRadius: 10,
                    border: `2px solid ${isSource ? '#f97316' : isSelected ? meta.color : `${meta.color}50`}`,
                    background: `linear-gradient(135deg, ${meta.color}18 0%, #0a1628 100%)`,
                    boxShadow: isSource
                      ? '0 0 20px #f97316'
                      : isSelected
                      ? `0 0 18px ${meta.color}55`
                      : `0 4px 12px rgba(0,0,0,0.4)`,
                    cursor: 'grab',
                    userSelect: 'none',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    padding: '0 12px',
                    transition: 'box-shadow 0.2s, border-color 0.2s',
                  }}
                >
                  {/* Input Port (Left) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      completeConnection(node.id);
                    }}
                    title="Porta de entrada ($input)"
                    style={{
                      position: 'absolute',
                      left: -8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#0a1628',
                      border: `2px solid ${connectingSourceNodeId ? '#f97316' : '#7a92b8'}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#7a92b8' }} />
                  </div>

                  {/* Output Port (Right) */}
                  <div
                    onClick={(e) => {
                      e.stopPropagation();
                      startConnecting(node.id);
                    }}
                    title="Porta de saída ($output) - Clique para conectar"
                    style={{
                      position: 'absolute',
                      right: -8,
                      top: '50%',
                      transform: 'translateY(-50%)',
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      background: '#0a1628',
                      border: `2px solid ${meta.color}`,
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: meta.color }} />
                  </div>

                  {/* Node Content */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ color: meta.color }}>{meta.icon}</span>
                    <span
                      style={{
                        fontSize: 11,
                        fontFamily: 'monospace',
                        color: '#e6f0ff',
                        flex: 1,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        whiteSpace: 'nowrap',
                      }}
                    >
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
                    onClick={(e) => {
                      e.stopPropagation();
                      deleteNode(node.id);
                    }}
                    style={{
                      position: 'absolute',
                      top: -6,
                      right: -6,
                      background: '#0a1628',
                      border: '1px solid #ef4444',
                      borderRadius: '50%',
                      width: 16,
                      height: 16,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      color: '#ef4444',
                      opacity: isSelected ? 1 : 0,
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

        {/* Side Panel: Node Config & I/O Tabs */}
        {selectedNode && (
          <div className="w-80 border-l border-[#1a2a4a] bg-[#080f1e] flex flex-col overflow-hidden">
            {/* Node Title Header */}
            <div className="px-3 py-2 border-b border-[#1a2a4a] text-[11px] font-mono text-[#7a92b8] flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span style={{ color: NODE_CONFIGS[selectedNode.type]?.color }}>
                  {NODE_CONFIGS[selectedNode.type]?.icon}
                </span>
                <span className="font-semibold text-[#e6f0ff]">{selectedNode.label}</span>
              </div>
              <span className="text-[9px] text-[#4a6080] uppercase">{selectedNode.type}</span>
            </div>

            {/* Tab navigation: Config / Input / Output */}
            <div className="flex border-b border-[#1a2a4a] bg-[#060d1c] text-[10px]">
              <button
                onClick={() => setActiveTab('config')}
                className={`flex-1 py-1.5 text-center transition-all ${
                  activeTab === 'config'
                    ? 'text-[#3ba9ff] border-b-2 border-[#3ba9ff] font-semibold bg-[#3ba9ff]/10'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff]'
                }`}
              >
                Configuração
              </button>
              <button
                onClick={() => setActiveTab('input')}
                className={`flex-1 py-1.5 text-center transition-all ${
                  activeTab === 'input'
                    ? 'text-[#5eead4] border-b-2 border-[#5eead4] font-semibold bg-[#5eead4]/10'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff]'
                }`}
              >
                Entrada ($input)
              </button>
              <button
                onClick={() => setActiveTab('output')}
                className={`flex-1 py-1.5 text-center transition-all ${
                  activeTab === 'output'
                    ? 'text-[#a78bfa] border-b-2 border-[#a78bfa] font-semibold bg-[#a78bfa]/10'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff]'
                }`}
              >
                Saída ($output)
              </button>
            </div>

            {/* Tab Contents */}
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {activeTab === 'config' && (
                <>
                  <div>
                    <label className="block text-[9px] font-mono text-[#4a6080] mb-1">LABEL DO NÓ</label>
                    <input
                      value={selectedNode.label}
                      onChange={(e) => {
                        const label = e.target.value;
                        setWorkflow((wf) => ({
                          ...wf,
                          nodes: wf.nodes.map((n) => (n.id === selectedNode.id ? { ...n, label } : n)),
                        }));
                      }}
                      className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#3ba9ff]/50"
                    />
                  </div>

                  {/* Conexões do nó */}
                  <div className="p-2 rounded bg-[#0a1628] border border-[#1a2a4a] space-y-2">
                    <div className="text-[9px] font-semibold text-[#7a92b8]">CONEXÕES & I/O</div>

                    {/* Predecessores */}
                    <div>
                      <div className="text-[8px] text-[#4a6080] mb-0.5">ENTRADAS RECEBIDAS DE:</div>
                      {incomingNodes.length === 0 ? (
                        <div className="text-[9px] text-[#4a6080] italic">Nenhuma (alimentado pelo Trigger)</div>
                      ) : (
                        <div className="space-y-1">
                          {incomingNodes.map(({ connectionId, node }) => (
                            <div key={connectionId} className="flex items-center justify-between text-[9px] text-[#34d399] bg-black/30 px-1.5 py-0.5 rounded">
                              <span>← {node?.label}</span>
                              <button onClick={() => deleteConnection(connectionId)} className="text-[#4a6080] hover:text-[#ef4444]">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Sucessores */}
                    <div>
                      <div className="text-[8px] text-[#4a6080] mb-0.5">SAÍDAS ENVIADAS PARA:</div>
                      {outgoingNodes.length === 0 ? (
                        <div className="text-[9px] text-[#4a6080] italic">Nenhum nó conectado à saída</div>
                      ) : (
                        <div className="space-y-1">
                          {outgoingNodes.map(({ connectionId, node }) => (
                            <div key={connectionId} className="flex items-center justify-between text-[9px] text-[#a78bfa] bg-black/30 px-1.5 py-0.5 rounded">
                              <span>→ {node?.label}</span>
                              <button onClick={() => deleteConnection(connectionId)} className="text-[#4a6080] hover:text-[#ef4444]">✕</button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Quick Connect dropdown */}
                    <div className="pt-1">
                      <button
                        onClick={() => startConnecting(selectedNode.id)}
                        className="w-full flex items-center justify-center gap-1 py-1 rounded text-[10px] bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/30 transition-all font-semibold"
                      >
                        <ArrowRight className="w-3 h-3" /> Conectar a outro nó...
                      </button>
                    </div>
                  </div>

                  {/* HTTP REQUEST */}
                  {selectedNode.type === 'http-request' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MÉTODO HTTP</label>
                        <select
                          value={String(selectedNode.config.method ?? 'GET')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, method: e.target.value } } : n
                              ),
                            }))
                          }
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                        >
                          {['GET', 'POST', 'PUT', 'DELETE', 'PATCH'].map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">URL (com templates)</label>
                        <input
                          value={String(selectedNode.config.url ?? '')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, url: e.target.value } } : n
                              ),
                            }))
                          }
                          placeholder="https://api.exemplo.com/itens/{{$json.id}}"
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#34d399]/50"
                        />
                        <span className="text-[8px] text-[#4a6080]">Suporta: {`{{$json.chave}}`}, {`{{trigger.id}}`}</span>
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">BODY (opcional)</label>
                        <textarea
                          value={typeof selectedNode.config.body === 'object' ? JSON.stringify(selectedNode.config.body, null, 2) : String(selectedNode.config.body ?? '')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, body: e.target.value } } : n
                              ),
                            }))
                          }
                          rows={4}
                          placeholder="Deixe vazio para repassar o $json do nó anterior"
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#34d399]/50 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* CODE BOX */}
                  {selectedNode.type === 'code-box' && (
                    <div className="space-y-2">
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">LINGUAGEM</label>
                        <select
                          value={String(selectedNode.config.language ?? 'javascript')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, language: e.target.value } } : n
                              ),
                            }))
                          }
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                        >
                          <option value="javascript">JavaScript (VM Sandbox)</option>
                          <option value="python">Python (Host Subprocess)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">
                          {String(selectedNode.config.language ?? 'javascript') === 'python' ? 'CÓDIGO PYTHON' : 'CÓDIGO JAVASCRIPT'}
                        </label>
                        <textarea
                          value={String(selectedNode.config.code ?? '')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, code: e.target.value } } : n
                              ),
                            }))
                          }
                          rows={9}
                          placeholder={
                            String(selectedNode.config.language ?? 'javascript') === 'python'
                              ? "# variáveis: input_data, json_data, items, trigger\nreturn {'status': 'processed', 'item': json_data}"
                              : "// variáveis: $input, $json, items, trigger\nreturn { total: $json?.preco * 2 };"
                          }
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#a78bfa]/50 resize-none"
                        />
                      </div>
                    </div>
                  )}

                  {/* CONDITION */}
                  {selectedNode.type === 'condition' && (
                    <div>
                      <label className="block text-[9px] font-mono text-[#4a6080] mb-1">EXPRESSÃO BOOLEANA (JS)</label>
                      <input
                        value={String(selectedNode.config.expression ?? '')}
                        onChange={(e) =>
                          setWorkflow((wf) => ({
                            ...wf,
                            nodes: wf.nodes.map((n) =>
                              n.id === selectedNode.id ? { ...n, config: { ...n.config, expression: e.target.value } } : n
                            ),
                          }))
                        }
                        placeholder="$json.status === 200 || trigger.active"
                        className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#fbbf24]/50"
                      />
                      <p className="text-[9px] text-[#4a6080] mt-1 font-mono">Bifurca o fluxo de acordo com o resultado booleano.</p>
                    </div>
                  )}

                  {/* LOG OUTPUT */}
                  {selectedNode.type === 'log-output' && (
                    <div>
                      <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MENSAGEM DO LOG (opcional)</label>
                      <input
                        value={String(selectedNode.config.message ?? '')}
                        onChange={(e) =>
                          setWorkflow((wf) => ({
                            ...wf,
                            nodes: wf.nodes.map((n) =>
                              n.id === selectedNode.id ? { ...n, config: { ...n.config, message: e.target.value } } : n
                            ),
                          }))
                        }
                        placeholder="Usuário {{$json.nome}} processado com sucesso"
                        className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#fb7185]/50"
                      />
                      <span className="text-[8px] text-[#4a6080]">Deixe vazio para logar o JSON integral do nó anterior.</span>
                    </div>
                  )}

                  {/* TRIGGER COM INTEGRAÇÃO CRON */}
                  {selectedNode.type === 'trigger' && (
                    <div className="space-y-3">
                      <div>
                        <label className="block text-[9px] font-mono text-[#4a6080] mb-1">MODO DE DISPARO</label>
                        <select
                          value={String(selectedNode.config.mode ?? 'manual')}
                          onChange={(e) =>
                            setWorkflow((wf) => ({
                              ...wf,
                              nodes: wf.nodes.map((n) =>
                                n.id === selectedNode.id ? { ...n, config: { ...n.config, mode: e.target.value } } : n
                              ),
                            }))
                          }
                          className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none"
                        >
                          <option value="manual">Manual (Play no Canvas)</option>
                          <option value="webhook">Webhook Externo (HTTP POST/GET)</option>
                          <option value="cron">Crontab Agendado (Automático)</option>
                        </select>
                      </div>

                      {selectedNode.config.mode === 'webhook' && (
                        <div>
                          <label className="block text-[9px] font-mono text-[#4a6080] mb-1">WEBHOOK ID</label>
                          <input
                            value={String(selectedNode.config.webhookId ?? selectedNode.id)}
                            onChange={(e) =>
                              setWorkflow((wf) => ({
                                ...wf,
                                nodes: wf.nodes.map((n) =>
                                  n.id === selectedNode.id ? { ...n, config: { ...n.config, webhookId: e.target.value } } : n
                                ),
                              }))
                            }
                            className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#3ba9ff]/50"
                          />
                          <div className="mt-1.5 p-1.5 bg-black/40 rounded border border-white/5 text-[9px] font-mono text-slate-400 break-all">
                            <span className="text-[#3ba9ff]">URL:</span> /api/workflows/webhook/{String(selectedNode.config.webhookId ?? selectedNode.id)}
                          </div>
                        </div>
                      )}

                      {selectedNode.config.mode === 'cron' && (
                        <div className="p-2 rounded bg-[#0a1628] border border-[#a78bfa]/30 space-y-2">
                          <div className="flex items-center gap-1.5 text-[10px] text-[#a78bfa] font-semibold">
                            <Clock className="w-3.5 h-3.5" />
                            Gatilho Crontab Integrado
                          </div>
                          <div>
                            <label className="block text-[8px] text-[#4a6080] mb-0.5">EXPRESSÃO CRON</label>
                            <input
                              value={String(selectedNode.config.cronExpr ?? '0 8 * * *')}
                              onChange={(e) =>
                                setWorkflow((wf) => ({
                                  ...wf,
                                  nodes: wf.nodes.map((n) =>
                                    n.id === selectedNode.id ? { ...n, config: { ...n.config, cronExpr: e.target.value } } : n
                                  ),
                                }))
                              }
                              placeholder="0 8 * * * (Todo dia às 08:00)"
                              className="w-full bg-[#060d1c] border border-[#1a2a4a] rounded px-2 py-1 text-xs text-[#e6f0ff] focus:outline-none"
                            />
                          </div>

                          <div className="flex gap-1 flex-wrap">
                            {[
                              { label: '08:00 Todo dia', expr: '0 8 * * *' },
                              { label: 'A cada 5 min', expr: '*/5 * * * *' },
                              { label: 'A cada hora', expr: '0 * * * *' },
                            ].map((preset) => (
                              <button
                                key={preset.expr}
                                onClick={() =>
                                  setWorkflow((wf) => ({
                                    ...wf,
                                    nodes: wf.nodes.map((n) =>
                                      n.id === selectedNode.id ? { ...n, config: { ...n.config, cronExpr: preset.expr } } : n
                                    ),
                                  }))
                                }
                                className="text-[8px] px-1.5 py-0.5 rounded border border-[#1a2a4a] text-[#7a92b8] hover:text-[#a78bfa]"
                              >
                                {preset.label}
                              </button>
                            ))}
                          </div>

                          <button
                            onClick={() => scheduleOnCrontab(String(selectedNode.config.cronExpr ?? '0 8 * * *'))}
                            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#a78bfa]/20 hover:bg-[#a78bfa]/30 text-[#a78bfa] border border-[#a78bfa]/40 font-semibold text-[10px] transition-all"
                          >
                            <Clock className="w-3 h-3" /> Agendar no Crontab Agora
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </>
              )}

              {/* ENTRADA ($input) TAB */}
              {activeTab === 'input' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#4a6080]">DADOS FORNECIDOS PELO PREDECESOR:</span>
                    <button
                      onClick={() => copyText(JSON.stringify(nodeRunData[selectedNode.id]?.input ?? incomingNodes.map(n => n.node?.label), null, 2), 'input')}
                      className="flex items-center gap-1 text-[9px] text-[#7a92b8] hover:text-white"
                    >
                      {copiedKey === 'input' ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
                      Copiar
                    </button>
                  </div>
                  <pre className="p-2 bg-[#060d1c] border border-[#1a2a4a] rounded text-[10px] text-[#5eead4] overflow-x-auto max-h-72 whitespace-pre-wrap">
                    {nodeRunData[selectedNode.id]?.input !== undefined
                      ? JSON.stringify(nodeRunData[selectedNode.id]?.input, null, 2)
                      : incomingNodes.length > 0
                      ? `// Conectado aos nós:\n// ${incomingNodes.map((n) => n.node?.label).join(', ')}\n// Execute o workflow para inspecionar os dados reais.`
                      : '// Nenhum nó predecessor conectado.'}
                  </pre>
                </div>
              )}

              {/* SAÍDA ($output) TAB */}
              {activeTab === 'output' && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[9px] text-[#4a6080]">RESULTADO DA ÚLTIMA EXECUÇÃO:</span>
                    {nodeRunData[selectedNode.id]?.output !== undefined && (
                      <button
                        onClick={() => copyText(JSON.stringify(nodeRunData[selectedNode.id]?.output, null, 2), 'output')}
                        className="flex items-center gap-1 text-[9px] text-[#7a92b8] hover:text-white"
                      >
                        {copiedKey === 'output' ? <Check className="w-3 h-3 text-[#22c55e]" /> : <Copy className="w-3 h-3" />}
                        Copiar
                      </button>
                    )}
                  </div>
                  <pre className="p-2 bg-[#060d1c] border border-[#1a2a4a] rounded text-[10px] text-[#a78bfa] overflow-x-auto max-h-72 whitespace-pre-wrap">
                    {nodeRunData[selectedNode.id]?.output !== undefined
                      ? JSON.stringify(nodeRunData[selectedNode.id]?.output, null, 2)
                      : nodeRunData[selectedNode.id]?.error
                      ? `ERRO: ${nodeRunData[selectedNode.id]?.error}`
                      : '// Execute o workflow para gerar e inspecionar a saída deste nó.'}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Execution Log Panel */}
      {showLog && (
        <div className="h-40 border-t border-[#1a2a4a] bg-[#060d1c] flex flex-col overflow-hidden">
          <div className="flex items-center justify-between px-3 py-1.5 border-b border-[#1a2a4a]">
            <span className="text-[10px] font-mono text-[#7a92b8]">LOG DE EXECUÇÃO EM TEMPO REAL</span>
            <button onClick={() => setShowLog(false)} className="text-[#4a6080] hover:text-[#e6f0ff] text-xs">✕</button>
          </div>
          <div className="flex-1 overflow-y-auto p-2 space-y-0.5 font-mono text-xs">
            {executionLog.length === 0 && (
              <div className="text-[#4a6080] text-[10px]">Aguardando disparo do fluxo...</div>
            )}
            {executionLog.map((entry, i) => {
              const node = workflow.nodes.find((n) => n.id === entry.nodeId);
              const color = entry.status === 'success' ? '#22c55e' : entry.status === 'error' ? '#ef4444' : '#f97316';
              return (
                <div key={i} className="flex items-start gap-2">
                  <span style={{ color }} className="shrink-0">
                    {entry.status === 'success' ? '✓' : entry.status === 'error' ? '✗' : '⟳'}
                  </span>
                  <span className="text-[#5a7a9a] shrink-0">{node?.label ?? entry.nodeId}:</span>
                  <span className="text-[#3a5a7a] truncate text-[10px]">
                    {entry.output ? JSON.stringify(entry.output).slice(0, 140) : ''}
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
