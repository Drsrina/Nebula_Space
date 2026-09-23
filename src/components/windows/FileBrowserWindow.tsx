import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Folder,
  FolderOpen,
  FileCode,
  FileText,
  FileSpreadsheet,
  FileImage,
  File as FileIcon,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Home,
  RefreshCw,
  Search,
  Plus,
  Trash2,
  Edit2,
  Copy,
  Star,
  LayoutList,
  LayoutGrid,
  Eye,
  EyeOff,
  MoreVertical,
  Check,
  Server,
  HardDrive,
  ExternalLink,
  ChevronDown,
  X,
  ShieldAlert,
} from 'lucide-react';
import { useFSStore } from '../../store/useFSStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useEditorStore } from '../../store/useEditorStore';
import { formatBytes } from '../../lib/fs';
import { FSNodeItem } from '../../lib/adapters';

function getFileIcon(isDir: boolean, ext?: string) {
  if (isDir) {
    return <Folder className="w-4 h-4 text-[#3ba9ff] shrink-0" />;
  }
  switch (ext) {
    case 'ts':
    case 'tsx':
    case 'js':
    case 'jsx':
    case 'json':
    case 'html':
    case 'css':
    case 'yml':
    case 'yaml':
      return <FileCode className="w-4 h-4 text-[#3ba9ff] shrink-0" />;
    case 'md':
    case 'txt':
    case 'log':
      return <FileText className="w-4 h-4 text-[#5eead4] shrink-0" />;
    case 'csv':
    case 'tsv':
      return <FileSpreadsheet className="w-4 h-4 text-[#6ea8ff] shrink-0" />;
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'svg':
    case 'webp':
      return <FileImage className="w-4 h-4 text-[#93c5fd] shrink-0" />;
    default:
      return <FileIcon className="w-4 h-4 text-[#7a92b8] shrink-0" />;
  }
}

