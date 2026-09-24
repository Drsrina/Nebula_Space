import React, { useRef, useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion } from 'motion/react';
import {
  Minus,
  X,
  Maximize2,
  Layers,
  FileCode,
  FileText,
  Bookmark,
  Sparkles,
  Move,
  ChevronUp,
  ChevronDown,
  Eye,
  Split,
  GitBranch,
  Folder,
  Server,
  Search,
  Package,
  Terminal as TerminalIcon,
  Bot,
  Copy,
  ExternalLink,
  Workflow,
  Clock,
  Trello,
  FileImage,
  Globe,
  Zap,
  Code2,
  Unplug,
  Puzzle,
} from 'lucide-react';
import { DepthLevel, WindowData } from '../types';
import { DEPTH_CONFIGS } from '../lib/depth';
import { useWindowsStore } from '../store/useWindowsStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { detectSnap, WindowRect } from '../lib/snapManager';
import { FileTreeWindow } from './windows/FileTreeWindow';
import { FileBrowserWindow } from './windows/FileBrowserWindow';
import { FilePreviewWindow } from './windows/FilePreviewWindow';
import { EditorWindow } from './windows/EditorWindow';
import { NoteWindow } from './windows/NoteWindow';
import { LauncherWindow } from './windows/LauncherWindow';
import { SettingsWindow } from './windows/SettingsWindow';
import { TerminalWindow } from './windows/TerminalWindow';
import { LoginWindow } from './windows/LoginWindow';
import { WindowSkeleton } from './WindowSkeleton';
import { PopoutPortal } from './PopoutPortal';
import { SnapGuide } from './SnapGuide';

// ── Code-Splitting: Janelas Pesadas carregadas sob demanda via React.lazy ──────
const GitPanelWindow = React.lazy(() => import('./windows/GitPanelWindow').then(m => ({ default: m.GitPanelWindow })));
const DiffWindow = React.lazy(() => import('./windows/DiffWindow').then(m => ({ default: m.DiffWindow })));
const AiChatWindow = React.lazy(() => import('./windows/AiChatWindow').then(m => ({ default: m.AiChatWindow })));
const GlobalSearchWindow = React.lazy(() => import('./windows/GlobalSearchWindow').then(m => ({ default: m.GlobalSearchWindow })));
const TaskRunnerWindow = React.lazy(() => import('./windows/TaskRunnerWindow').then(m => ({ default: m.TaskRunnerWindow })));
const WorkflowWindow = React.lazy(() => import('./windows/WorkflowWindow').then(m => ({ default: m.WorkflowWindow })));
const CrontabWindow = React.lazy(() => import('./windows/CrontabWindow').then(m => ({ default: m.CrontabWindow })));
const KanbanWindow = React.lazy(() => import('./windows/KanbanWindow').then(m => ({ default: m.KanbanWindow })));
const PdfViewerWindow = React.lazy(() => import('./windows/PdfViewerWindow').then(m => ({ default: m.PdfViewerWindow })));
const WebEmbedWindow = React.lazy(() => import('./windows/WebEmbedWindow').then(m => ({ default: m.WebEmbedWindow })));
const ApiClientWindow = React.lazy(() => import('./windows/ApiClientWindow').then(m => ({ default: m.ApiClientWindow })));
const SnippetsWindow = React.lazy(() => import('./windows/SnippetsWindow').then(m => ({ default: m.SnippetsWindow })));
const LivePreviewSplitWindow = React.lazy(() => import('./windows/LivePreviewSplitWindow').then(m => ({ default: m.LivePreviewSplitWindow })));
const CodeSandboxWindow = React.lazy(() => import('./windows/CodeSandboxWindow').then(m => ({ default: m.CodeSandboxWindow })));
const PluginManagerWindow = React.lazy(() => import('./windows/PluginManagerWindow').then(m => ({ default: m.PluginManagerWindow })));

interface WindowProps {
  window: WindowData;
}

