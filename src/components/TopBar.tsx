import React, { useEffect } from 'react';
import {
  Plus,
  RotateCcw,
  Layers,
  Sparkles,
  HardDrive,
  CheckCircle,
  FileCode,
  GitBranch,
  Server,
  Settings,
  Folder,
  FolderOpen,
  Terminal,
  Bot,
  Search,
  Package,
  Pin,
  Maximize2,
  Network,
  GitGraph,
  LayoutGrid,
  Workflow,
  Clock,
  Trello,
  Zap,
  Code2,
  Globe,
  Split,
  FileImage,
  LogOut,
  Download,
  Upload,
} from 'lucide-react';
import { useFSStore } from '../store/useFSStore';
import { useWindowsStore } from '../store/useWindowsStore';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../lib/workspaceBackup';
import { useCanvasStore } from '../store/useCanvasStore';
import { usePaletteStore } from '../store/usePaletteStore';
import { useLayoutPresetsStore } from '../store/useLayoutPresetsStore';
import { DepthLevel } from '../types';
import { HubDropdown } from './HubDropdown';
import { clearAuthToken } from '../lib/api';

import { WindowType } from '../types';

// ── helpers ─────────────────────────────────────────────────────────────────
function openOrCreate(type: WindowType, forcedDepth?: DepthLevel) {
  const { windows, bringToFront, openWindow, updateWindowPosition, setWindowDepth } = useWindowsStore.getState();
  const { currentDepthPlane, camera } = useCanvasStore.getState();
  const depth = forcedDepth !== undefined ? forcedDepth : currentDepthPlane;
  const existing = windows.find((w) => w.type === type);
  if (existing) {
    setWindowDepth(existing.id, depth);
    updateWindowPosition(
      existing.id,
      Math.round(-camera.x - existing.width / 2),
      Math.round(-camera.y - existing.height / 2 + 28)
    );
    bringToFront(existing.id);
  } else {
    openWindow(type, {}, depth);
  }
}

