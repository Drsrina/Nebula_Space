import React, { useState, useEffect, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  Search,
  FileCode,
  Folder,
  Terminal,
  Bot,
  GitBranch,
  Package,
  RotateCcw,
  Layers,
  LayoutGrid,
  FilePlus,
  FolderOpen,
  Settings,
  Code2,
  Puzzle,
  Network,
  GitGraph,
  Clock,
  Workflow as WorkflowIcon,
  LayoutList,
  ArrowRight,
  Command,
  X,
  FileText,
} from 'lucide-react';
import { usePaletteStore, PaletteMode } from '../store/usePaletteStore';
import { useWindowsStore } from '../store/useWindowsStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { useEditorStore } from '../store/useEditorStore';
import { useFSStore } from '../store/useFSStore';
import { WindowType } from '../types';

interface PaletteItem {
  id: string;
  category: 'files' | 'commands' | 'actions';
  label: string;
  sublabel?: string;
  icon: React.ReactNode;
  shortcut?: string;
  onSelect: () => void;
}

export const CommandPaletteOverlay: React.FC = () => {
  const { isOpen, mode, closePalette } = usePaletteStore();
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [fileResults, setFileResults] = useState<any[]>([]);
  const [isSearchingFiles, setIsSearchingFiles] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const backdropRef = useRef<HTMLDivElement>(null);

  const { openWindow, bringToFront, windows, createNote, setWindowDepth } = useWindowsStore();
  const {
    resetCamera,
    toggleFocusMode,
    isFocusMode,
    toggleZMode,
    isZToggleMode,
    jumpToDepthPlane,
  } = useCanvasStore();
  const { openFileInEditor } = useEditorStore();
  const { openDirectoryPicker } = useFSStore();

  // Reset query and selection whenever palette opens
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setFileResults([]);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [isOpen, mode]);

  // Helper to open or bring window to front
  const openOrFocus = (type: WindowType, targetDepth?: 0 | 1 | 2) => {
    const existing = windows.find((w) => w.type === type);
    if (existing) {
      if (targetDepth !== undefined) setWindowDepth(existing.id, targetDepth);
      bringToFront(existing.id);
    } else {
      openWindow(type, {}, targetDepth ?? 0);
    }
    closePalette();
  };

  // Base Commands list
  const baseCommands: PaletteItem[] = useMemo(
    () => [
      {
        id: 'cmd-reset-camera',
        category: 'commands',
        label: 'Resetar Câmera e Centralizar',
        sublabel: 'Centraliza a viewport nas janelas existentes',
        icon: <RotateCcw className="w-4 h-4 text-[#3ba9ff]" />,
        shortcut: '⌂',
        onSelect: () => {
          resetCamera();
          closePalette();
        },
      },
      {
        id: 'cmd-focus-mode',
        category: 'commands',
        label: isFocusMode ? 'Desativar Modo Foco' : 'Ativar Modo Foco',
        sublabel: 'Oculta degraus Z de contexto e referência',
        icon: <Layers className="w-4 h-4 text-[#5eead4]" />,
        onSelect: () => {
          toggleFocusMode();
          closePalette();
        },
      },
      {
        id: 'cmd-z-mode',
        category: 'commands',
        label: isZToggleMode ? 'Restaurar Degraus 3D' : 'Colapsar Janelas no Degrau 0 (2D)',
        sublabel: 'Alterna perspectiva Z espacial',
        icon: <LayoutGrid className="w-4 h-4 text-[#a78bfa]" />,
        onSelect: () => {
          toggleZMode();
          closePalette();
        },
      },
      {
        id: 'cmd-goto-d0',
        category: 'commands',
        label: 'Ir para Degrau 0 (Foco)',
        sublabel: 'Z = 0px',
        icon: <ArrowRight className="w-4 h-4 text-[#3ba9ff]" />,
        shortcut: '1',
        onSelect: () => {
          jumpToDepthPlane(0);
          closePalette();
        },
      },
      {
        id: 'cmd-goto-d1',
        category: 'commands',
        label: 'Ir para Degrau 1 (Contexto)',
        sublabel: 'Z = -400px',
        icon: <ArrowRight className="w-4 h-4 text-[#5eead4]" />,
        shortcut: '2',
        onSelect: () => {
          jumpToDepthPlane(1);
          closePalette();
        },
      },
      {
        id: 'cmd-goto-d2',
        category: 'commands',
        label: 'Ir para Degrau 2 (Arquivo/Referência)',
        sublabel: 'Z = -700px',
        icon: <ArrowRight className="w-4 h-4 text-[#6ea8ff]" />,
        shortcut: '3',
        onSelect: () => {
          jumpToDepthPlane(2);
          closePalette();
        },
      },
      {
        id: 'cmd-new-note',
        category: 'commands',
        label: 'Criar Nova Nota Markdown',
        sublabel: 'Abre editor de notas com suporte a preview',
        icon: <FilePlus className="w-4 h-4 text-[#5eead4]" />,
        onSelect: () => {
          createNote();
          closePalette();
        },
      },
      {
        id: 'cmd-open-folder',
        category: 'commands',
        label: 'Abrir Pasta Local do Disco...',
        sublabel: 'Conectar repositório via File System Access',
        icon: <FolderOpen className="w-4 h-4 text-[#3ba9ff]" />,
        onSelect: () => {
          openDirectoryPicker();
          closePalette();
        },
      },
    ],
    [
      isFocusMode,
      isZToggleMode,
      resetCamera,
      toggleFocusMode,
      toggleZMode,
      jumpToDepthPlane,
      createNote,
      openDirectoryPicker,
      closePalette,
    ]
  );

  // Base Actions & Windows list
  const baseActions: PaletteItem[] = useMemo(
    () => [
      {
        id: 'act-editor',
        category: 'actions',
        label: 'Abrir Editor de Código',
        sublabel: 'Monaco Editor com syntax highlight',
        icon: <FileCode className="w-4 h-4 text-[#5eead4]" />,
        onSelect: () => openOrFocus('editor', 0),
      },
      {
        id: 'act-files',
        category: 'actions',
        label: 'Abrir Navegador de Arquivos',
        sublabel: 'Gerenciador com multi-abas estilo 1Panel',
        icon: <Folder className="w-4 h-4 text-[#3ba9ff]" />,
        onSelect: () => openOrFocus('file-browser', 1),
      },
      {
        id: 'act-terminal',
        category: 'actions',
        label: 'Abrir Terminal',
        sublabel: 'Terminal integrado no workspace',
        icon: <Terminal className="w-4 h-4 text-[#a78bfa]" />,
        onSelect: () => openOrFocus('terminal', 0),
      },
      {
        id: 'act-git',
        category: 'actions',
        label: 'Abrir Git Local & Forgejo',
        sublabel: 'Controle de versão, commits e remotos',
        icon: <GitBranch className="w-4 h-4 text-[#ec4899]" />,
        onSelect: () => openOrFocus('git-panel', 1),
      },
      {
        id: 'act-ai',
        category: 'actions',
        label: 'Abrir Nebula AI Assistant',
        sublabel: 'Assistente inteligente e pair programmer',
        icon: <Bot className="w-4 h-4 text-[#f59e0b]" />,
        onSelect: () => openOrFocus('ai-chat', 1),
      },
      {
        id: 'act-sandbox',
        category: 'actions',
        label: 'Abrir Code Sandbox (Python & JS)',
        sublabel: 'Execução de scripts isolados',
        icon: <Code2 className="w-4 h-4 text-[#38bdf8]" />,
        onSelect: () => openOrFocus('code-sandbox', 0),
      },
      {
        id: 'act-crontab',
        category: 'actions',
        label: 'Abrir Crontab — Agendador de Tarefas',
        sublabel: 'Gerenciar rotinas periódicas do sistema',
        icon: <Clock className="w-4 h-4 text-[#a78bfa]" />,
        onSelect: () => openOrFocus('crontab', 1),
      },
      {
        id: 'act-workflow',
        category: 'actions',
        label: 'Abrir Workflow Engine (Mini-n8n)',
        sublabel: 'Automações e fluxos de dados visuais',
        icon: <WorkflowIcon className="w-4 h-4 text-[#ec4899]" />,
        onSelect: () => openOrFocus('workflow', 0),
      },
      {
        id: 'act-kanban',
        category: 'actions',
        label: 'Abrir Kanban Board',
        sublabel: 'Gestão de tarefas com colunas e prioridades',
        icon: <LayoutList className="w-4 h-4 text-[#5eead4]" />,
        onSelect: () => openOrFocus('kanban', 1),
      },
      {
        id: 'act-graph',
        category: 'actions',
        label: 'Abrir Graph — Mapa de Conexões',
        sublabel: 'Grafo de nós e dependências espaciais',
        icon: <GitGraph className="w-4 h-4 text-[#38bdf8]" />,
        onSelect: () => openOrFocus('graph', 1),
      },
      {
        id: 'act-docker',
        category: 'actions',
        label: 'Abrir Docker Monitor',
        sublabel: 'Monitoramento de recursos do container',
        icon: <Network className="w-4 h-4 text-[#6ee7b7]" />,
        onSelect: () => openOrFocus('docker-monitor', 1),
      },
      {
        id: 'act-task-runner',
        category: 'actions',
        label: 'Abrir Task Runner',
        sublabel: 'Executar scripts do package.json',
        icon: <Package className="w-4 h-4 text-[#a78bfa]" />,
        onSelect: () => openOrFocus('task-runner', 1),
      },
      {
        id: 'act-plugins',
        category: 'actions',
        label: 'Abrir Plugin Manager',
        sublabel: 'Extensões e módulos de workspace',
        icon: <Puzzle className="w-4 h-4 text-[#a78bfa]" />,
        onSelect: () => openOrFocus('plugin-manager', 1),
      },
      {
        id: 'act-settings',
        category: 'actions',
        label: 'Abrir Configurações Globais',
        sublabel: 'Ajustes de tema, VPS, docking e canvas',
        icon: <Settings className="w-4 h-4 text-[#7a92b8]" />,
        onSelect: () => openOrFocus('settings-global', 1),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [windows]
  );

  // File search over backend or local FS
  useEffect(() => {
    const q = query.replace(/^>/, '').trim();
    if (!q || mode === 'commands' || query.startsWith('>')) {
      setFileResults([]);
      setIsSearchingFiles(false);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearchingFiles(true);
      try {
        const res = await fetch(`/api/fs/search?q=${encodeURIComponent(q)}`);
        if (res.ok) {
          const data = await res.json();
          setFileResults((data.results || []).slice(0, 15));
        }
      } catch (err) {
        // ignore
      } finally {
        setIsSearchingFiles(false);
      }
    }, 120);

    return () => clearTimeout(timer);
  }, [query, mode]);

  // Transform files into PaletteItems
  const fileItems: PaletteItem[] = useMemo(() => {
    return fileResults.map((item, idx) => ({
      id: `file-${item.path}-${idx}`,
      category: 'files',
      label: item.name,
      sublabel: item.path,
      icon: item.isDir ? (
        <Folder className="w-4 h-4 text-[#3ba9ff] shrink-0" />
      ) : (
        <FileText className="w-4 h-4 text-[#5eead4] shrink-0" />
      ),
      onSelect: async () => {
        if (item.isDir) {
          openWindow('file-browser', { initialPath: item.path }, 0);
        } else {
          try {
            const res = await useFSStore.getState().getFileContent({ path: item.path, name: item.name });
            openFileInEditor({
              path: item.path,
              name: item.name,
              content: res.content || '',
            });
            openOrFocus('editor', 0);
          } catch {
            openOrFocus('editor', 0);
          }
        }
        closePalette();
      },
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fileResults]);

  // Aggregate and filter items according to query and mode
  const cleanQ = query.replace(/^>/, '').toLowerCase().trim();
  const isCommandFilter = mode === 'commands' || query.startsWith('>');

  const filteredCommands = useMemo(() => {
    if (!cleanQ) return baseCommands;
    return baseCommands.filter(
      (c) => c.label.toLowerCase().includes(cleanQ) || (c.sublabel && c.sublabel.toLowerCase().includes(cleanQ))
    );
  }, [baseCommands, cleanQ]);

  const filteredActions = useMemo(() => {
    if (!cleanQ) return baseActions;
    return baseActions.filter(
      (a) => a.label.toLowerCase().includes(cleanQ) || (a.sublabel && a.sublabel.toLowerCase().includes(cleanQ))
    );
  }, [baseActions, cleanQ]);

  // Flattened list for keyboard navigation
  const visibleItems = useMemo(() => {
    if (isCommandFilter) {
      return [...filteredCommands, ...filteredActions];
    }
    if (cleanQ) {
      return [...fileItems, ...filteredCommands, ...filteredActions];
    }
    // Default when opened with Ctrl+P (show quick commands and actions)
    return [...filteredCommands.slice(0, 4), ...filteredActions.slice(0, 6)];
  }, [isCommandFilter, cleanQ, fileItems, filteredCommands, filteredActions]);

  // Clamp selection on change
  useEffect(() => {
    setSelectedIndex((prev) => {
      if (visibleItems.length === 0) return 0;
      return Math.max(0, Math.min(prev, visibleItems.length - 1));
    });
  }, [visibleItems.length]);

  // Scroll active item into view
  useEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const activeEl = list.querySelector(`[data-index="${selectedIndex}"]`) as HTMLElement;
    if (activeEl) {
      activeEl.scrollIntoView({ block: 'nearest' });
    }
  }, [selectedIndex]);

  // Key navigation handler
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev < visibleItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev > 0 ? prev - 1 : visibleItems.length - 1));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const selected = visibleItems[selectedIndex];
      if (selected) {
        selected.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      closePalette();
    }
  };

  if (!isOpen) return null;

  return createPortal(
    <div
      ref={backdropRef}
      onPointerDown={(e) => {
        if (e.target === backdropRef.current) {
          closePalette();
        }
      }}
      onWheel={(e) => e.stopPropagation()}
      className="fixed inset-0 z-[999999] flex items-start justify-center pt-[12vh] bg-black/65 backdrop-blur-md select-none font-sans"
    >
      <div
        className="w-[620px] max-w-[92vw] bg-[#070e1c]/95 border border-[#3ba9ff]/35 rounded-2xl shadow-[0_25px_70px_rgba(0,0,0,0.85),0_0_35px_rgba(59,169,255,0.2)] overflow-hidden flex flex-col text-[#e6f0ff] animate-in fade-in zoom-in-95 duration-150"
        onPointerDown={(e) => e.stopPropagation()}
      >
        {/* Search Input Bar */}
        <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#3ba9ff]/20 bg-[#0a1628]/80">
          <Search className="w-5 h-5 text-[#3ba9ff] shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              isCommandFilter
                ? 'Digite um comando ou ação...'
                : 'Buscar arquivo ou digite > para comandos... (Ctrl+P / Ctrl+Shift+P)'
            }
            className="flex-1 bg-transparent text-sm text-[#e6f0ff] placeholder-[#506c94] font-mono outline-none"
          />
          {query ? (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="p-1 rounded text-[#7a92b8] hover:text-[#e6f0ff] transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          ) : (
            <div className="flex items-center gap-1 text-[11px] text-[#506c94] font-mono bg-[#050810] px-2 py-0.5 rounded border border-[#162744]">
              <Command className="w-3 h-3" />
              <span>{mode === 'commands' ? '⇧P' : 'P'}</span>
            </div>
          )}
        </div>

        {/* Results List */}
        <div
          ref={listRef}
          className="max-h-[380px] overflow-y-auto p-2 space-y-1 divide-y divide-[#3ba9ff]/10"
        >
          {visibleItems.length === 0 ? (
            <div className="py-10 text-center text-xs text-[#7a92b8] font-mono">
              {isSearchingFiles ? 'Localizando arquivos no workspace...' : 'Nenhum resultado correspondente.'}
            </div>
          ) : (
            <>
              {/* Grouping header helper */}
              {visibleItems.map((item, index) => {
                const isSelected = index === selectedIndex;
                const prevItem = visibleItems[index - 1];
                const showHeader = !prevItem || prevItem.category !== item.category;

                const categoryLabels: Record<string, string> = {
                  files: 'Arquivos',
                  commands: 'Comandos do Sistema',
                  actions: 'Janelas & Ferramentas',
                };

                return (
                  <React.Fragment key={item.id}>
                    {showHeader && (
                      <div className="pt-2 pb-1 px-3 text-[10px] font-mono uppercase tracking-wider text-[#5eead4]/80 font-bold">
                        {categoryLabels[item.category] || item.category}
                      </div>
                    )}
                    <div
                      data-index={index}
                      onClick={() => item.onSelect()}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={`flex items-center justify-between px-3 py-2 rounded-xl cursor-pointer transition-all ${
                        isSelected
                          ? 'bg-[#3ba9ff]/25 text-[#5eead4] border border-[#3ba9ff]/45 shadow-[0_0_15px_rgba(59,169,255,0.2)]'
                          : 'text-[#e6f0ff] hover:bg-[#3ba9ff]/15 border border-transparent'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span className="shrink-0">{item.icon}</span>
                        <div className="truncate">
                          <div className="text-xs font-mono font-medium truncate">{item.label}</div>
                          {item.sublabel && (
                            <div className="text-[10px] text-[#7a92b8] truncate font-mono">
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                      </div>

                      {item.shortcut && (
                        <span className="shrink-0 text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#050810]/70 text-[#7a92b8] border border-[#3ba9ff]/20">
                          {item.shortcut}
                        </span>
                      )}
                    </div>
                  </React.Fragment>
                );
              })}
            </>
          )}
        </div>

        {/* Footer info bar */}
        <div className="flex items-center justify-between px-4 py-2 bg-[#050914] border-t border-[#3ba9ff]/15 text-[11px] font-mono text-[#7a92b8]">
          <div className="flex items-center gap-3">
            <span>↑↓ navegar</span>
            <span>↵ selecionar</span>
            <span>esc fechar</span>
          </div>
          <div>{visibleItems.length} itens</div>
        </div>
      </div>
    </div>,
    document.body
  );
};
