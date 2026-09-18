import { create } from 'zustand';
import { FSFileNode } from '../types';
import {
  countFiles,
  formatBytes,
  isFSSupported,
  MOCK_FILE_CONTENTS,
  MOCK_PROJECT_TREE,
  readDirectoryRecursive,
  readFileContent,
} from '../lib/fs';
import {
  clearDirectoryHandle,
  loadDirectoryHandle,
  saveDirectoryHandle,
} from '../lib/idb';
import {
  adapterManager,
  FSNodeItem,
  FSAdapterRoot,
  RemoteServerConfig,
} from '../lib/adapters';

export interface TabInfo {
  id: string;
  path: string;
  history: string[];
  historyIndex: number;
  filter: string;
}

interface FSStoreState {
  // Mode & connection
  mode: 'local' | 'remote';
  isRemoteAvailable: boolean;
  remoteConfig: RemoteServerConfig;
  roots: FSAdapterRoot[];
  activeRootPath: string;

  // Navigation & 1Panel-style explorer state
  currentPath: string;
  currentItems: FSNodeItem[];
  tabs: TabInfo[];
  activeTabId: string;
  favorites: string[];

  // Display & filtering
  viewMode: 'list' | 'grid';
  showHidden: boolean;
  sortBy: 'name' | 'size' | 'mtime' | 'type';
  sortOrder: 'asc' | 'desc';
  filterQuery: string;

  // Search
  searchQuery: string;
  isSearching: boolean;
  searchResults: FSNodeItem[];

  // Legacy & compatibility
  dirHandle: FileSystemDirectoryHandle | null;
  directoryName: string;
  rootNodes: FSFileNode[];
  isLoading: boolean;
  isUsingMock: boolean;
  totalFiles: number;
  errorMessage: string | null;

  // Actions
  initFS: () => Promise<void>;
  switchMode: (mode: 'local' | 'remote') => Promise<void>;
  updateServerSettings: (config: Partial<RemoteServerConfig>) => Promise<boolean>;
  navigateTo: (targetPath: string) => Promise<void>;
  goBack: () => Promise<void>;
  goForward: () => Promise<void>;
  goUp: () => Promise<void>;
  goHome: () => Promise<void>;
  refreshCurrentDir: () => Promise<void>;
  refreshTree: () => Promise<void>;

  // Tab management
  addTab: (path?: string) => void;
  closeTab: (tabId: string) => void;
  switchTab: (tabId: string) => void;

  // Display toggles
  setViewMode: (mode: 'list' | 'grid') => void;
  setShowHidden: (show: boolean) => void;
  setSort: (sortBy: 'name' | 'size' | 'mtime' | 'type') => void;
  setFilterQuery: (query: string) => void;

  // Search
  executeSearch: (query: string) => Promise<void>;
  clearSearch: () => void;

  // Favorites
  toggleFavorite: (path: string) => Promise<void>;

  // FS Modifications
  createNewFile: (fileName: string, content?: string) => Promise<boolean>;
  createNewFolder: (folderName: string) => Promise<boolean>;
  renameEntry: (fromPath: string, newName: string) => Promise<boolean>;
  deleteEntry: (targetPath: string) => Promise<boolean>;

  // Legacy file picker
  openDirectoryPicker: () => Promise<boolean>;
  loadMockWorkspace: () => void;
  getFileContent: (node: { path: string; name: string; size?: number; handle?: any }) => Promise<{
    content: string;
    isBinary: boolean;
    size: number;
  }>;
  disconnectDirectory: () => Promise<void>;
}