export const TopBar: React.FC = () => {
  const {
    mode,
    directoryName,
    currentPath,
    totalFiles,
    isUsingMock,
    isLoading,
    openDirectoryPicker,
  } = useFSStore();

  const { createNote, resetLayout, openWindow } = useWindowsStore();
  const backupInputRef = React.useRef<HTMLInputElement>(null);

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const res = await importWorkspaceBackup(text);
      alert(res.message);
    } catch (err: any) {
      alert(`Erro ao importar workspace: ${err?.message || 'Arquivo inválido'}`);
    } finally {
      if (backupInputRef.current) backupInputRef.current.value = '';
    }
  };

  const {
    isFocusMode,
    toggleFocusMode,
    currentDepthPlane,
    jumpToDepthPlane,
  } = useCanvasStore();

  // ── Window opener helpers ─────────────────────────────────────────────────
  const open = (type: WindowType, depth?: DepthLevel) =>
    openOrCreate(type, depth);

  const handleLogout = () => {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('nebula_logout'));
  };

  // ── Keyboard shortcuts ────────────────────────────────────────────────────
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      // Ctrl+Shift+P → Command Palette (Comandos e Ações)
      if (modKey && e.key.toLowerCase() === 'p' && e.shiftKey) {
        e.preventDefault();
        usePaletteStore.getState().openPalette('commands');
      }
      // Ctrl+P → Quick Open / Busca de Arquivos
      else if (modKey && e.key.toLowerCase() === 'p' && !e.shiftKey) {
        e.preventDefault();
        usePaletteStore.getState().openPalette('files');
      }
      // Ctrl+Shift+F → Busca Global
      else if (modKey && e.shiftKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        open('global-search', 1);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [jumpToDepthPlane]);

  // ── Hub Dropdown item lists ───────────────────────────────────────────────
  const toolsItems = [
    {
      id: 'ai',
      label: 'AI Chat',
      icon: <Bot className="w-4 h-4 text-[#f59e0b]" />,
      shortcut: '',
      onClick: () => open('ai-chat'),
    },
    {
      id: 'editor',
      label: 'Editor de Código',
      icon: <FileCode className="w-4 h-4 text-[#5eead4]" />,
      shortcut: '',
      onClick: () => open('editor'),
    },
    {
      id: 'git',
      label: 'Git & Versionamento',
      icon: <GitBranch className="w-4 h-4 text-[#ec4899]" />,
      shortcut: '',
      onClick: () => open('git-panel'),
    },
    {
      id: 'terminal',
      label: 'Terminal',
      icon: <Terminal className="w-4 h-4 text-[#a78bfa]" />,
      shortcut: '',
      onClick: () => open('terminal'),
    },
    {
      id: 'workflow',
      label: 'Mini-n8n Workflows',
      icon: <Workflow className="w-4 h-4 text-[#f97316]" />,
      onClick: () => open('workflow'),
    },
    {
      id: 'crontab',
      label: 'Crontab Agendador',
      icon: <Clock className="w-4 h-4 text-[#a78bfa]" />,
      onClick: () => open('crontab'),
    },
    {
      id: 'kanban',
      label: 'Kanban Board',
      icon: <Trello className="w-4 h-4 text-[#38bdf8]" />,
      onClick: () => open('kanban'),
    },
    {
      id: 'api-client',
      label: 'API Client (Postman)',
      icon: <Zap className="w-4 h-4 text-[#fbbf24]" />,
      onClick: () => open('api-client'),
    },
    {
      id: 'snippets',
      label: 'Snippets de Código',
      icon: <Code2 className="w-4 h-4 text-[#818cf8]" />,
      onClick: () => open('snippets'),
    },
    {
      id: 'live-preview',
      label: 'Live Preview Split',
      icon: <Split className="w-4 h-4 text-[#5eead4]" />,
      onClick: () => open('live-preview'),
    },
    {
      id: 'web-embed',
      label: 'Navegador Web Embed',
      icon: <Globe className="w-4 h-4 text-[#34d399]" />,
      onClick: () => open('web-embed'),
    },
    {
      id: 'graph',
      label: 'Graph',
      icon: <GitGraph className="w-4 h-4 text-[#38bdf8]" />,
      separator: true,
      onClick: () => open('graph'),
    },
    {
      id: 'docker',
      label: 'Docker Monitor',
      icon: <Network className="w-4 h-4 text-[#6ee7b7]" />,
      onClick: () => open('docker-monitor'),
    },
  ];

  const arquivosItems = [
    {
      id: 'filebrowser',
      label: 'Arquivos do Workspace',
      icon: <Folder className="w-4 h-4 text-[#3ba9ff]" />,
      onClick: () => open('file-browser'),
    },
    {
      id: 'localfolder',
      label: 'Abrir Pasta Local',
      icon: <FolderOpen className="w-4 h-4 text-[#7a92b8]" />,
      onClick: () => openDirectoryPicker(),
    },
    {
      id: 'search',
      label: 'Busca Global',
      icon: <Search className="w-4 h-4 text-[#38bdf8]" />,
      shortcut: '⌃⇧F',
      separator: true,
      onClick: () => open('global-search'),
    },
    {
      id: 'tasks',
      label: 'Task Runner (Scripts)',
      icon: <Package className="w-4 h-4 text-[#a78bfa]" />,
      onClick: () => open('task-runner'),
    },
  ];

  const acoesItems = [
    {
      id: 'launcher',
      label: 'Command Palette',
      icon: <Sparkles className="w-4 h-4 text-[#fbbf24]" />,
      shortcut: '⌃P',
      onClick: () => usePaletteStore.getState().openPalette('files'),
    },
    {
      id: 'newnote',
      label: 'Nova Nota',
      icon: <Plus className="w-4 h-4 text-[#5eead4]" />,
      separator: true,
      onClick: () => createNote(),
    },
    {
      id: 'settings',
      label: 'Configurações',
      icon: <Settings className="w-4 h-4 text-[#7a92b8]" />,
      onClick: () => open('settings-global'),
    },
    {
      id: 'export-backup',
      label: 'Exportar Workspace (.nebula.json)',
      icon: <Download className="w-4 h-4 text-[#3ba9ff]" />,
      onClick: () => exportWorkspaceBackup(),
    },
    {
      id: 'import-backup',
      label: 'Importar Workspace (.nebula.json)',
      icon: <Upload className="w-4 h-4 text-[#5eead4]" />,
      onClick: () => backupInputRef.current?.click(),
    },
    {
      id: 'reset',
      label: 'Resetar Layout',
      icon: <RotateCcw className="w-4 h-4 text-[#7a92b8]" />,
      separator: true,
      onClick: () => {
        resetLayout();
        useCanvasStore.getState().resetCamera();
      },
    },
    {
      id: 'logout',
      label: 'Fazer Logout',
      icon: <LogOut className="w-4 h-4 text-[#ff5c7a]" />,
      onClick: handleLogout,
    },
  ];

  const { presets, applyPreset, saveCurrentAsPreset } = useLayoutPresetsStore();

  const handleSavePreset = () => {
    const name = window.prompt('Nome para o novo Layout Preset:', 'Meu Setup');
    if (!name || !name.trim()) return;
    saveCurrentAsPreset(name);
  };

  const layoutItems = [
    ...presets.map((p) => ({
      id: p.id,
      label: p.name,
      icon: <Layers className="w-4 h-4 text-[#a78bfa]" />,
      onClick: () => applyPreset(p.id),
    })),
    {
      id: 'save-layout',
      label: 'Salvar Layout Atual...',
      icon: <Plus className="w-4 h-4 text-[#5eead4]" />,
      separator: true,
      onClick: handleSavePreset,
    },
  ];

  return (
    <header className="absolute top-4 left-4 right-4 z-50 pointer-events-none flex items-center justify-between gap-3">
      <input
        ref={backupInputRef}
        type="file"
        accept=".json,.nebula.json"
        onChange={handleImportBackup}
        className="hidden"
      />

      {/* Left: Brand + Folder Info */}
      <div className="flex items-center gap-2.5 pointer-events-auto flex-shrink-0">
        {/* Logo */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f192d]/80 backdrop-blur-[20px] border border-[#50b4ff]/20 shadow-[0_0_30px_rgba(59,169,255,0.1)]">
          <div className="w-5 h-5 rounded-md bg-gradient-to-tr from-[#3ba9ff] to-[#5eead4] flex items-center justify-center shadow-[0_0_12px_rgba(94,234,212,0.4)] flex-shrink-0">
            <span className="w-1.5 h-1.5 rounded-full bg-[#050810]" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-sm font-bold tracking-widest text-[#e6f0ff] uppercase">Nebula</span>
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#3ba9ff]/15 text-[#3ba9ff] border border-[#3ba9ff]/25">
              v2.7.7
            </span>
          </div>
        </div>

        {/* Folder badge */}
        <div className="hidden md:flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0f192d]/65 backdrop-blur-[20px] border border-[#50b4ff]/15 text-xs max-w-[280px]">
          {mode === 'remote' ? (
            <Server className="w-3.5 h-3.5 text-[#5eead4] flex-shrink-0" />
          ) : (
            <HardDrive className={`w-3.5 h-3.5 flex-shrink-0 ${isUsingMock ? 'text-[#6ea8ff]' : 'text-[#5eead4]'}`} />
          )}
          <span className="font-mono text-[#e6f0ff] truncate" title={currentPath || directoryName}>
            {currentPath || directoryName}
          </span>
          <div className="w-px h-3 bg-[#3ba9ff]/20 flex-shrink-0" />
          <span className="font-mono text-[#7a92b8] flex-shrink-0">
            {isLoading ? 'Lendo...' : `${totalFiles} itens`}
          </span>
          {mode === 'remote' ? (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25 flex items-center gap-1 flex-shrink-0">
              <CheckCircle className="w-2.5 h-2.5" />VPS
            </span>
          ) : isUsingMock ? (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#6ea8ff]/15 text-[#93c5fd] border border-[#6ea8ff]/20 flex-shrink-0">
              Demo
            </span>
          ) : (
            <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/25 flex items-center gap-1 flex-shrink-0">
              <CheckCircle className="w-2.5 h-2.5" />Nativo
            </span>
          )}
        </div>
      </div>

      {/* Center: Cognitive 3-Depth Navigator */}
      <div className="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#0f192d]/75 backdrop-blur-[20px] border border-[#50b4ff]/20 text-[11px] font-mono pointer-events-auto flex-shrink-0">
        <span className="text-[#7a92b8] mr-1 text-[10px]">Câmera Z:</span>
        <div className="flex items-center gap-1">
          {([0, 1, 2] as DepthLevel[]).map((lvl) => {
            const isCurrent = currentDepthPlane === lvl;
            const labels = ['0: Foco (0px)', '1: Contexto (-400px)', '2: Arquivo (-700px)'];
            return (
              <button
                key={lvl}
                type="button"
                onClick={() => jumpToDepthPlane(lvl)}
                className={`px-2 py-0.5 rounded transition-all cursor-pointer font-medium ${
                  isCurrent
                    ? lvl === 0
                      ? 'bg-[#3ba9ff] text-[#050810] font-bold shadow-[0_0_10px_rgba(59,169,255,0.6)]'
                      : lvl === 1
                      ? 'bg-[#5eead4] text-[#050810] font-bold shadow-[0_0_10px_rgba(94,234,212,0.6)]'
                      : 'bg-[#6ea8ff] text-[#050810] font-bold shadow-[0_0_10px_rgba(110,168,255,0.6)]'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15'
                }`}
                title={`Navegar câmera para ${labels[lvl]}`}
              >
                {labels[lvl]}
              </button>
            );
          })}
        </div>
      </div>

      {/* Right: Hub Fixo — 3 dropdowns + mode toggles */}
      <div className="flex items-center gap-1.5 pointer-events-auto flex-shrink-0">

        {/* ── Dropdown: Tools ─────────────────────────────── */}
        <HubDropdown
          label="Tools"
          icon={<FileCode className="w-4 h-4" />}
          items={toolsItems}
          color="#5eead4"
          glowColor="rgba(94,234,212,0.15)"
        />

        {/* ── Dropdown: Arquivos ───────────────────────────── */}
        <HubDropdown
          label="Arquivos"
          icon={<Folder className="w-4 h-4" />}
          items={arquivosItems}
          color="#3ba9ff"
          glowColor="rgba(59,169,255,0.15)"
        />

        {/* ── Dropdown: Ações ──────────────────────────────── */}
        <HubDropdown
          label="Ações"
          icon={<Sparkles className="w-4 h-4" />}
          items={acoesItems}
          color="#fbbf24"
          glowColor="rgba(251,191,36,0.15)"
        />

        {/* ── Dropdown: Layouts Presets ─────────────────────── */}
        <HubDropdown
          label="Layouts"
          icon={<Layers className="w-4 h-4" />}
          items={layoutItems}
          color="#a78bfa"
          glowColor="rgba(167,139,250,0.15)"
        />

        {/* ── Divider ─────────────────────────────────────── */}
        <div className="w-px h-5 bg-[#50b4ff]/15 mx-0.5" />

        {/* ── Modo Foco ───────────────────────────────────── */}
        <button
          type="button"
          onClick={toggleFocusMode}
          title="Modo Foco: esconde degraus 1 e 2 para máxima concentração"
          className={`flex items-center gap-1.5 px-3 py-2 rounded-xl backdrop-blur-[20px] text-xs font-medium transition-all cursor-pointer border ${
            isFocusMode
              ? 'bg-[#3ba9ff]/20 border-[#5eead4] text-[#5eead4] shadow-[0_0_16px_rgba(94,234,212,0.3)]'
              : 'bg-[#0f192d]/75 border-[#50b4ff]/25 text-[#7a92b8] hover:text-[#e6f0ff] hover:border-[#3ba9ff]'
          }`}
        >
          <Layers className="w-4 h-4" />
          <span className="hidden sm:inline">{isFocusMode ? 'Foco Ativo' : 'Foco'}</span>
        </button>

        {/* ── Logout ────────────────────────────────────────── */}
        <button
          type="button"
          onClick={handleLogout}
          title="Fazer Logout e abrir tela de Login"
          className="flex items-center gap-1.5 px-2.5 py-2 rounded-xl backdrop-blur-[20px] text-xs font-medium transition-all cursor-pointer border bg-[#0f192d]/75 border-[#ff5c7a]/25 text-[#ff5c7a]/80 hover:text-[#ff5c7a] hover:border-[#ff5c7a] hover:bg-[#ff5c7a]/10"
        >
          <LogOut className="w-4 h-4" />
          <span className="hidden sm:inline">Logout</span>
        </button>

        {/* ── Pin (fixar janela) ──────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            const { activeWindowId, pinWindow, unpinWindow, windows } = useWindowsStore.getState();
            if (!activeWindowId) return;
            const win = windows.find(w => w.id === activeWindowId);
            if (win?.isPinned) unpinWindow(activeWindowId);
            else if (activeWindowId) pinWindow(activeWindowId);
          }}
          title="Fixar janela ativa no Hub (janela segue a câmera)"
          className="p-2 rounded-xl bg-[#0f192d]/75 backdrop-blur-[20px] border border-[#50b4ff]/25 hover:border-[#5eead4] text-[#7a92b8] hover:text-[#5eead4] transition-all cursor-pointer"
        >
          <Pin className="w-4 h-4" />
        </button>

        {/* ── Maximizar janela ──────────────────────────────── */}
        <button
          type="button"
          onClick={() => {
            const { activeWindowId, maximizeWindow, restoreWindow, windows } = useWindowsStore.getState();
            if (!activeWindowId) return;
            const win = windows.find(w => w.id === activeWindowId);
            if (win?.isMaximized) restoreWindow(activeWindowId);
            else if (activeWindowId) maximizeWindow(activeWindowId);
          }}
          title="Maximizar / Restaurar janela ativa (tela inteira)"
          className="p-2 rounded-xl bg-[#0f192d]/75 backdrop-blur-[20px] border border-[#50b4ff]/25 hover:border-[#6ea8ff] text-[#7a92b8] hover:text-[#6ea8ff] transition-all cursor-pointer"
        >
          <Maximize2 className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
