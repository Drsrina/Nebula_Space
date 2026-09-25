import React, { useState, useEffect } from 'react';
import {
  FilePlus,
  FolderOpen,
  Sparkles,
  Archive,
  Folder,
  Search,
  FileCode,
  ArrowRight,
  Terminal,
  Bot,
  Command,
  GitBranch,
  Package,
  RotateCcw,
  Layers,
  LayoutGrid,
  Pin,
  Network,
  GitGraph,
  Settings,
  X,
  Code2,
  Puzzle,
} from 'lucide-react';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useFSStore } from '../../store/useFSStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useEditorStore } from '../../store/useEditorStore';
import { DepthLevel } from '../../types';

type Tab = 'files' | 'actions' | 'windows';

const WINDOW_TYPE_ICONS: Record<string, React.ReactNode> = {
  editor: <FileCode className="w-3.5 h-3.5 text-[#5eead4]" />,
  'git-panel': <GitBranch className="w-3.5 h-3.5 text-[#ec4899]" />,
  terminal: <Terminal className="w-3.5 h-3.5 text-[#a78bfa]" />,
  'ai-chat': <Bot className="w-3.5 h-3.5 text-[#f59e0b]" />,
  'global-search': <Search className="w-3.5 h-3.5 text-[#38bdf8]" />,
  'task-runner': <Package className="w-3.5 h-3.5 text-[#a78bfa]" />,
  'file-tree': <Folder className="w-3.5 h-3.5 text-[#3ba9ff]" />,
  'file-browser': <Folder className="w-3.5 h-3.5 text-[#3ba9ff]" />,
  graph: <GitGraph className="w-3.5 h-3.5 text-[#38bdf8]" />,
  'docker-monitor': <Network className="w-3.5 h-3.5 text-[#6ee7b7]" />,
  'settings-global': <Settings className="w-3.5 h-3.5 text-[#7a92b8]" />,
  note: <FilePlus className="w-3.5 h-3.5 text-[#6ea8ff]" />,
};

const DEPTH_LABELS = ['Foco (D0)', 'Contexto (D1)', 'Arquivo (D2)'];
const DEPTH_COLORS = ['text-[#3ba9ff]', 'text-[#5eead4]', 'text-[#6ea8ff]'];