export const useFSStore = create<FSStoreState>((set, get) => ({
  mode: 'remote',
  isRemoteAvailable: false,
  remoteConfig: { baseUrl: '', token: '' },
  roots: [],
  activeRootPath: '/',

  currentPath: '/',
  currentItems: [],
  tabs: [{ id: 'tab-1', path: '/', history: ['/'], historyIndex: 0, filter: '' }],
  activeTabId: 'tab-1',
  favorites: [],

  viewMode: 'list',
  showHidden: false,
  sortBy: 'name',
  sortOrder: 'asc',
  filterQuery: '',

  searchQuery: '',
  isSearching: false,
  searchResults: [],

  dirHandle: null,
  directoryName: 'Nebula Filesystem',
  rootNodes: MOCK_PROJECT_TREE,
  isLoading: false,
  isUsingMock: false,
  totalFiles: 0,
  errorMessage: null,

  initFS: async () => {
    set({ isLoading: true });
    try {
      // 1. Initialize Adapter Manager
      const { mode, isConnected } = await adapterManager.init();
      const favs = await adapterManager.getFavorites();

      set({
        mode,
        isRemoteAvailable: isConnected,
        remoteConfig: adapterManager.getRemoteAdapter().getConfig(),
        favorites: favs,
      });

      const adapter = adapterManager.getAdapter();

      // 2. Fetch Roots
      let roots: FSAdapterRoot[] = [];
      try {
        roots = await adapter.getRoots();
      } catch (err) {
        console.warn('Could not fetch roots from adapter:', err);
      }

      if (roots.length === 0) {
        roots = [{ name: 'Raiz Principal', path: '/' }];
      }

      const initialPath = roots[0].path;

      // 3. Populate first directory
      let items: FSNodeItem[] = [];
      try {
        items = await adapter.listDirectory(initialPath);
      } catch (e) {
        console.warn('Could not list initial path:', e);
      }

      set({
        roots,
        activeRootPath: initialPath,
        currentPath: initialPath,
        currentItems: items,
        tabs: [{ id: 'tab-1', path: initialPath, history: [initialPath], historyIndex: 0, filter: '' }],
        directoryName: roots[0].name,
        isLoading: false,
        totalFiles: items.length,
      });
    } catch (err: any) {
      console.error('Failed to initialize filesystem store:', err);
      set({ isLoading: false, errorMessage: err.message || 'Falha ao inicializar' });
    }
  },

  switchMode: async (newMode: 'local' | 'remote') => {
    set({ isLoading: true });
    await adapterManager.setMode(newMode);
    set({ mode: newMode });

    const adapter = adapterManager.getAdapter();
    try {
      const roots = await adapter.getRoots();
      const path = roots[0]?.path || '/';
      const items = await adapter.listDirectory(path);

      set({
        roots: roots.length > 0 ? roots : [{ name: 'Raiz', path }],
        currentPath: path,
        currentItems: items,
        directoryName: roots[0]?.name || (newMode === 'remote' ? 'Servidor VPS' : 'Pasta Local'),
        isLoading: false,
      });
    } catch (e) {
      set({ isLoading: false });
    }
  },

  updateServerSettings: async (config: Partial<RemoteServerConfig>) => {
    const isConnected = await adapterManager.updateRemoteConfig(config);
    set({
      remoteConfig: adapterManager.getRemoteAdapter().getConfig(),
      isRemoteAvailable: isConnected,
    });
    if (isConnected && get().mode === 'remote') {
      await get().refreshCurrentDir();
    }
    return isConnected;
  },

  navigateTo: async (targetPath: string) => {
    const state = get();
    if (state.currentPath === targetPath && state.currentItems.length > 0) return;

    set({ isLoading: true, errorMessage: null });
    try {
      const adapter = adapterManager.getAdapter();
      const items = await adapter.listDirectory(targetPath);

      // Update active tab history
      const updatedTabs = state.tabs.map((tab) => {
        if (tab.id !== state.activeTabId) return tab;
        const newHistory = tab.history.slice(0, tab.historyIndex + 1);
        newHistory.push(targetPath);
        return {
          ...tab,
          path: targetPath,
          history: newHistory,
          historyIndex: newHistory.length - 1,
        };
      });

      set({
        currentPath: targetPath,
        currentItems: items,
        tabs: updatedTabs,
        totalFiles: items.length,
        isLoading: false,
      });
    } catch (err: any) {
      console.error(`Error navigating to ${targetPath}:`, err);
      set({
        isLoading: false,
        errorMessage: err.message || `Não foi possível abrir ${targetPath}`,
      });
    }
  },

  goBack: async () => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab || activeTab.historyIndex <= 0) return;

    const newIndex = activeTab.historyIndex - 1;
    const targetPath = activeTab.history[newIndex];

    set({ isLoading: true });
    try {
      const adapter = adapterManager.getAdapter();
      const items = await adapter.listDirectory(targetPath);

      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, path: targetPath, historyIndex: newIndex }
          : tab
      );

      set({
        currentPath: targetPath,
        currentItems: items,
        tabs: updatedTabs,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  goForward: async () => {
    const state = get();
    const activeTab = state.tabs.find((t) => t.id === state.activeTabId);
    if (!activeTab || activeTab.historyIndex >= activeTab.history.length - 1) return;

    const newIndex = activeTab.historyIndex + 1;
    const targetPath = activeTab.history[newIndex];

    set({ isLoading: true });
    try {
      const adapter = adapterManager.getAdapter();
      const items = await adapter.listDirectory(targetPath);

      const updatedTabs = state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, path: targetPath, historyIndex: newIndex }
          : tab
      );

      set({
        currentPath: targetPath,
        currentItems: items,
        tabs: updatedTabs,
        isLoading: false,
      });
    } catch {
      set({ isLoading: false });
    }
  },

  goUp: async () => {
    const state = get();
    const curr = state.currentPath.replace(/\/+$/, '');
    if (!curr || curr === '/' || curr === '.') return;

    const lastSlash = curr.lastIndexOf('/');
    const parent = lastSlash <= 0 ? '/' : curr.substring(0, lastSlash);
    await state.navigateTo(parent);
  },

  goHome: async () => {
    const state = get();
    const home = state.roots[0]?.path || '/';
    await state.navigateTo(home);
  },

  refreshCurrentDir: async () => {
    const state = get();
    set({ isLoading: true });
    try {
      const adapter = adapterManager.getAdapter();
      const items = await adapter.listDirectory(state.currentPath);
      set({
        currentItems: items,
        totalFiles: items.length,
        isLoading: false,
      });
    } catch (err: any) {
      set({ isLoading: false, errorMessage: err.message || 'Erro ao atualizar' });
    }
  },

  refreshTree: async () => {
    const state = get();
    await state.refreshCurrentDir();
    if (state.dirHandle) {
      try {
        const nodes = await readDirectoryRecursive(state.dirHandle);
        set({
          rootNodes: nodes,
          totalFiles: countFiles(nodes),
        });
      } catch (e) {
        console.warn('Erro ao atualizar árvore recursiva de arquivos:', e);
      }
    }
  },

  addTab: (path?: string) => {
    const state = get();
    if (state.tabs.length >= 7) return; // Limit to 7 tabs
    const targetPath = path || state.currentPath;
    const newId = `tab-${Date.now()}`;
    const newTab: TabInfo = {
      id: newId,
      path: targetPath,
      history: [targetPath],
      historyIndex: 0,
      filter: '',
    };
    set({
      tabs: [...state.tabs, newTab],
      activeTabId: newId,
    });
    get().navigateTo(targetPath);
  },

  closeTab: (tabId: string) => {
    const state = get();
    if (state.tabs.length <= 1) return; // keep at least 1 tab
    const filtered = state.tabs.filter((t) => t.id !== tabId);
    let nextActive = state.activeTabId;
    if (state.activeTabId === tabId) {
      nextActive = filtered[filtered.length - 1].id;
    }
    set({
      tabs: filtered,
      activeTabId: nextActive,
    });
    const activeTab = filtered.find((t) => t.id === nextActive);
    if (activeTab) {
      get().navigateTo(activeTab.path);
    }
  },

  switchTab: (tabId: string) => {
    const state = get();
    const target = state.tabs.find((t) => t.id === tabId);
    if (!target) return;
    set({ activeTabId: tabId });
    get().navigateTo(target.path);
  },

  setViewMode: (mode) => set({ viewMode: mode }),
  setShowHidden: (show) => set({ showHidden: show }),
  setSort: (sortBy) => {
    const current = get().sortBy;
    const currentOrder = get().sortOrder;
    if (current === sortBy) {
      set({ sortOrder: currentOrder === 'asc' ? 'desc' : 'asc' });
    } else {
      set({ sortBy, sortOrder: 'asc' });
    }
  },
  setFilterQuery: (query) => set({ filterQuery: query }),

  executeSearch: async (query: string) => {
    if (!query || !query.trim()) {
      get().clearSearch();
      return;
    }
    set({ isSearching: true, searchQuery: query });
    try {
      const adapter = adapterManager.getAdapter();
      const results = await adapter.search(get().currentPath, query.trim());
      set({
        searchResults: results,
        isSearching: false,
      });
    } catch (err) {
      set({ isSearching: false, searchResults: [] });
    }
  },

  clearSearch: () => {
    set({ searchQuery: '', searchResults: [], isSearching: false });
  },

  toggleFavorite: async (path: string) => {
    const currentFavs = get().favorites;
    let nextFavs: string[];
    if (currentFavs.includes(path)) {
      nextFavs = currentFavs.filter((p) => p !== path);
    } else {
      nextFavs = [...currentFavs, path];
    }
    set({ favorites: nextFavs });
    await adapterManager.saveFavorites(nextFavs);
  },

  createNewFile: async (fileName: string, content = '') => {
    const state = get();
    const cleanPath = state.currentPath.replace(/\/+$/, '');
    const fullPath = `${cleanPath}/${fileName.trim()}`;
    try {
      const adapter = adapterManager.getAdapter();
      await adapter.writeFile(fullPath, content);
      await state.refreshCurrentDir();
      return true;
    } catch (err: any) {
      console.error('Error creating file:', err);
      set({ errorMessage: err.message || 'Falha ao criar arquivo' });
      return false;
    }
  },

  createNewFolder: async (folderName: string) => {
    const state = get();
    const cleanPath = state.currentPath.replace(/\/+$/, '');
    const fullPath = `${cleanPath}/${folderName.trim()}`;
    try {
      const adapter = adapterManager.getAdapter();
      await adapter.createDirectory(fullPath);
      await state.refreshCurrentDir();
      return true;
    } catch (err: any) {
      console.error('Error creating folder:', err);
      set({ errorMessage: err.message || 'Falha ao criar pasta' });
      return false;
    }
  },

  renameEntry: async (fromPath: string, newName: string) => {
    const state = get();
    const parentDir = fromPath.substring(0, fromPath.lastIndexOf('/'));
    const toPath = `${parentDir}/${newName.trim()}`;
    try {
      const adapter = adapterManager.getAdapter();
      await adapter.rename(fromPath, toPath);
      await state.refreshCurrentDir();
      return true;
    } catch (err: any) {
      console.error('Error renaming:', err);
      set({ errorMessage: err.message || 'Falha ao renomear' });
      return false;
    }
  },

  deleteEntry: async (targetPath: string) => {
    const state = get();
    try {
      const adapter = adapterManager.getAdapter();
      await adapter.delete(targetPath);
      await state.refreshCurrentDir();
      return true;
    } catch (err: any) {
      console.error('Error deleting:', err);
      set({ errorMessage: err.message || 'Falha ao deletar' });
      return false;
    }
  },

  openDirectoryPicker: async () => {
    if (!isFSSupported) {
      set({
        errorMessage: 'Seu navegador não suporta a File System Access API nativa.',
      });
      return false;
    }

    try {
      set({ isLoading: true, errorMessage: null });
      // @ts-expect-error showDirectoryPicker is standard on window
      const handle: FileSystemDirectoryHandle = await window.showDirectoryPicker({
        mode: 'readwrite',
      });

      if (!handle) {
        set({ isLoading: false });
        return false;
      }

      await saveDirectoryHandle(handle);
      adapterManager.getLocalAdapter().setRootHandle(handle, handle.name);
      await adapterManager.setMode('local');

      const nodes = await readDirectoryRecursive(handle);
      const items = await adapterManager.getLocalAdapter().listDirectory('/');

      set({
        mode: 'local',
        dirHandle: handle,
        directoryName: handle.name,
        rootNodes: nodes,
        roots: [{ name: handle.name, path: '/' }],
        currentPath: '/',
        currentItems: items,
        isUsingMock: false,
        totalFiles: countFiles(nodes),
        isLoading: false,
      });

      return true;
    } catch (err: unknown) {
      const error = err as Error;
      if (error.name === 'AbortError') {
        set({ isLoading: false });
        return false;
      }
      set({
        isLoading: false,
        errorMessage: 'Falha ao abrir pasta local.',
      });
      return false;
    }
  },

  loadMockWorkspace: () => {
    set({
      dirHandle: null,
      directoryName: 'Exemplo: Nebula Workspace',
      rootNodes: MOCK_PROJECT_TREE,
      isUsingMock: true,
      totalFiles: countFiles(MOCK_PROJECT_TREE),
      errorMessage: null,
    });
  },

  getFileContent: async (node) => {
    try {
      const adapter = adapterManager.getAdapter();
      const res = await adapter.readFile(node.path);
      return {
        content: res.content,
        isBinary: res.isBinary,
        size: res.size,
      };
    } catch (err) {
      // Fallback
      if (node.handle) {
        return await readFileContent(node.handle);
      }
      const fallback = MOCK_FILE_CONTENTS[node.path] || `// Conteúdo: ${node.name}`;
      return {
        content: fallback,
        isBinary: false,
        size: node.size || fallback.length,
      };
    }
  },

  disconnectDirectory: async () => {
    await clearDirectoryHandle();
    get().loadMockWorkspace();
  },
}));