export const Window: React.FC<WindowProps> = ({ window: win }) => {
  const {
    bringToFront,
    closeWindow,
    toggleMinimizeWindow,
    updateWindowPosition,
    setWindowDepth,
    resizeWindow,
    activeWindowId,
    maximizeWindow,
    restoreWindow,
    openDuplicateWindow,
    snapWindows,
    unsnapWindow,
    moveSnapGroup,
    windows,
    markPopped,
  } = useWindowsStore();

  const {
    isFocusMode,
    currentDepthPlane,
    activeLayer,
    setActiveLayer,
    jumpToDepthPlane,
    camera,
    setIsDraggingWindow,
  } = useCanvasStore();

  const isActive = activeWindowId === win.id;
  const currentDepth: DepthLevel = (Number(win.depth) === 0 ? 0 : Number(win.depth) === 2 ? 2 : 1) as DepthLevel;
  const currentActiveLayer: DepthLevel = (Number(activeLayer) === 0 ? 0 : Number(activeLayer) === 2 ? 2 : 1) as DepthLevel;
  const depthConfig = DEPTH_CONFIGS[currentDepth] || DEPTH_CONFIGS[1];

  // Drag state
  const isDraggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  // Resize state
  const isResizingRef = useRef(false);
  const [isResizing, setIsResizing] = useState(false);

  // Snap guide state
  const [snapGuide, setSnapGuide] = useState<{ x1: number; y1: number; x2: number; y2: number } | null>(null);
  const pendingSnapRef = useRef<{ targetId: string; snapX: number; snapY: number } | null>(null);

  const [isHovered, setIsHovered] = useState(false);

  // Hidden in focus mode if not on Degrau 0
  const isHiddenByFocus = isFocusMode && currentDepth !== 0;

  // Move window step closer to focus (0) or deeper (2)
  const advanceDepth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentDepth > 0) {
      const target = (currentDepth - 1) as DepthLevel;
      setWindowDepth(win.id, target);
      setActiveLayer(target);
      bringToFront(win.id);
    }
  };

  const recedeDepth = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (currentDepth < 2) {
      const target = (currentDepth + 1) as DepthLevel;
      setWindowDepth(win.id, target);
      setActiveLayer(target);
      bringToFront(win.id);
    }
  };

  // Handle Dragging (with snap detection)
  const handlePointerDownHeader = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only left click
    if (e.button !== 0) return;

    e.stopPropagation();
    e.preventDefault();

    if (currentDepth !== currentActiveLayer) {
      setActiveLayer(currentDepth);
    }

    bringToFront(win.id);
    setIsDraggingWindow(true);
    setIsDragging(true);
    isDraggingRef.current = true;

    // If this window is part of a snap group, remember initial positions for group move
    const snapGroup = win.snapGroup;
    const storeSnap = useWindowsStore.getState;

    const targetElement = e.currentTarget;
    try {
      targetElement.setPointerCapture(e.pointerId);
    } catch {}

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWinX = win.x;
    const startWinY = win.y;
    let prevX = startWinX;
    let prevY = startWinY;

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingRef.current) return;
      ev.stopPropagation();
      ev.preventDefault();

      const curCam = useCanvasStore.getState().camera;
      const planeZ = curCam.z + depthConfig.z;
      const distance = Math.max(200, 3000 - planeZ);
      const zoomFactor = curCam.zoom || 1;
      const rawScale = (distance / 3000) / zoomFactor;
      // Limita a escala do movimento para evitar movimentos bruscos em zooms extremos (0.45 ou 2.2)
      const moveScale = Math.max(0.3, Math.min(2.5, rawScale));

      const dx = (ev.clientX - startMouseX) * moveScale;
      const dy = (ev.clientY - startMouseY) * moveScale;
      const newX = Math.round(startWinX + dx);
      const newY = Math.round(startWinY + dy);

      const ddx = newX - prevX;
      const ddy = newY - prevY;
      prevX = newX;
      prevY = newY;

      updateWindowPosition(win.id, newX, newY);

      // Move snap group members together
      if (snapGroup) {
        moveSnapGroup(snapGroup, ddx, ddy, win.id);
      }

      // Detect snap opportunity if snapping is globally enabled
      const { windows: allWindows, snapEnabled } = useWindowsStore.getState();
      if (snapEnabled) {
        const draggingRect: WindowRect = { id: win.id, x: newX, y: newY, width: win.width, height: win.height };
        const otherRects: WindowRect[] = allWindows
          .filter((w) => w.id !== win.id && !w.isMinimized)
          .map((w) => ({ id: w.id, x: w.x, y: w.y, width: w.width, height: w.height }));

        const snap = detectSnap(draggingRect, otherRects);
        if (snap) {
          setSnapGuide({ x1: snap.guideX1, y1: snap.guideY1, x2: snap.guideX2, y2: snap.guideY2 });
          pendingSnapRef.current = { targetId: snap.targetId, snapX: snap.snapX, snapY: snap.snapY };
        } else {
          setSnapGuide(null);
          pendingSnapRef.current = null;
        }
      } else {
        setSnapGuide(null);
        pendingSnapRef.current = null;
      }
    };

    const handleWheelDuringDrag = (ev: WheelEvent) => {
      if (!isDraggingRef.current) return;
      ev.preventDefault();
      ev.stopPropagation();
      const currentWin = useWindowsStore.getState().windows.find((w) => w.id === win.id);
      const curDepth = currentWin ? currentWin.depth : win.depth;
      if (ev.deltaY < -20 && curDepth > 0) {
        const nextDepth = (curDepth - 1) as DepthLevel;
        setWindowDepth(win.id, nextDepth);
        setActiveLayer(nextDepth);
      } else if (ev.deltaY > 20 && curDepth < 2) {
        const nextDepth = (curDepth + 1) as DepthLevel;
        setWindowDepth(win.id, nextDepth);
        setActiveLayer(nextDepth);
      }
    };

    const handlePointerCancel = (ev: PointerEvent) => {
      if (ev.buttons & 1) return;
      handlePointerUp(ev);
    };

    const handlePointerUp = (ev: PointerEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      isDraggingRef.current = false;
      setIsDragging(false);
      setIsDraggingWindow(false);
      setSnapGuide(null);

      // Commit snap if pending
      if (pendingSnapRef.current) {
        const { targetId, snapX, snapY } = pendingSnapRef.current;
        snapWindows(win.id, targetId, snapX, snapY);
        pendingSnapRef.current = null;
      }

      try {
        targetElement.releasePointerCapture(e.pointerId);
      } catch {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerCancel);
      window.removeEventListener('wheel', handleWheelDuringDrag);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerCancel);
    window.addEventListener('wheel', handleWheelDuringDrag, { passive: false });
  };

  // Handle Resizing (Supported across all 3 depth planes)
  const handlePointerDownResize = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.button !== 0) return;
    if (currentDepth < currentActiveLayer) return;
    e.stopPropagation();
    e.preventDefault();

    if (currentDepth !== currentActiveLayer) {
      setActiveLayer(currentDepth);
    }

    bringToFront(win.id);
    setIsDraggingWindow(true);
    setIsResizing(true);
    isResizingRef.current = true;

    const targetElement = e.currentTarget;
    try {
      targetElement.setPointerCapture(e.pointerId);
    } catch {}

    const startMouseX = e.clientX;
    const startMouseY = e.clientY;
    const startWidth = win.width;
    const startHeight = win.height;

    const planeZ = camera.z + depthConfig.z;
    const distance = Math.max(200, 3000 - planeZ);
    const zoomFactor = camera.zoom || 1;
    const moveScale = (distance / 3000) / zoomFactor;

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isResizingRef.current) return;
      ev.stopPropagation();
      ev.preventDefault();
      const dw = (ev.clientX - startMouseX) * moveScale;
      const dh = (ev.clientY - startMouseY) * moveScale;
      resizeWindow(
        win.id,
        Math.max(280, Math.round(startWidth + dw)),
        Math.max(180, Math.round(startHeight + dh))
      );
    };

    const handlePointerUp = (ev: PointerEvent) => {
      ev.stopPropagation();
      ev.preventDefault();
      isResizingRef.current = false;
      setIsResizing(false);
      setIsDraggingWindow(false);
      try {
        targetElement.releasePointerCapture(e.pointerId);
      } catch {}
      window.removeEventListener('pointermove', handlePointerMove);
      window.removeEventListener('pointerup', handlePointerUp);
      window.removeEventListener('pointercancel', handlePointerUp);
    };

    window.addEventListener('pointermove', handlePointerMove, { passive: false });
    window.addEventListener('pointerup', handlePointerUp);
    window.addEventListener('pointercancel', handlePointerUp);
  };

  // Window Type Icon
  const getWindowTypeIcon = () => {
    switch (win.type) {
      case 'file-tree':
      case 'file-browser':
        return <Folder className="w-4 h-4 text-[#3ba9ff]" />;
      case 'file-preview':
        return <FileText className="w-4 h-4 text-[#5eead4]" />;
      case 'editor':
        return <FileCode className="w-4 h-4 text-[#5eead4]" />;
      case 'git-panel':
        return <GitBranch className="w-4 h-4 text-[#ec4899]" />;
      case 'diff':
        return <Split className="w-4 h-4 text-[#3ba9ff]" />;
      case 'note':
        return <Bookmark className="w-4 h-4 text-[#6ea8ff]" />;
      case 'launcher':
        return <Sparkles className="w-4 h-4 text-[#3ba9ff]" />;
      case 'settings':
        return <Server className="w-4 h-4 text-[#5eead4]" />;
      case 'terminal':
        return <TerminalIcon className="w-4 h-4 text-[#a78bfa]" />;
      case 'ai-chat':
        return <Bot className="w-4 h-4 text-[#f59e0b]" />;
      case 'global-search':
        return <Search className="w-4 h-4 text-[#3ba9ff]" />;
      case 'task-runner':
        return <Package className="w-4 h-4 text-[#a78bfa]" />;
      case 'graph':
        return <Sparkles className="w-4 h-4 text-[#38bdf8]" />;
      case 'docker-monitor':
        return <Server className="w-4 h-4 text-[#6ee7b7]" />;
      case 'settings-global':
        return <Server className="w-4 h-4 text-[#7a92b8]" />;
      case 'login':
        return <Sparkles className="w-4 h-4 text-[#3ba9ff]" />;
      // ── v2.6 icons ─────────────────────────────────────────────────────
      case 'workflow':
        return <Workflow className="w-4 h-4 text-[#f97316]" />;
      case 'crontab':
        return <Clock className="w-4 h-4 text-[#a78bfa]" />;
      case 'kanban':
        return <Trello className="w-4 h-4 text-[#38bdf8]" />;
      case 'pdf-viewer':
        return <FileImage className="w-4 h-4 text-[#fb7185]" />;
      case 'web-embed':
        return <Globe className="w-4 h-4 text-[#34d399]" />;
      case 'api-client':
        return <Zap className="w-4 h-4 text-[#fbbf24]" />;
      case 'snippets':
        return <Code2 className="w-4 h-4 text-[#818cf8]" />;
      case 'live-preview':
        return <Split className="w-4 h-4 text-[#5eead4]" />;
      // ── v2.7 icons ─────────────────────────────────────────────────────
      case 'code-sandbox':
        return <Code2 className="w-4 h-4 text-[#38bdf8]" />;
      case 'plugin-manager':
        return <Puzzle className="w-4 h-4 text-[#a78bfa]" />;
      default:
        return <Layers className="w-4 h-4 text-[#7a92b8]" />;
    }
  };

  // Multi-instance types that support duplication
  const MULTI_INSTANCE_TYPES = new Set(['editor', 'terminal', 'file-browser', 'file-tree', 'note', 'workflow', 'kanban', 'web-embed', 'api-client', 'live-preview', 'code-sandbox']);
  const canDuplicate = MULTI_INSTANCE_TYPES.has(win.type);

  // Handle Pop-out — toggle detached external browser window
  const handlePopOut = (e: React.MouseEvent) => {
    e.stopPropagation();
    markPopped(win.id, !win.isPopped);
  };

  // Render Window Body
  const renderWindowContent = () => {
    if (win.isMinimized) {
      return null;
    }

    switch (win.type) {
      case 'file-tree':
      case 'file-browser':
        return <FileBrowserWindow />;
      case 'file-preview':
        return <FilePreviewWindow payload={win.payload as any} />;
      case 'editor':
        return <EditorWindow windowId={win.id} payload={win.payload as any} />;
      case 'git-panel':
        return <GitPanelWindow />;
      case 'diff':
        return <DiffWindow payload={win.payload as any} />;
      case 'note':
        return <NoteWindow windowId={win.id} payload={win.payload as any} />;
      case 'launcher':
        return <LauncherWindow />;
      case 'settings':
      case 'settings-global':
        return <SettingsWindow />;
      case 'terminal':
        return <TerminalWindow />;
      case 'ai-chat':
        return <AiChatWindow />;
      case 'global-search':
        return <GlobalSearchWindow />;
      case 'task-runner':
        return <TaskRunnerWindow />;
      case 'login':
        return <LoginWindow />;
      // ── v2.6 New Windows ─────────────────────────────────────────────────
      case 'workflow':
        return <WorkflowWindow />;
      case 'crontab':
        return <CrontabWindow />;
      case 'kanban':
        return <KanbanWindow />;
      case 'pdf-viewer':
        return <PdfViewerWindow payload={win.payload as any} />;
      case 'web-embed':
        return <WebEmbedWindow payload={win.payload as any} />;
      case 'api-client':
        return <ApiClientWindow />;
      case 'snippets':
        return <SnippetsWindow />;
      case 'live-preview':
        return <LivePreviewSplitWindow />;
      // ── v2.7 New Windows ─────────────────────────────────────────────────
      case 'code-sandbox':
        return <CodeSandboxWindow />;
      case 'plugin-manager':
        return <PluginManagerWindow />;
      default:
        return <div className="p-4 text-xs text-[#7a92b8]">Janela vazia.</div>;
    }
  };

  // =========================================================================
  // REGRAS DE VISIBILIDADE E OCLUSÃO POR CAMADA ATIVA (activeLayer)
  //
  // - activeLayer = 0:
  //     Degrau 0: opacity: 1.0, blur: 0px, pointer-events: auto, glow forte
  //     Degrau 1: opacity: 0.82, blur: 1.5px, pointer-events: auto, glow médio
  //     Degrau 2: opacity: 0.55, blur: 3px, pointer-events: auto, glow fraco
  //
  // - activeLayer = 1:
  //     Degrau 0: opacity: 0.15, blur: 6px, pointer-events: none (vidro fosco atenuado, não captura cliques)
  //     Degrau 1: opacity: 1.0, blur: 0px, pointer-events: auto, glow forte
  //     Degrau 2: opacity: 0.55, blur: 3px, pointer-events: auto, glow fraco
  //
  // - activeLayer = 2:
  //     Degrau 0: opacity: 0.08, blur: 8px, pointer-events: none
  //     Degrau 1: opacity: 0.20, blur: 4px, pointer-events: none
  //     Degrau 2: opacity: 1.0, blur: 0px, pointer-events: auto, glow forte
  const isCurrentPlane = currentDepth === currentActiveLayer;
  // Janelas à frente da camada ativa (em degraus menores que activeLayer) ficam ocluídas
  // com visual de vidro fosco translúcido sem bloquear cliques na camada ao fundo
  const isOccluded = currentDepth < currentActiveLayer;
  const pointerEventsValue: 'none' | 'auto' = isOccluded ? 'none' : 'auto';

  // =========================================================================
  // REGRAS DE VISIBILIDADE E OCLUSÃO POR CAMADA ATIVA (activeLayer)
  // =========================================================================
  const getOcclusionConfig = () => {
    if (isHiddenByFocus) {
      return {
        opacity: 0,
        blur: 8,
        scale: 0.7,
        pointerEvents: 'none' as const,
        glowBorder: 'border-transparent',
        shadow: 'none',
      };
    }

    // Janelas à frente da camada ativa (isOccluded = true):
    // Viram vidro fosco atenuado sem bloquear interação das camadas ao fundo
    if (isOccluded) {
      if (currentDepth === 0) {
        return {
          opacity: currentActiveLayer === 1 ? 0.12 : 0.08,
          blur: currentActiveLayer === 1 ? 6.0 : 8.0,
          scale: 1.02,
          pointerEvents: 'none' as const,
          glowBorder: 'border-[#3ba9ff]/10',
          shadow: 'none',
        };
      }
      // currentDepth === 1 (quando activeLayer === 2)
      return {
        opacity: 0.15,
        blur: 4.5,
        scale: 1.01,
        pointerEvents: 'none' as const,
        glowBorder: 'border-[#3ba9ff]/10',
        shadow: 'none',
      };
    }

    // Janelas no plano ativo (isCurrentPlane = true):
    // 100% nítidas, escala 1.0, glow de borda vibrante e totalmente interativas
    if (isCurrentPlane) {
      if (currentActiveLayer === 0) {
        return {
          opacity: 1.0,
          blur: 0,
          scale: 1.0,
          pointerEvents: 'auto' as const,
          glowBorder: isActive ? 'border-[#5eead4]/80' : 'border-[#3ba9ff]/50',
          shadow: isActive
            ? 'shadow-[0_0_50px_rgba(59,169,255,0.35),0_20px_40px_rgba(0,0,0,0.65)]'
            : 'shadow-[0_0_25px_rgba(59,169,255,0.20),0_10px_25px_rgba(0,0,0,0.45)]',
        };
      }
      if (currentActiveLayer === 1) {
        return {
          opacity: 1.0,
          blur: 0,
          scale: 1.0,
          pointerEvents: 'auto' as const,
          glowBorder: isActive ? 'border-[#5eead4]/90' : 'border-[#5eead4]/50',
          shadow: isActive
            ? 'shadow-[0_0_50px_rgba(94,234,212,0.40),0_20px_40px_rgba(0,0,0,0.65)]'
            : 'shadow-[0_0_28px_rgba(94,234,212,0.22),0_10px_25px_rgba(0,0,0,0.45)]',
        };
      }
      // currentActiveLayer === 2
      return {
        opacity: 1.0,
        blur: 0,
        scale: 1.0,
        pointerEvents: 'auto' as const,
        glowBorder: isActive ? 'border-[#6ea8ff]/90' : 'border-[#6ea8ff]/50',
        shadow: isActive
          ? 'shadow-[0_0_50px_rgba(110,168,255,0.40),0_20px_40px_rgba(0,0,0,0.65)]'
          : 'shadow-[0_0_28px_rgba(110,168,255,0.22),0_10px_25px_rgba(0,0,0,0.45)]',
      };
    }

    // Janelas em planos posteriores (currentDepth > currentActiveLayer):
    // Nítidas e interativas, com leve recuo de escala e opacidade para percepção de profundidade
    if (currentDepth === 1) {
      return {
        opacity: 0.88,
        blur: 0,
        scale: 0.94,
        pointerEvents: 'auto' as const,
        glowBorder: isActive ? 'border-[#5eead4]/90' : 'border-[#50b4ff]/30',
        shadow: isActive
          ? 'shadow-[0_0_40px_rgba(94,234,212,0.40),0_15px_30px_rgba(0,0,0,0.55)]'
          : 'shadow-[0_0_20px_rgba(59,169,255,0.15),0_10px_20px_rgba(0,0,0,0.4)]',
      };
    }

    // currentDepth === 2 (quando activeLayer < 2)
    return {
      opacity: 0.75,
      blur: 0,
      scale: 0.88,
      pointerEvents: 'auto' as const,
      glowBorder: isActive ? 'border-[#6ea8ff]/90' : 'border-[#6ea8ff]/25',
      shadow: isActive
        ? 'shadow-[0_0_35px_rgba(110,168,255,0.40),0_12px_25px_rgba(0,0,0,0.55)]'
        : 'shadow-[0_0_15px_rgba(110,168,255,0.10),0_8px_16px_rgba(0,0,0,0.4)]',
    };
  };

  const occlusion = getOcclusionConfig();

  // Ordem 2D e prioridade de empilhamento:
  // Janelas do plano ativo recebem prioridade máxima (+100) para garantir que fiquem acima de planos inativos
  const depthZBase = (2 - currentDepth) * 10;
  const computedZIndex = (isCurrentPlane ? 100 : 0) + depthZBase + (win.zIndex || 0) + (isActive ? 40 : 5);
  const handleClosePopout = useCallback(() => {
    markPopped(win.id, false);
  }, [win.id, markPopped]);

  const windowElement = (
    <motion.div
      id={win.id}
      data-window="true"
      data-window-id={win.id}
      data-occluded={isOccluded ? 'true' : 'false'}
      data-inert={isOccluded ? 'true' : 'false'}
      aria-hidden={isOccluded}
      tabIndex={isOccluded ? -1 : 0}
      initial={{ opacity: 0, scale: 0.85, z: depthConfig.z }}
      animate={
        win.isMaximized
          ? { x: 0, y: 0, z: 0, opacity: 1, scale: 1 }
          : {
              x: win.x,
              y: win.y,
              z: depthConfig.z,
              opacity: occlusion.opacity,
              scale: occlusion.scale,
            }
      }
      transition={
        isDragging || isResizing
          ? { duration: 0 }
          : { duration: 0.28, ease: [0.16, 1, 0.3, 1] }
      }
      onPointerDown={(e) => {
        if (isOccluded) return;
        e.stopPropagation(); // Fix 4: prevent canvas from treating this as a pan gesture
        if (win.depth !== activeLayer) {
          setActiveLayer(win.depth);
        }
        bringToFront(win.id);
      }}
      onWheel={(e) => {
        if (isCurrentPlane) e.stopPropagation();
      }}
      onMouseEnter={() => {
        if (isCurrentPlane) setIsHovered(true);
      }}
      onMouseLeave={() => {
        if (isCurrentPlane) setIsHovered(false);
      }}
      style={
        win.isMaximized
          ? {
              position: 'fixed',
              inset: 0,
              width: '100vw',
              height: '100vh',
              left: 0,
              top: 0,
              zIndex: 99999,
              pointerEvents: 'auto',
            }
          : {
              position: 'absolute',
              left: '50%',
              top: '50%',
              width: win.width,
              height: win.isMinimized ? 'auto' : win.height,
              zIndex: isOccluded ? 0 : computedZIndex,
              pointerEvents: isOccluded ? 'none' : 'auto',
            }
      }
      className={`window-container rounded-2xl flex flex-col overflow-hidden backdrop-blur-[20px] transition-shadow duration-300 border ${win.isMaximized ? 'border-[#3ba9ff]/40 rounded-none fixed inset-0 z-[99999]' : `${occlusion.glowBorder} ${occlusion.shadow}`} bg-[#0f192d]/95`}
    >
      <div className="relative z-10 flex flex-col h-full overflow-hidden">
        {/* Window Header */}
        <div
          onPointerDown={handlePointerDownHeader}
          onWheel={(e) => {
            if (isOccluded) return;
            e.stopPropagation();
            const currentWin = useWindowsStore.getState().windows.find((w) => w.id === win.id);
            const curDepth = currentWin ? currentWin.depth : win.depth;
            if (e.deltaY < -20 && curDepth > 0) {
              const nextDepth = (curDepth - 1) as DepthLevel;
              setWindowDepth(win.id, nextDepth);
              setActiveLayer(nextDepth);
              bringToFront(win.id);
            } else if (e.deltaY > 20 && curDepth < 2) {
              const nextDepth = (curDepth + 1) as DepthLevel;
              setWindowDepth(win.id, nextDepth);
              setActiveLayer(nextDepth);
              bringToFront(win.id);
            }
          }}
          className={`window-header flex items-center justify-between px-3.5 py-2.5 select-none cursor-grab active:cursor-grabbing border-b transition-colors ${
          isActive
            ? 'bg-[#142340]/90 border-[#3ba9ff]/30'
            : 'bg-[#0a1628]/75 border-[#3ba9ff]/15'
        }`}
          title="Arraste para mover (ou gire scroll do mouse no header para alternar Degraus Z)"
        >
        {/* Left: Window Icon + Title + Instance Badge + Snap Indicator */}
        <div className="flex items-center gap-2 overflow-hidden flex-1 mr-2">
          {getWindowTypeIcon()}
          <span className="text-xs font-medium text-[#e6f0ff] truncate font-mono">
            {win.title}
          </span>
          {win.instanceId && (
            <span className="shrink-0 text-[9px] font-mono px-1 py-0.5 rounded bg-[#3ba9ff]/15 text-[#3ba9ff] border border-[#3ba9ff]/25">
              {win.instanceId.split('-').pop()}
            </span>
          )}
          {win.snapGroup && (
            <button
              type="button"
              onPointerDown={(e) => e.stopPropagation()}
              onClick={(e) => {
                e.stopPropagation();
                unsnapWindow(win.id);
              }}
              className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-[#38bdf8]/20 hover:bg-[#ff5c7a]/25 text-[#38bdf8] hover:text-[#ff5c7a] border border-[#38bdf8]/40 hover:border-[#ff5c7a]/50 transition-all text-[9px] font-mono cursor-pointer shrink-0 ml-1"
              title="Clique para desencaixar/soltar esta janela do grupo colado"
            >
              <Unplug className="w-2.5 h-2.5" />
              <span>Desencaixar</span>
            </button>
          )}
        </div>

        {/* Center: 3-Depth Snap Selector (Degraus 0, 1, 2) */}
        <div
          className="flex items-center gap-1 bg-[#050810]/80 p-0.5 rounded-lg border border-[#3ba9ff]/25 shrink-0 mr-3"
          title="Mudar o Degrau desta janela (0 = Foco, 1 = Contexto, 2 = Arquivo)"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Step closer to focus (▲) */}
          <button
            type="button"
            disabled={currentDepth === 0}
            onClick={advanceDepth}
            className="w-4 h-4 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            title="Avançar Degrau (trazer mais perto do foco)"
          >
            <ChevronUp className="w-3 h-3" />
          </button>

          {([0, 1, 2] as DepthLevel[]).map((lvl) => {
            const isSelected = currentDepth === lvl;
            const labels = ['0:Foco', '1:Contexto', '2:Arquivo'];
            return (
              <button
                key={lvl}
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setWindowDepth(win.id, lvl);
                  setActiveLayer(lvl);
                  bringToFront(win.id);
                }}
                className={`px-1.5 py-0.5 text-[10px] font-mono rounded transition-all cursor-pointer ${
                  isSelected
                    ? lvl === 0
                      ? 'bg-[#3ba9ff] text-[#050810] font-bold shadow-[0_0_10px_rgba(59,169,255,0.6)]'
                      : lvl === 1
                      ? 'bg-[#5eead4] text-[#050810] font-bold shadow-[0_0_10px_rgba(94,234,212,0.5)]'
                      : 'bg-[#6ea8ff] text-[#050810] font-bold shadow-[0_0_10px_rgba(110,168,255,0.4)]'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15'
                }`}
                title={`Mover esta janela para Degrau ${lvl}: ${DEPTH_CONFIGS[lvl].name} (Z = ${DEPTH_CONFIGS[lvl].z}px)`}
              >
                {labels[lvl]}
              </button>
            );
          })}

          {/* Step deeper into background (▼) */}
          <button
            type="button"
            disabled={currentDepth === 2}
            onClick={recedeDepth}
            className="w-4 h-4 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#6ea8ff] hover:bg-[#3ba9ff]/20 disabled:opacity-20 disabled:cursor-not-allowed transition-all"
            title="Recuar Degrau (enviar para o fundo)"
          >
            <ChevronDown className="w-3 h-3" />
          </button>

          {/* Quick Camera / Layer Focus Button if on another plane */}
          {currentDepth !== currentActiveLayer && (
            <button
              type="button"
              onClick={() => setActiveLayer(currentDepth)}
              className="ml-1 p-0.5 rounded text-[#3ba9ff] hover:text-[#5eead4] hover:bg-[#3ba9ff]/20 transition-all"
              title={`Ativar camada e focar câmera neste plano (Degrau ${currentDepth})`}
            >
              <Eye className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Right: Window controls (Duplicate, Pop-out, Minimize, Maximize, Close) */}
        <div
          className="flex items-center gap-1.5 shrink-0"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Duplicate Window — only for multi-instance types */}
          {canDuplicate && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); openDuplicateWindow(win.id); }}
              className="w-5 h-5 flex items-center justify-center rounded-md text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#5eead4]/15 transition-all cursor-pointer"
              title="Duplicar janela (abrir nova instância do mesmo tipo)"
            >
              <Copy className="w-3 h-3" />
            </button>
          )}

          {/* Pop-out — open in browser tab */}
          <button
            type="button"
            onClick={handlePopOut}
            className={`w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer ${
              win.isPopped
                ? 'text-[#38bdf8] bg-[#38bdf8]/15'
                : 'text-[#7a92b8] hover:text-[#38bdf8] hover:bg-[#38bdf8]/15'
            }`}
            title={win.isPopped ? 'Janela pop-out ativa (clique para trazer de volta)' : 'Destacar em nova aba (Pop-out)'}
          >
            <ExternalLink className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => toggleMinimizeWindow(win.id)}
            className="w-5 h-5 flex items-center justify-center rounded-md text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/20 transition-all cursor-pointer"
            title={win.isMinimized ? 'Expandir' : 'Minimizar'}
          >
            {win.isMinimized ? <Maximize2 className="w-3 h-3" /> : <Minus className="w-3 h-3" />}
          </button>

          {/* Maximize / Restore toggle */}
          <button
            type="button"
            onClick={() => win.isMaximized ? restoreWindow(win.id) : maximizeWindow(win.id)}
            className={`w-5 h-5 flex items-center justify-center rounded-md transition-all cursor-pointer ${
              win.isMaximized
                ? 'text-[#5eead4] hover:text-[#e6f0ff] hover:bg-[#5eead4]/20'
                : 'text-[#7a92b8] hover:text-[#6ea8ff] hover:bg-[#3ba9ff]/20'
            }`}
            title={win.isMaximized ? 'Restaurar tamanho' : 'Maximizar (tela inteira)'}
          >
            <Maximize2 className="w-3 h-3" />
          </button>

          <button
            type="button"
            onClick={() => closeWindow(win.id)}
            className="w-5 h-5 flex items-center justify-center rounded-md text-[#7a92b8] hover:text-[#ff5c7a] hover:bg-[#ff5c7a]/20 transition-all cursor-pointer"
            title="Fechar janela"
          >
            <X className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Window Body */}
      {!win.isMinimized && (
        <div
          className="window-body flex-1 relative overflow-hidden flex flex-col"
          style={{ pointerEvents: isOccluded ? 'none' : 'auto' }}
          onPointerDown={() => {
            if (isOccluded) return;
            if (currentDepth !== currentActiveLayer) {
              setActiveLayer(currentDepth);
            }
            bringToFront(win.id);
          }}
        >
          {win.isPopped ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center bg-[#071020]/90 select-none">
              <ExternalLink className="w-8 h-8 text-[#38bdf8] mb-2 animate-bounce" />
              <h4 className="text-sm font-bold text-[#e6f0ff] mb-1 font-mono">Janela Destacada (Pop-out)</h4>
              <p className="text-xs text-[#7a92b8] max-w-xs mb-4">
                Esta janela está ativa em uma aba/janela externa do navegador sincronizada em tempo real.
              </p>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  markPopped(win.id, false);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40 hover:bg-[#3ba9ff]/30 text-xs font-mono font-bold transition-all cursor-pointer"
              >
                Trazer de Volta ao Canvas
              </button>
            </div>
          ) : (
            <React.Suspense fallback={<WindowSkeleton />}>
              {renderWindowContent()}
            </React.Suspense>
          )}
        </div>
      )}

      {/* Resize Handle at Bottom Right */}
      {!win.isMinimized && !win.isPopped && (
        <div
          onPointerDown={handlePointerDownResize}
          className="absolute bottom-0 right-0 w-6 h-6 cursor-se-resize flex items-end justify-end p-1.5 text-[#3ba9ff]/40 hover:text-[#5eead4] transition-colors z-20"
          title="Redimensionar janela"
        >
          <svg viewBox="0 0 6 6" className="w-2.5 h-2.5 fill-current">
            <circle cx="5" cy="5" r="0.8" />
            <circle cx="5" cy="2.5" r="0.8" />
            <circle cx="2.5" cy="5" r="0.8" />
          </svg>
        </div>
      )}
      </div>

      {/* Pop-out External Window Portal */}
      {win.isPopped && (
        <PopoutPortal
          windowId={win.id}
          title={win.title}
          onClose={handleClosePopout}
        >
          <div className="flex-1 flex flex-col h-full w-full bg-[#050d1a] overflow-hidden">
            <React.Suspense fallback={<WindowSkeleton />}>
              {renderWindowContent()}
            </React.Suspense>
          </div>
        </PopoutPortal>
      )}

      {/* Magnetic Snap Guide Line Overlay */}
      {snapGuide && (
        <SnapGuide
          x1={snapGuide.x1}
          y1={snapGuide.y1}
          x2={snapGuide.x2}
          y2={snapGuide.y2}
          canvasTransform=""
        />
      )}
    </motion.div>
  );

  if (win.isMaximized) {
    return createPortal(windowElement, document.body);
  }

  return windowElement;
};