export const LauncherWindow: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [searchResults, setSearchResults] = useState<any[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>('files');
  const [selectedIdx, setSelectedIdx] = useState(0);

  const { openWindow, createNote, bringToFront, windows, closeWindow, setWindowDepth } = useWindowsStore();
  const { openDirectoryPicker } = useFSStore();
  const { jumpToDepthPlane, toggleFocusMode, isFocusMode, toggleZMode, isZToggleMode, resetCamera } = useCanvasStore();
  const { openFileInEditor } = useEditorStore();

  // Auto-switch to files tab when user types + reset selection
  useEffect(() => {
    if (searchTerm.trim()) { setActiveTab('files'); setSelectedIdx(0); }
  }, [searchTerm]);

  useEffect(() => {
    if (!searchTerm.trim()) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/fs/search?q=${encodeURIComponent(searchTerm.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults((data.results || []).slice(0, 20));
        }
      } catch (err) {
        console.error('Quick search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleOpenFile = async (item: any) => {
    const { camera, currentDepthPlane } = useCanvasStore.getState();
    if (item.isDir) {
      openWindow('file-browser', { initialPath: item.path }, currentDepthPlane);
      return;
    }

    try {
      const res = await useFSStore.getState().getFileContent({ path: item.path, name: item.name });
      openFileInEditor({
        path: item.path,
        name: item.name,
        content: res.content || '',
      });

      const editorWin = useWindowsStore.getState().windows.find((w) => w.type === 'editor');
      if (editorWin) {
        setWindowDepth(editorWin.id, currentDepthPlane);
        useWindowsStore.getState().updateWindowPosition(
          editorWin.id,
          Math.round(-camera.x - editorWin.width / 2),
          Math.round(-camera.y - editorWin.height / 2 + 28)
        );
        bringToFront(editorWin.id);
      }
    } catch (err) {
      console.warn('Could not open file from quick open:', err);
    }
  };

  const openOrCreate = (type: Parameters<typeof openWindow>[0]) => {
    const { currentDepthPlane, camera } = useCanvasStore.getState();
    const existing = windows.find(w => w.type === type);
    if (existing) {
      setWindowDepth(existing.id, currentDepthPlane);
      useWindowsStore.getState().updateWindowPosition(
        existing.id,
        Math.round(-camera.x - existing.width / 2),
        Math.round(-camera.y - existing.height / 2 + 28)
      );
      bringToFront(existing.id);
    } else {
      openWindow(type, {}, currentDepthPlane);
    }
  };

  const ACTIONS = [
    { label: 'Nova Nota', icon: <FilePlus className="w-4 h-4 text-[#3ba9ff]" />, shortcut: '', onClick: () => createNote() },
    { label: 'Abrir AI Chat', icon: <Bot className="w-4 h-4 text-[#f59e0b]" />, onClick: () => openOrCreate('ai-chat') },
    { label: 'Abrir Editor', icon: <FileCode className="w-4 h-4 text-[#5eead4]" />, onClick: () => openOrCreate('editor') },
    { label: 'Abrir Terminal', icon: <Terminal className="w-4 h-4 text-[#a78bfa]" />, onClick: () => openOrCreate('terminal') },
    { label: 'Abrir Git & Versionamento', icon: <GitBranch className="w-4 h-4 text-[#ec4899]" />, onClick: () => openOrCreate('git-panel') },
    { label: 'Busca Global', icon: <Search className="w-4 h-4 text-[#38bdf8]" />, shortcut: '⌃⇧F', onClick: () => openOrCreate('global-search') },
    { label: 'Task Runner', icon: <Package className="w-4 h-4 text-[#a78bfa]" />, onClick: () => openOrCreate('task-runner') },
    { label: 'Code Sandbox (Python & JS)', icon: <Code2 className="w-4 h-4 text-[#38bdf8]" />, onClick: () => openOrCreate('code-sandbox') },
    { label: 'Plugin Manager', icon: <Puzzle className="w-4 h-4 text-[#a78bfa]" />, onClick: () => openOrCreate('plugin-manager') },
    { label: 'Graph', icon: <GitGraph className="w-4 h-4 text-[#38bdf8]" />, onClick: () => openOrCreate('graph') },
    { label: 'Docker Monitor', icon: <Network className="w-4 h-4 text-[#6ee7b7]" />, onClick: () => openOrCreate('docker-monitor') },
    { label: 'Abrir Pasta Local', icon: <FolderOpen className="w-4 h-4 text-[#5eead4]" />, onClick: () => openDirectoryPicker() },
    { label: isFocusMode ? 'Desativar Modo Foco' : 'Ativar Modo Foco', icon: <Layers className="w-4 h-4 text-[#5eead4]" />, onClick: toggleFocusMode },
    { label: 'Resetar Layout', icon: <RotateCcw className="w-4 h-4 text-[#7a92b8]" />, onClick: () => { useWindowsStore.getState().resetLayout(); resetCamera(); } },
    { label: 'Configurações Globais', icon: <Settings className="w-4 h-4 text-[#7a92b8]" />, onClick: () => openOrCreate('settings-global') },
  ];

  const openWindows = windows.filter(w => !w.isMinimized && w.type !== 'launcher');

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/95 text-[#e6f0ff] overflow-hidden font-mono text-xs select-none">
      {/* Search Input */}
      <div className="p-3 pb-0 shrink-0">
        <div className="relative">
          <Search className="w-4 h-4 text-[#3ba9ff] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onKeyDown={(e) => {
              if (!searchResults.length) return;
              if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx((i) => Math.min(i + 1, searchResults.length - 1)); }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx((i) => Math.max(i - 1, 0)); }
              else if (e.key === 'Enter') { e.preventDefault(); if (searchResults[selectedIdx]) handleOpenFile(searchResults[selectedIdx]); }
            }}
            placeholder="Buscar arquivo... (Ctrl+P)"
            className="w-full pl-9 pr-8 py-2.5 rounded-xl bg-[#050914] border border-[#3ba9ff]/30 focus:border-[#5eead4] text-[#e6f0ff] placeholder-[#506c94] text-xs outline-none shadow-[0_0_20px_rgba(59,169,255,0.1)] transition-all"
            autoFocus
          />
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[10px] text-[#506c94] bg-[#091325] px-1.5 py-0.5 rounded border border-[#162744]">
            <Command className="w-2.5 h-2.5" />
            <span>P</span>
          </div>
        </div>
      </div>

      {/* Tabs — shown only when not searching */}
      {!searchTerm.trim() && (
        <div className="flex items-center gap-1 px-3 pt-2.5 pb-0 shrink-0">
          {(['files', 'actions', 'windows'] as Tab[]).map((tab) => {
            const labels: Record<Tab, string> = { files: '📂 Arquivos', actions: '⚡ Ações', windows: `🪟 Janelas (${openWindows.length})` };
            return (
              <button
                key={tab}
                type="button"
                onClick={() => setActiveTab(tab)}
                className={`px-2.5 py-1 rounded-lg text-[11px] transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-[#3ba9ff]/20 text-[#5eead4] border border-[#3ba9ff]/40'
                    : 'text-[#7a92b8] hover:text-[#e6f0ff] border border-transparent hover:border-[#3ba9ff]/20'
                }`}
              >
                {labels[tab]}
              </button>
            );
          })}
        </div>
      )}

      <div className="flex-1 overflow-y-auto px-3 py-2 space-y-1">
        {/* ── Seção Arquivos / Busca ───────────────────────────────────────────── */}
        {(activeTab === 'files' || searchTerm.trim()) && (
          searchTerm.trim() ? (
            <>
              <div className="text-[10px] text-[#7a92b8] py-1">
                {isSearching ? 'Localizando...' : `${searchResults.length} resultado(s)`}
              </div>
              {searchResults.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleOpenFile(item)}
                  className={`w-full flex items-center justify-between p-2 rounded-xl border text-left transition-all group cursor-pointer ${
                    idx === selectedIdx
                      ? 'bg-[#3ba9ff]/20 border-[#3ba9ff]/50'
                      : 'bg-[#091529]/60 hover:bg-[#3ba9ff]/15 border-[#162744] hover:border-[#3ba9ff]/40'
                  }`}
                >
                  <div className="flex items-center gap-2 truncate">
                    {item.isDir ? (
                      <Folder className="w-4 h-4 text-[#3ba9ff] shrink-0" />
                    ) : (
                      <FileCode className="w-4 h-4 text-[#5eead4] shrink-0" />
                    )}
                    <div className="truncate">
                      <div className="text-xs font-semibold text-[#e2edff] group-hover:text-[#5eead4] transition-colors truncate">
                        {item.name}
                      </div>
                      <div className="text-[10px] text-[#506c94] truncate">{item.path}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-[#3ba9ff] opacity-0 group-hover:opacity-100 transition-opacity shrink-0 ml-2" />
                </button>
              ))}
            </>
          ) : (
            <div className="text-[11px] text-[#506c94] py-6 text-center">
              <Search className="w-6 h-6 mx-auto mb-2 text-[#3ba9ff]/40" />
              Digite para buscar arquivos no workspace
            </div>
          )
        )}

        {/* ── Seção Ações ──────────────────────────────────────────────────────── */}
        {activeTab === 'actions' && !searchTerm.trim() && (
          <>
            <div className="text-[10px] text-[#5eead4] font-semibold pb-1 flex items-center gap-1.5">
              <Sparkles className="w-3 h-3" /> Ações do Workspace
            </div>
            {ACTIONS.map((action, idx) => (
              <button
                key={idx}
                type="button"
                onClick={() => action.onClick?.()}
                className="w-full flex items-center justify-between p-2 rounded-xl bg-[#091529]/60 hover:bg-[#3ba9ff]/15 border border-[#162744] hover:border-[#3ba9ff]/30 text-left transition-all group cursor-pointer"
              >
                <div className="flex items-center gap-2">
                  <span className="shrink-0">{action.icon}</span>
                  <span className="text-[#c4d4f0] group-hover:text-[#e6f0ff] transition-colors">{action.label}</span>
                </div>
                {action.shortcut && (
                  <span className="text-[10px] font-mono text-[#3a4860] bg-[#0f192d]/80 px-1.5 py-0.5 rounded border border-[#50b4ff]/10">
                    {action.shortcut}
                  </span>
                )}
              </button>
            ))}
          </>
        )}

        {/* ── Seção Janelas Abertas ─────────────────────────────────────────────── */}
        {activeTab === 'windows' && !searchTerm.trim() && (
          <>
            <div className="text-[10px] text-[#5eead4] font-semibold pb-1 flex items-center gap-1.5">
              <Pin className="w-3 h-3" /> Janelas Abertas ({openWindows.length})
            </div>
            {openWindows.length === 0 && (
              <div className="text-center py-6 text-[#506c94] text-[11px]">Nenhuma janela aberta.</div>
            )}
            {openWindows.map((w) => (
              <div
                key={w.id}
                className="flex items-center gap-2 p-2 rounded-xl bg-[#091529]/60 hover:bg-[#3ba9ff]/10 border border-[#162744] hover:border-[#3ba9ff]/30 transition-all group"
              >
                <button
                  type="button"
                  className="flex items-center gap-2 flex-1 text-left cursor-pointer"
                  onClick={() => {
                    setWindowDepth(w.id, w.depth);
                    bringToFront(w.id);
                    jumpToDepthPlane(w.depth);
                  }}
                >
                  <span className="shrink-0">{WINDOW_TYPE_ICONS[w.type] || <FileCode className="w-3.5 h-3.5 text-[#7a92b8]" />}</span>
                  <div className="truncate flex-1">
                    <div className="text-[11px] text-[#c4d4f0] group-hover:text-[#e6f0ff] truncate">{w.title}</div>
                    <div className={`text-[9px] ${DEPTH_COLORS[w.depth]}`}>{DEPTH_LABELS[w.depth]}</div>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => closeWindow(w.id)}
                  className="w-5 h-5 flex items-center justify-center rounded text-[#3a4860] hover:text-[#ff5c7a] transition-colors cursor-pointer opacity-0 group-hover:opacity-100"
                  title="Fechar janela"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
};