function formatDate(timestamp: number): string {
  if (!timestamp) return '-';
  const d = new Date(timestamp);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export const FileBrowserWindow: React.FC = () => {
  const {
    mode,
    roots,
    currentPath,
    currentItems,
    tabs,
    activeTabId,
    favorites,
    viewMode,
    showHidden,
    sortBy,
    sortOrder,
    filterQuery,
    searchQuery,
    isSearching,
    searchResults,
    isLoading,
    errorMessage,
    navigateTo,
    goBack,
    goForward,
    goUp,
    goHome,
    refreshCurrentDir,
    addTab,
    closeTab,
    switchTab,
    setViewMode,
    setShowHidden,
    setSort,
    setFilterQuery,
    executeSearch,
    clearSearch,
    toggleFavorite,
    createNewFile,
    createNewFolder,
    renameEntry,
    deleteEntry,
    getFileContent,
  } = useFSStore();

  const { openWindow, openFilePreview } = useWindowsStore();

  // Local UI State
  const [isEditingPath, setIsEditingPath] = useState(false);
  const [pathInput, setPathInput] = useState(currentPath);
  const [showSidebar, setShowSidebar] = useState(true);
  const [selectedItem, setSelectedItem] = useState<FSNodeItem | null>(null);

  // Dialogs
  const [modalType, setModalType] = useState<'new-file' | 'new-folder' | 'rename' | 'delete' | null>(null);
  const [modalInput, setModalInput] = useState('');
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  // Recursive search state
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchInput, setSearchInput] = useState('');

  useEffect(() => {
    setPathInput(currentPath);
  }, [currentPath]);

  // Breadcrumb segments calculation (distinguishes configured roots as entry points from subpaths)
  const breadcrumbs = useMemo(() => {
    const clean = currentPath.replace(/\/+$/, '');
    const matchedRoot = roots.find((r) => {
      const rp = r.path.replace(/\/+$/, '');
      return clean === rp || clean.startsWith(rp + '/');
    });

    if (!matchedRoot) {
      if (!clean || clean === '/') return [{ name: '/', path: '/' }];
      const parts = clean.split('/').filter(Boolean);
      const crumbs = [{ name: '/', path: '/' }];
      let acc = '';
      for (const part of parts) {
        acc += '/' + part;
        crumbs.push({ name: part, path: acc });
      }
      return crumbs;
    }

    // Inside a matched root entry point:
    const rootPathClean = matchedRoot.path.replace(/\/+$/, '');
    const rootDisplayName = matchedRoot.name.replace(/\s*\(.*\)$/, '').trim() || rootPathClean.split('/').filter(Boolean).pop() || rootPathClean;
    const crumbs = [{ name: rootDisplayName, path: matchedRoot.path }];

    const relativeSub = clean.slice(rootPathClean.length).replace(/^\/+/, '');
    if (relativeSub) {
      const subParts = relativeSub.split('/').filter(Boolean);
      let acc = rootPathClean;
      for (const part of subParts) {
        acc += '/' + part;
        crumbs.push({ name: part, path: acc });
      }
    }
    return crumbs;
  }, [currentPath, roots]);

  // Filtered and sorted items
  const displayItems = useMemo(() => {
    let list = [...currentItems];

    // Filter hidden dotfiles
    if (!showHidden) {
      list = list.filter((item) => !item.name.startsWith('.'));
    }

    // In-folder filter
    if (filterQuery.trim()) {
      const q = filterQuery.toLowerCase();
      list = list.filter((item) => item.name.toLowerCase().includes(q));
    }

    // Sorting
    list.sort((a, b) => {
      // Folders always first
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;

      let compareVal = 0;
      if (sortBy === 'name') {
        compareVal = a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
      } else if (sortBy === 'size') {
        compareVal = (a.size || 0) - (b.size || 0);
      } else if (sortBy === 'mtime') {
        compareVal = (a.mtime || 0) - (b.mtime || 0);
      } else if (sortBy === 'type') {
        const extA = a.ext || '';
        const extB = b.ext || '';
        compareVal = extA.localeCompare(extB);
      }

      return sortOrder === 'asc' ? compareVal : -compareVal;
    });

    return list;
  }, [currentItems, showHidden, filterQuery, sortBy, sortOrder]);

  // Progressive rendering for large directories (prevent DOM freeze in huge folders)
  const [displayLimit, setDisplayLimit] = useState<number>(80);

  useEffect(() => {
    setDisplayLimit(80);
  }, [currentPath, filterQuery, viewMode]);

  const visibleItems = useMemo(() => {
    return displayItems.slice(0, displayLimit);
  }, [displayItems, displayLimit]);

  const hasMore = displayItems.length > displayLimit;

  const isFavorited = favorites.includes(currentPath);

  // Item Open Handler
  const handleItemClick = async (item: FSNodeItem) => {
    setSelectedItem(item);
  };

  const handleItemDoubleClick = async (item: FSNodeItem) => {
    if (item.isDir) {
      navigateTo(item.path);
    } else {
      await handleOpenFileInEditor(item);
    }
  };

  const handleOpenFileInEditor = async (item: FSNodeItem) => {
    try {
      const res = await getFileContent({
        path: item.path,
        name: item.name,
        size: item.size,
      });

      if (!res.isBinary) {
        useEditorStore.getState().openFileInEditor({
          path: item.path,
          name: item.name,
          content: res.content,
        });
      }

      openFilePreview({
        filePath: item.path,
        fileName: item.name,
        fileExtension: item.ext,
        content: res.content,
        isBinary: res.isBinary,
        size: item.size,
        lastModified: item.mtime,
      });
    } catch (err: any) {
      console.error('Error opening file:', err);
    }
  };

  const copyToClipboard = (text: string, label = 'Caminho copiado') => {
    navigator.clipboard.writeText(text);
    setCopiedToast(label);
    setTimeout(() => setCopiedToast(null), 1800);
  };

  const handlePathSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (pathInput.trim()) {
      navigateTo(pathInput.trim());
      setIsEditingPath(false);
    }
  };

  const handleModalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalInput.trim() && modalType !== 'delete') return;

    if (modalType === 'new-file') {
      await createNewFile(modalInput.trim());
    } else if (modalType === 'new-folder') {
      await createNewFolder(modalInput.trim());
    } else if (modalType === 'rename' && selectedItem) {
      await renameEntry(selectedItem.path, modalInput.trim());
    } else if (modalType === 'delete' && selectedItem) {
      await deleteEntry(selectedItem.path);
    }

    setModalType(null);
    setModalInput('');
    setSelectedItem(null);
  };

  return (
    <div className="flex flex-col h-full bg-[#070e1c] text-[#e6f0ff] select-none font-sans overflow-hidden">
      {/* 1. Multi-Tab Header Bar (1Panel Style) */}
      <div className="flex items-center bg-[#0a1426] border-b border-[#3ba9ff]/15 px-2 pt-1.5 gap-1 shrink-0 overflow-x-auto">
        <div className="flex items-center gap-1 flex-1 min-w-0">
          {tabs.map((tab) => {
            const isActive = tab.id === activeTabId;
            const folderName = tab.path === '/' ? 'Raiz' : tab.path.split('/').filter(Boolean).pop() || tab.path;

            return (
              <div
                key={tab.id}
                onClick={() => switchTab(tab.id)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg text-xs font-medium cursor-pointer transition-all border-t border-x ${
                  isActive
                    ? 'bg-[#0f1d35] text-[#5eead4] border-[#3ba9ff]/40 shadow-[0_-2px_10px_rgba(59,169,255,0.15)] relative after:content-[""] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-[2px] after:bg-[#5eead4]'
                    : 'bg-[#0a1426] text-[#7a92b8] border-transparent hover:bg-[#0c182e] hover:text-[#e6f0ff]'
                }`}
                title={tab.path}
              >
                <Folder className={`w-3.5 h-3.5 ${isActive ? 'text-[#5eead4]' : 'text-[#7a92b8]'}`} />
                <span className="truncate max-w-[120px] font-mono">{folderName}</span>
                {tabs.length > 1 && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      closeTab(tab.id);
                    }}
                    className="p-0.5 rounded hover:bg-[#ff5c7a]/20 hover:text-[#ff5c7a] opacity-0 group-hover:opacity-100 transition-opacity"
                    title="Fechar aba"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}

          {tabs.length < 7 && (
            <button
              type="button"
              onClick={() => addTab()}
              className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/10 transition-colors ml-1"
              title="Nova aba (estilo 1Panel)"
            >
              <Plus className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        {/* Mode indicator in tabs */}
        <div className="flex items-center gap-1.5 text-[11px] text-[#7a92b8] px-2">
          {mode === 'remote' ? (
            <span className="flex items-center gap-1 text-[#5eead4] bg-[#5eead4]/10 border border-[#5eead4]/30 px-2 py-0.5 rounded-full font-mono text-[10px]">
              <Server className="w-3 h-3" />
              VPS HTTP
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#3ba9ff] bg-[#3ba9ff]/10 border border-[#3ba9ff]/30 px-2 py-0.5 rounded-full font-mono text-[10px]">
              <HardDrive className="w-3 h-3" />
              Local FS
            </span>
          )}
        </div>
      </div>

      {/* 2. Navigation & Breadcrumb Toolbar */}
      <div className="flex items-center gap-2 p-2 bg-[#0d1a30] border-b border-[#3ba9ff]/15 shrink-0 text-xs">
        {/* Nav arrows */}
        <div className="flex items-center gap-0.5 shrink-0">
          <button
            type="button"
            onClick={goBack}
            className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Voltar"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={goForward}
            className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15 disabled:opacity-30 disabled:cursor-not-allowed transition-all"
            title="Avançar"
          >
            <ArrowRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={goUp}
            className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15 transition-all"
            title="Subir nível (pasta pai)"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={goHome}
            className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/15 transition-all"
            title="Ir para Raiz / Home"
          >
            <Home className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={refreshCurrentDir}
            className={`p-1.5 rounded-lg text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/15 transition-all ${
              isLoading ? 'animate-spin text-[#3ba9ff]' : ''
            }`}
            title="Atualizar pasta"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Interactive Breadcrumbs / Path Bar */}
        <div className="flex-1 min-w-0 bg-[#070e1c] border border-[#3ba9ff]/25 rounded-lg px-2 py-1 flex items-center gap-1 shadow-inner relative">
          {isEditingPath ? (
            <form onSubmit={handlePathSubmit} className="flex-1 flex items-center">
              <input
                type="text"
                value={pathInput}
                onChange={(e) => setPathInput(e.target.value)}
                onBlur={() => setIsEditingPath(false)}
                autoFocus
                className="w-full bg-transparent text-xs font-mono text-[#5eead4] outline-none"
                placeholder="/caminho/para/pasta"
              />
            </form>
          ) : (
            <div className="flex items-center gap-1 overflow-x-auto scrollbar-none flex-1 py-0.5 font-mono text-xs">
              {breadcrumbs.map((crumb, idx) => (
                <React.Fragment key={crumb.path}>
                  <button
                    type="button"
                    onClick={() => navigateTo(crumb.path)}
                    className="hover:text-[#5eead4] hover:bg-[#3ba9ff]/15 px-1.5 py-0.5 rounded transition-colors truncate max-w-[140px] text-[#e6f0ff]"
                  >
                    {crumb.name}
                  </button>
                  {idx < breadcrumbs.length - 1 && (
                    <ChevronRight className="w-3 h-3 text-[#7a92b8]/50 shrink-0" />
                  )}
                </React.Fragment>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={() => setIsEditingPath(!isEditingPath)}
            className="p-1 rounded text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/10 shrink-0"
            title="Digitar caminho diretamente (Ctrl+L)"
          >
            <Edit2 className="w-3 h-3" />
          </button>

          {/* Star / Favorite current folder */}
          <button
            type="button"
            onClick={() => toggleFavorite(currentPath)}
            className={`p-1 rounded shrink-0 transition-colors ${
              isFavorited ? 'text-[#f59e0b] hover:text-[#fbbf24]' : 'text-[#7a92b8] hover:text-[#f59e0b]'
            }`}
            title={isFavorited ? 'Remover dos favoritos' : 'Adicionar aos favoritos'}
          >
            <Star className={`w-3.5 h-3.5 ${isFavorited ? 'fill-[#f59e0b]' : ''}`} />
          </button>
        </div>

        {/* In-folder Quick Filter */}
        <div className="relative w-36 sm:w-44 shrink-0">
          <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[#7a92b8]" />
          <input
            type="text"
            value={filterQuery}
            onChange={(e) => setFilterQuery(e.target.value)}
            placeholder="Filtrar nesta pasta..."
            className="w-full pl-8 pr-2 py-1 bg-[#070e1c] border border-[#3ba9ff]/20 rounded-lg text-xs text-[#e6f0ff] placeholder-[#7a92b8]/60 focus:outline-none focus:border-[#3ba9ff]"
          />
        </div>
      </div>

      {/* 3. Action Header Bar (Create, Search, View Toggles) */}
      <div className="flex items-center justify-between gap-2 px-3 py-2 bg-[#091322] border-b border-[#3ba9ff]/15 text-xs shrink-0">
        {/* Left Actions */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setModalType('new-file');
              setModalInput('');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#5eead4] font-medium transition-all"
            title="Criar novo arquivo"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Novo Arquivo</span>
          </button>

          <button
            type="button"
            onClick={() => {
              setModalType('new-folder');
              setModalInput('');
            }}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#e6f0ff] hover:text-[#5eead4] font-medium transition-all"
            title="Criar nova pasta"
          >
            <FolderOpen className="w-3.5 h-3.5" />
            <span>Nova Pasta</span>
          </button>

          {/* Recursive Search Toggle */}
          <button
            type="button"
            onClick={() => setSearchOpen(!searchOpen)}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border transition-all ${
              searchOpen
                ? 'bg-[#3ba9ff]/30 border-[#5eead4] text-[#5eead4]'
                : 'bg-[#0d1a30] border-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
            title="Buscar arquivos recursivamente no disco"
          >
            <Search className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Busca Recursiva</span>
          </button>
        </div>

        {/* Right View & Display Options */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setShowHidden(!showHidden)}
            className={`p-1.5 rounded-lg border transition-all ${
              showHidden
                ? 'bg-[#3ba9ff]/20 border-[#3ba9ff]/40 text-[#5eead4]'
                : 'border-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
            title={showHidden ? 'Ocultar arquivos com ponto (.dotfiles)' : 'Mostrar arquivos ocultos (.dotfiles)'}
          >
            {showHidden ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
          </button>

          <div className="w-[1px] h-4 bg-[#3ba9ff]/20 mx-1" />

          <button
            type="button"
            onClick={() => setViewMode('list')}
            className={`p-1.5 rounded-lg border transition-all ${
              viewMode === 'list'
                ? 'bg-[#3ba9ff]/20 border-[#3ba9ff]/40 text-[#5eead4]'
                : 'border-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
            title="Visualização em Lista"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setViewMode('grid')}
            className={`p-1.5 rounded-lg border transition-all ${
              viewMode === 'grid'
                ? 'bg-[#3ba9ff]/20 border-[#3ba9ff]/40 text-[#5eead4]'
                : 'border-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
            title="Visualização em Grade"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Recursive Search Bar Overlay */}
      {searchOpen && (
        <div className="p-2.5 bg-[#0a162b] border-b border-[#3ba9ff]/20 flex flex-col gap-2 shrink-0">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#3ba9ff]" />
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && executeSearch(searchInput)}
                placeholder="Buscar arquivos ou pastas a partir desta raiz (Enter)..."
                className="w-full pl-9 pr-3 py-1.5 bg-[#070e1c] border border-[#3ba9ff]/30 rounded-lg text-xs text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
                autoFocus
              />
            </div>
            <button
              type="button"
              onClick={() => executeSearch(searchInput)}
              disabled={isSearching || !searchInput.trim()}
              className="px-3 py-1.5 bg-[#3ba9ff] hover:bg-[#5eead4] text-[#050810] font-semibold text-xs rounded-lg transition-all disabled:opacity-50"
            >
              {isSearching ? 'Buscando...' : 'Buscar'}
            </button>
            <button
              type="button"
              onClick={() => {
                setSearchOpen(false);
                clearSearch();
              }}
              className="p-1.5 rounded-lg text-[#7a92b8] hover:text-[#e6f0ff]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>

          {/* Search Results list */}
          {searchQuery && (
            <div className="max-h-48 overflow-y-auto bg-[#070e1c] rounded-lg border border-[#3ba9ff]/20 p-1.5">
              <div className="text-[11px] text-[#7a92b8] px-2 py-1 flex items-center justify-between">
                <span>Resultados para "{searchQuery}": {searchResults.length}</span>
                <button
                  type="button"
                  onClick={clearSearch}
                  className="text-[#5eead4] hover:underline"
                >
                  Limpar
                </button>
              </div>
              {searchResults.length === 0 ? (
                <div className="p-3 text-center text-xs text-[#7a92b8]">
                  Nenhum arquivo encontrado.
                </div>
              ) : (
                searchResults.map((item) => (
                  <div
                    key={item.path}
                    onClick={() => {
                      if (item.isDir) {
                        navigateTo(item.path);
                      } else {
                        handleOpenFileInEditor(item);
                      }
                      setSearchOpen(false);
                    }}
                    className="flex items-center gap-2 p-1.5 hover:bg-[#3ba9ff]/15 rounded-md cursor-pointer text-xs group"
                  >
                    {getFileIcon(item.isDir, item.ext)}
                    <span className="font-mono text-[#e6f0ff] group-hover:text-[#5eead4] truncate flex-1">
                      {item.path}
                    </span>
                    <span className="text-[10px] text-[#7a92b8] font-mono shrink-0">
                      {item.isDir ? 'Pasta' : formatBytes(item.size)}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}

      {/* Main Workspace: Left Sidebar + Content Area */}
      <div className="flex-1 flex overflow-hidden">
        {/* Left Sidebar: Roots & Favorites */}
        {showSidebar && (
          <aside className="w-48 bg-[#091322]/80 border-r border-[#3ba9ff]/15 flex flex-col shrink-0 text-xs overflow-y-auto">
            {/* Roots */}
            <div className="p-2.5">
              <div className="text-[10px] uppercase font-bold text-[#7a92b8] tracking-wider mb-1.5 px-1 flex items-center gap-1">
                <HardDrive className="w-3 h-3 text-[#3ba9ff]" />
                <span>Locais / Raízes</span>
              </div>
              <div className="space-y-0.5">
                {roots.map((r) => {
                  const isCurrent = currentPath === r.path;
                  return (
                    <button
                      key={r.path}
                      type="button"
                      onClick={() => navigateTo(r.path)}
                      className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left transition-colors font-mono truncate ${
                        isCurrent
                          ? 'bg-[#3ba9ff]/20 text-[#5eead4] font-medium border border-[#3ba9ff]/30'
                          : 'text-[#e6f0ff]/80 hover:bg-[#3ba9ff]/10 hover:text-white'
                      }`}
                      title={r.path}
                    >
                      <Server className="w-3.5 h-3.5 text-[#3ba9ff] shrink-0" />
                      <span className="truncate">{r.name}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Favorites */}
            <div className="p-2.5 border-t border-[#3ba9ff]/10 flex-1">
              <div className="text-[10px] uppercase font-bold text-[#7a92b8] tracking-wider mb-1.5 px-1 flex items-center gap-1">
                <Star className="w-3 h-3 text-[#f59e0b]" />
                <span>Favoritos ({favorites.length})</span>
              </div>
              {favorites.length === 0 ? (
                <div className="px-2 py-2 text-[11px] text-[#7a92b8]/60 italic">
                  Clique na estrela na barra de caminho para salvar atalhos.
                </div>
              ) : (
                <div className="space-y-0.5">
                  {favorites.map((fav) => {
                    const isCurrent = currentPath === fav;
                    const name = fav.split('/').filter(Boolean).pop() || fav;
                    return (
                      <div
                        key={fav}
                        className={`group flex items-center justify-between px-2 py-1.5 rounded-lg text-left transition-colors font-mono ${
                          isCurrent
                            ? 'bg-[#3ba9ff]/20 text-[#5eead4] font-medium border border-[#3ba9ff]/30'
                            : 'text-[#e6f0ff]/80 hover:bg-[#3ba9ff]/10 hover:text-white'
                        }`}
                      >
                        <button
                          type="button"
                          onClick={() => navigateTo(fav)}
                          className="flex items-center gap-1.5 truncate flex-1 text-left"
                          title={fav}
                        >
                          <Folder className="w-3 h-3 text-[#f59e0b] shrink-0" />
                          <span className="truncate">{name}</span>
                        </button>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            toggleFavorite(fav);
                          }}
                          className="text-[#7a92b8] hover:text-[#ff5c7a] opacity-0 group-hover:opacity-100 p-0.5"
                          title="Remover favorito"
                        >
                          <X className="w-2.5 h-2.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Config Shortcut */}
            <div className="p-2 border-t border-[#3ba9ff]/10">
              <button
                type="button"
                onClick={() => {
                  const { windows, bringToFront, openWindow, updateWindowPosition, setWindowDepth } = useWindowsStore.getState();
                  const { camera, currentDepthPlane } = useCanvasStore.getState();
                  const existing = windows.find((w) => w.type === 'settings-global');
                  if (existing) {
                    setWindowDepth(existing.id, currentDepthPlane);
                    updateWindowPosition(
                      existing.id,
                      Math.round(-camera.x - existing.width / 2),
                      Math.round(-camera.y - existing.height / 2 + 28)
                    );
                    bringToFront(existing.id);
                  } else {
                    openWindow('settings-global', {}, currentDepthPlane);
                  }
                }}
                className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-left text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/10 transition-colors"
              >
                <Server className="w-3.5 h-3.5 text-[#3ba9ff]" />
                <span>Configurar VPS / Token</span>
              </button>
            </div>
          </aside>
        )}

        {/* File Browser Table or Grid */}
        <div className="flex-1 flex flex-col overflow-hidden bg-[#070e1c]">
          {isLoading ? (
            <div className="flex-1 flex flex-col items-center justify-center gap-2 text-[#7a92b8]">
              <RefreshCw className="w-6 h-6 animate-spin text-[#3ba9ff]" />
              <span className="text-xs">Lendo diretório...</span>
            </div>
          ) : errorMessage ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center">
              <div className="p-3 rounded-full bg-[#ff5c7a]/15 text-[#ff5c7a] mb-2 border border-[#ff5c7a]/30">
                <ShieldAlert className="w-8 h-8" />
              </div>
              <p className="text-sm font-semibold text-[#ff5c7a] mb-1">Permissão Negada / Erro de Acesso</p>
              <p className="text-xs text-[#7a92b8] max-w-md mb-4">{errorMessage}</p>
              <button
                type="button"
                onClick={goHome}
                className="px-3.5 py-1.5 bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#5eead4] text-xs rounded-lg font-medium transition-all border border-[#3ba9ff]/40 shadow-sm"
              >
                Retornar ao local permitido
              </button>
            </div>
          ) : displayItems.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center p-6 text-center text-[#7a92b8]">
              <FolderOpen className="w-10 h-10 text-[#3ba9ff]/30 mb-2" />
              <p className="text-xs">Esta pasta está vazia.</p>
              {filterQuery && (
                <p className="text-[11px] text-[#7a92b8]/70 mt-1">
                  Nenhum item corresponde ao filtro "{filterQuery}".
                </p>
              )}
            </div>
          ) : viewMode === 'list' ? (
            /* Table View (1Panel Style) */
            <div className="flex-1 overflow-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead className="bg-[#0b162b] sticky top-0 z-10 border-b border-[#3ba9ff]/20 text-[#7a92b8] text-[11px] font-mono">
                  <tr>
                    <th
                      className="py-2 px-3 cursor-pointer hover:text-[#5eead4] transition-colors"
                      onClick={() => setSort('name')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Nome</span>
                        {sortBy === 'name' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="py-2 px-3 w-28 cursor-pointer hover:text-[#5eead4] transition-colors hidden sm:table-cell"
                      onClick={() => setSort('size')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Tamanho</span>
                        {sortBy === 'size' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="py-2 px-3 w-24 cursor-pointer hover:text-[#5eead4] transition-colors hidden md:table-cell"
                      onClick={() => setSort('type')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Tipo</span>
                        {sortBy === 'type' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th
                      className="py-2 px-3 w-36 cursor-pointer hover:text-[#5eead4] transition-colors hidden lg:table-cell"
                      onClick={() => setSort('mtime')}
                    >
                      <div className="flex items-center gap-1">
                        <span>Modificado</span>
                        {sortBy === 'mtime' && (
                          <span>{sortOrder === 'asc' ? '↑' : '↓'}</span>
                        )}
                      </div>
                    </th>
                    <th className="py-2 px-3 w-24 hidden xl:table-cell">Permissões</th>
                    <th className="py-2 px-3 w-28 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#3ba9ff]/10">
                  {visibleItems.map((item) => {
                    const isSelected = selectedItem?.path === item.path;
                    return (
                      <tr
                        key={item.path}
                        onClick={() => handleItemClick(item)}
                        onDoubleClick={() => handleItemDoubleClick(item)}
                        className={`group transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-[#3ba9ff]/20 text-[#5eead4]'
                            : 'hover:bg-[#3ba9ff]/10 text-[#e6f0ff]'
                        }`}
                      >
                        {/* Name */}
                        <td className="py-2 px-3 font-mono">
                          <div className="flex items-center gap-2">
                            {getFileIcon(item.isDir, item.ext)}
                            <span className="truncate group-hover:text-[#5eead4] transition-colors">
                              {item.name}
                            </span>
                          </div>
                        </td>

                        {/* Size */}
                        <td className="py-2 px-3 font-mono text-[#7a92b8] text-[11px] hidden sm:table-cell">
                          {item.isDir ? '-' : formatBytes(item.size)}
                        </td>

                        {/* Type */}
                        <td className="py-2 px-3 font-mono text-[#7a92b8] text-[11px] hidden md:table-cell">
                          {item.isDir ? 'Pasta' : (item.ext?.toUpperCase() || 'Arquivo')}
                        </td>

                        {/* Modified */}
                        <td className="py-2 px-3 font-mono text-[#7a92b8] text-[11px] hidden lg:table-cell">
                          {formatDate(item.mtime)}
                        </td>

                        {/* Mode */}
                        <td className="py-2 px-3 font-mono text-[#7a92b8]/80 text-[11px] hidden xl:table-cell">
                          {item.mode || '-'}
                        </td>

                        {/* Actions */}
                        <td className="py-2 px-3 text-right">
                          <div className="flex items-center justify-end gap-1 opacity-80 group-hover:opacity-100">
                            {!item.isDir && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleOpenFileInEditor(item);
                                }}
                                className="p-1 rounded hover:bg-[#3ba9ff]/20 text-[#5eead4]"
                                title="Abrir no Editor"
                              >
                                <FileCode className="w-3.5 h-3.5" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                copyToClipboard(item.path);
                              }}
                              className="p-1 rounded hover:bg-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff]"
                              title="Copiar caminho"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setModalType('rename');
                                setModalInput(item.name);
                              }}
                              className="p-1 rounded hover:bg-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#5eead4]"
                              title="Renomear"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedItem(item);
                                setModalType('delete');
                              }}
                              className="p-1 rounded hover:bg-[#ff5c7a]/20 text-[#7a92b8] hover:text-[#ff5c7a]"
                              title="Deletar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {hasMore && (
                    <tr>
                      <td colSpan={6} className="py-3 px-3 text-center bg-[#091322]/80">
                        <button
                          type="button"
                          onClick={() => setDisplayLimit((prev) => prev + 80)}
                          className="px-4 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/30 text-[#5eead4] border border-[#3ba9ff]/30 text-xs font-mono font-bold transition-all cursor-pointer inline-flex items-center gap-2"
                        >
                          <span>Carregar mais (+80 itens)</span>
                          <span className="text-[10px] text-[#7a92b8]">
                            ({visibleItems.length} de {displayItems.length})
                          </span>
                        </button>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          ) : (
            /* Grid View */
            <div className="flex-1 overflow-auto p-4 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
              {visibleItems.map((item) => {
                const isSelected = selectedItem?.path === item.path;
                return (
                  <div
                    key={item.path}
                    onClick={() => handleItemClick(item)}
                    onDoubleClick={() => handleItemDoubleClick(item)}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer group ${
                      isSelected
                        ? 'bg-[#3ba9ff]/20 border-[#5eead4] shadow-[0_0_15px_rgba(94,234,212,0.2)]'
                        : 'bg-[#0a1628]/60 border-[#3ba9ff]/15 hover:bg-[#3ba9ff]/10 hover:border-[#3ba9ff]/40'
                    }`}
                  >
                    <div className="p-3 rounded-lg bg-[#070e1c] mb-2 group-hover:scale-105 transition-transform">
                      {item.isDir ? (
                        <Folder className="w-8 h-8 text-[#3ba9ff]" />
                      ) : (
                        <FileCode className="w-8 h-8 text-[#5eead4]" />
                      )}
                    </div>
                    <span className="font-mono text-xs text-[#e6f0ff] group-hover:text-[#5eead4] truncate w-full px-1">
                      {item.name}
                    </span>
                    <span className="text-[10px] text-[#7a92b8] font-mono mt-0.5">
                      {item.isDir ? 'Pasta' : formatBytes(item.size)}
                    </span>
                  </div>
                );
              })}
              {hasMore && (
                <div className="col-span-full flex justify-center py-4">
                  <button
                    type="button"
                    onClick={() => setDisplayLimit((prev) => prev + 80)}
                    className="px-4 py-2 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/30 text-[#5eead4] border border-[#3ba9ff]/30 text-xs font-mono font-bold transition-all cursor-pointer inline-flex items-center gap-2"
                  >
                    <span>Carregar mais (+80 itens)</span>
                    <span className="text-[10px] text-[#7a92b8]">
                      ({visibleItems.length} de {displayItems.length})
                    </span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 4. Bottom Status Bar */}
      <div className="py-1.5 px-3 bg-[#0a1426] border-t border-[#3ba9ff]/15 text-[11px] text-[#7a92b8] flex items-center justify-between font-mono shrink-0">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-[#5eead4] inline-block animate-pulse" />
            {mode === 'remote' ? 'Servidor VPS Conectado' : 'Modo Navegador Nativo'}
          </span>
          <span>•</span>
          <span>
            {displayItems.length} itens {hasMore ? `(${visibleItems.length} visíveis)` : ''}
          </span>
          {selectedItem && (
            <>
              <span>•</span>
              <span className="text-[#5eead4] truncate max-w-[200px]">
                {selectedItem.name} ({selectedItem.isDir ? 'Pasta' : formatBytes(selectedItem.size)})
              </span>
            </>
          )}
        </div>

        <div className="flex items-center gap-2">
          {copiedToast && (
            <span className="text-[#5eead4] flex items-center gap-1 bg-[#5eead4]/15 px-2 py-0.5 rounded border border-[#5eead4]/30">
              <Check className="w-3 h-3" />
              {copiedToast}
            </span>
          )}
          <span className="text-[10px] opacity-75">Duplo clique abre no Degrau 0</span>
        </div>
      </div>

      {/* 5. Modal Dialogs (New File, New Folder, Rename, Delete) */}
      {modalType && (
        <div className="fixed inset-0 z-50 bg-[#050810]/75 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#0a162b] border border-[#3ba9ff]/30 rounded-2xl shadow-[0_0_40px_rgba(59,169,255,0.25)] p-5">
            <h3 className="text-sm font-bold text-[#e6f0ff] mb-2 flex items-center gap-2">
              {modalType === 'new-file' && <FileCode className="w-4 h-4 text-[#5eead4]" />}
              {modalType === 'new-folder' && <Folder className="w-4 h-4 text-[#3ba9ff]" />}
              {modalType === 'rename' && <Edit2 className="w-4 h-4 text-[#6ea8ff]" />}
              {modalType === 'delete' && <Trash2 className="w-4 h-4 text-[#ff5c7a]" />}
              <span>
                {modalType === 'new-file' && 'Criar Novo Arquivo'}
                {modalType === 'new-folder' && 'Criar Nova Pasta'}
                {modalType === 'rename' && 'Renomear Item'}
                {modalType === 'delete' && 'Confirmar Exclusão'}
              </span>
            </h3>

            {modalType === 'delete' ? (
              <p className="text-xs text-[#7a92b8] mb-4">
                Tem certeza que deseja excluir permanentemente{' '}
                <span className="font-mono text-[#ff5c7a] font-semibold">{selectedItem?.name}</span>?
                Esta operação não pode ser desfeita.
              </p>
            ) : (
              <form onSubmit={handleModalSubmit} className="mb-4">
                <label className="text-[11px] text-[#7a92b8] block mb-1">Nome:</label>
                <input
                  type="text"
                  value={modalInput}
                  onChange={(e) => setModalInput(e.target.value)}
                  autoFocus
                  placeholder={modalType === 'new-file' ? 'exemplo.ts' : 'minha-pasta'}
                  className="w-full px-3 py-2 bg-[#070e1c] border border-[#3ba9ff]/30 rounded-lg text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
                />
              </form>
            )}

            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => setModalType(null)}
                className="px-3 py-1.5 rounded-lg text-xs text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/10 transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleModalSubmit}
                className={`px-4 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  modalType === 'delete'
                    ? 'bg-[#ff5c7a] hover:bg-[#ff3b60] text-white shadow-[0_0_15px_rgba(255,92,122,0.4)]'
                    : 'bg-[#3ba9ff] hover:bg-[#5eead4] text-[#050810] shadow-[0_0_15px_rgba(59,169,255,0.4)]'
                }`}
              >
                {modalType === 'delete' ? 'Excluir' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
