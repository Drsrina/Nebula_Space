import React, { useState, useEffect, useRef } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  File,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Sparkles,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  ChevronDown,
} from 'lucide-react';
import { useFSStore } from '../../store/useFSStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useEditorStore } from '../../store/useEditorStore';

interface GraphNode {
  id: string;
  name: string;
  path: string;
  isDir: boolean;
  children?: GraphNode[];
  parentId?: string;
  x?: number;
  y?: number;
  collapsed?: boolean;
}

export const GraphWindow: React.FC = () => {
  const { currentPath, roots, readDir } = useFSStore();
  const { openWindow, windows } = useWindowsStore();
  const { openFile } = useEditorStore();

  const [treeData, setTreeData] = useState<GraphNode | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 50, y: 50 });
  const [isPanning, setIsPanning] = useState(false);
  const [startPan, setStartPan] = useState({ x: 0, y: 0 });
  const [collapsedNodes, setCollapsedNodes] = useState<Set<string>>(new Set());

  // Carrega recursivamente a estrutura de pastas até 3 níveis de profundidade
  const loadDirectoryTree = async () => {
    setIsLoading(true);
    try {
      const rootPath = roots[0]?.path || currentPath || '/workspace';

      async function scanDir(dirPath: string, depth: number = 0): Promise<GraphNode> {
        const name = dirPath === '/' ? 'root' : dirPath.split('/').filter(Boolean).pop() || dirPath;
        const node: GraphNode = {
          id: dirPath,
          name,
          path: dirPath,
          isDir: true,
          children: [],
        };

        if (depth >= 3) return node;

        const items = await readDir(dirPath);
        if (Array.isArray(items)) {
          // Filtra pastas ocultas ou muito pesadas
          const filtered = items.filter(
            (i) => !i.name.startsWith('.') && i.name !== 'node_modules' && i.name !== 'dist' && i.name !== 'target'
          );

          for (const item of filtered) {
            const fullPath = dirPath.endsWith('/') ? `${dirPath}${item.name}` : `${dirPath}/${item.name}`;
            if (item.isDirectory) {
              const childDir = await scanDir(fullPath, depth + 1);
              childDir.parentId = dirPath;
              node.children?.push(childDir);
            } else {
              node.children?.push({
                id: fullPath,
                name: item.name,
                path: fullPath,
                isDir: false,
                parentId: dirPath,
              });
            }
          }
        }

        return node;
      }

      const rootNode = await scanDir(rootPath);
      setTreeData(rootNode);
    } catch {
      // fallback
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadDirectoryTree();
  }, [roots]);

  // Layout calculando coordenadas X e Y em árvore hierárquica
  const layoutNodes = (root: GraphNode): { nodes: GraphNode[]; links: { from: GraphNode; to: GraphNode }[] } => {
    const nodes: GraphNode[] = [];
    const links: { from: GraphNode; to: GraphNode }[] = [];

    let currentY = 40;
    const HORIZONTAL_GAP = 220;
    const VERTICAL_GAP = 45;

    function traverse(node: GraphNode, depth: number) {
      const isCollapsed = collapsedNodes.has(node.id);
      node.x = depth * HORIZONTAL_GAP + 60;
      node.y = currentY;
      nodes.push(node);
      currentY += VERTICAL_GAP;

      if (!isCollapsed && node.children && node.children.length > 0) {
        for (const child of node.children) {
          links.push({ from: node, to: child });
          traverse(child, depth + 1);
        }
      }
    }

    if (root) traverse(root, 0);
    return { nodes, links };
  };

  const { nodes, links } = treeData ? layoutNodes(treeData) : { nodes: [], links: [] };

  const handleNodeClick = (node: GraphNode, e: React.MouseEvent) => {
    e.stopPropagation();

    if (node.isDir) {
      // Alterna expansão no grafo se clicar com Shift ou ícone
      if (e.altKey) {
        setCollapsedNodes((prev) => {
          const next = new Set(prev);
          if (next.has(node.id)) next.delete(node.id);
          else next.add(node.id);
          return next;
        });
        return;
      }

      // Abre ou foca o File Browser na pasta correspondente
      useFSStore.getState().navigateTo(node.path);
      openWindow('file-browser', { path: node.path });
    } else {
      // Abre arquivo no Monaco Editor
      openFile(node.path);
      openWindow('editor', { path: node.path });
    }
  };

  const toggleCollapse = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedNodes((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  // Controles de Pan pelo canvas SVG
  const handleMouseDown = (e: React.MouseEvent) => {
    if (e.button !== 0) return;
    setIsPanning(true);
    setStartPan({ x: e.clientX - pan.x, y: e.clientY - pan.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isPanning) return;
    setPan({ x: e.clientX - startPan.x, y: e.clientY - startPan.y });
  };

  const handleMouseUp = () => setIsPanning(false);

  const getFileIcon = (name: string, isDir: boolean) => {
    if (isDir) return <Folder className="w-4 h-4 text-[#3ba9ff] shrink-0" />;
    if (name.endsWith('.ts') || name.endsWith('.tsx') || name.endsWith('.js') || name.endsWith('.jsx')) {
      return <FileCode className="w-3.5 h-3.5 text-[#5eead4] shrink-0" />;
    }
    if (name.endsWith('.json') || name.endsWith('.md') || name.endsWith('.txt')) {
      return <FileText className="w-3.5 h-3.5 text-[#a78bfa] shrink-0" />;
    }
    return <File className="w-3.5 h-3.5 text-[#7a92b8] shrink-0" />;
  };

  return (
    <div className="flex flex-col h-full bg-[#050b17] text-[#e6f0ff] font-sans overflow-hidden select-none">
      {/* Top Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#081224] border-b border-[#3ba9ff]/20">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-[#3ba9ff]" />
          <span className="text-xs font-mono font-bold text-white uppercase tracking-wider">
            Workspace Directory Graph
          </span>
          <span className="text-[10px] text-[#5eead4] bg-[#5eead4]/15 px-2 py-0.5 rounded-full font-mono">
            {nodes.length} nós carregados
          </span>
        </div>

        {/* Zoom & Action Controls */}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => setZoom((z) => Math.min(z + 0.15, 2.5))}
            className="p-1.5 rounded-lg bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/25 text-[#3ba9ff]"
            title="Aproximar Zoom"
          >
            <ZoomIn className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setZoom((z) => Math.max(z - 0.15, 0.4))}
            className="p-1.5 rounded-lg bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/25 text-[#3ba9ff]"
            title="Afastar Zoom"
          >
            <ZoomOut className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => {
              setZoom(1);
              setPan({ x: 50, y: 50 });
            }}
            className="p-1.5 rounded-lg bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/25 text-[#3ba9ff]"
            title="Resetar Posição"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={loadDirectoryTree}
            disabled={isLoading}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#5eead4] text-xs font-mono"
            title="Recarregar Árvore de Diretórios"
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Recarregar</span>
          </button>
        </div>
      </div>

      {/* Graph Visual Stage */}
      <div
        className="flex-1 relative overflow-hidden bg-[#040812] cursor-grab active:cursor-grabbing"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
      >
        {/* Background Grid Accent */}
        <div
          className="absolute inset-0 pointer-events-none opacity-20"
          style={{
            backgroundImage: `radial-gradient(circle, #3ba9ff 1px, transparent 1px)`,
            backgroundSize: '32px 32px',
          }}
        />

        <div
          className="absolute inset-0 origin-top-left transition-transform duration-75"
          style={{
            transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`,
          }}
        >
          {/* SVG Links Between Parents & Children */}
          <svg className="absolute inset-0 pointer-events-none w-[5000px] h-[5000px]">
            {links.map((link, idx) => {
              const fromX = (link.from.x || 0) + 140;
              const fromY = (link.from.y || 0) + 16;
              const toX = (link.to.x || 0);
              const toY = (link.to.y || 0) + 16;
              const midX = (fromX + toX) / 2;

              return (
                <path
                  key={`link-${idx}`}
                  d={`M ${fromX} ${fromY} C ${midX} ${fromY}, ${midX} ${toY}, ${toX} ${toY}`}
                  fill="none"
                  stroke="#3ba9ff"
                  strokeOpacity="0.35"
                  strokeWidth="1.5"
                />
              );
            })}
          </svg>

          {/* Interactive HTML Nodes */}
          {nodes.map((node) => {
            const isDir = node.isDir;
            const hasChildren = Boolean(node.children && node.children.length > 0);
            const isCollapsed = collapsedNodes.has(node.id);

            return (
              <div
                key={node.id}
                onClick={(e) => handleNodeClick(node, e)}
                style={{
                  position: 'absolute',
                  left: `${node.x}px`,
                  top: `${node.y}px`,
                  width: '180px',
                }}
                className={`flex items-center justify-between gap-1.5 px-2.5 py-1.5 rounded-xl border backdrop-blur-md transition-all cursor-pointer select-none group shadow-[0_4px_16px_rgba(0,0,0,0.5)] ${
                  isDir
                    ? 'bg-[#0a1628]/90 border-[#3ba9ff]/30 hover:border-[#5eead4] hover:shadow-[0_0_15px_rgba(94,234,212,0.3)]'
                    : 'bg-[#060e1c]/80 border-[#1a2c4e]/50 hover:border-[#3ba9ff]/40 hover:bg-[#08152e]'
                }`}
                title={isDir ? `Clique para abrir pasta: ${node.path}` : `Clique para editar: ${node.path}`}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  {getFileIcon(node.name, isDir)}
                  <span className={`text-xs font-mono truncate ${isDir ? 'font-semibold text-white group-hover:text-[#5eead4]' : 'text-[#a0c4ff]'}`}>
                    {node.name}
                  </span>
                </div>

                {isDir && hasChildren && (
                  <button
                    type="button"
                    onClick={(e) => toggleCollapse(node.id, e)}
                    className="p-0.5 rounded hover:bg-white/10 text-[#7a92b8] hover:text-white shrink-0"
                    title={isCollapsed ? 'Expandir filhos' : 'Recolher filhos'}
                  >
                    {isCollapsed ? <ChevronRight className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                  </button>
                )}

                {isDir && !hasChildren && (
                  <ExternalLink className="w-3 h-3 text-[#3ba9ff] opacity-40 group-hover:opacity-100 shrink-0" />
                )}
              </div>
            );
          })}
        </div>

        {/* Floating Hint Overlay */}
        <div className="absolute bottom-3 left-3 bg-[#081224]/85 backdrop-blur-md px-3 py-1.5 rounded-xl border border-[#3ba9ff]/20 text-[10px] font-mono text-[#7a92b8] pointer-events-none flex items-center gap-2">
          <span>💡 <strong>Clique numa Pasta:</strong> Abre no File Browser</span>
          <span>•</span>
          <span><strong>Clique num Arquivo:</strong> Abre no Monaco Editor</span>
        </div>
      </div>
    </div>
  );
};
