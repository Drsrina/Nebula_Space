import { create } from 'zustand';
import { DepthLevel, FilePreviewPayload, NotePayload, WindowData, WindowType } from '../types';
import { clearAllWindowsStorage, loadNotesFromStorage, loadWindowsFromStorage, saveNotesToStorage, saveWindowsToStorage } from '../lib/idb';
import { useCanvasStore } from './useCanvasStore';

let debounceSaveTimer: ReturnType<typeof setTimeout> | null = null;
function debouncedSaveWindowsToStorage(windows: WindowData[], delayMs = 500) {
  if (debounceSaveTimer) clearTimeout(debounceSaveTimer);
  debounceSaveTimer = setTimeout(() => {
    saveWindowsToStorage(windows);
    debounceSaveTimer = null;
  }, delayMs);
}

interface WindowsStoreState {
  windows: WindowData[];
  activeWindowId: string | null;
  maxZIndex: number;
  isInitialized: boolean;
  snapEnabled: boolean;

  // Actions
  initWindows: () => Promise<void>;
  setSnapEnabled: (enabled: boolean) => void;
  openWindow: (type: WindowType, payload?: WindowData['payload'], targetDepth?: DepthLevel) => string;
  openDuplicateWindow: (sourceId: string) => string | null;
  closeWindow: (id: string) => void;
  toggleMinimizeWindow: (id: string) => void;
  bringToFront: (id: string) => void;
  updateWindowPosition: (id: string, x: number, y: number) => void;
  setWindowDepth: (id: string, depth: DepthLevel) => void;
  resizeWindow: (id: string, width: number, height: number) => void;
  updateWindowPayload: (id: string, payload: Partial<WindowData['payload']>) => void;
  openFilePreview: (payload: FilePreviewPayload) => void;
  createNote: (targetDepth?: DepthLevel, title?: string, content?: string) => string;
  resetLayout: () => void;
  pinWindow: (id: string) => void;
  unpinWindow: (id: string) => void;
  maximizeWindow: (id: string) => void;
  restoreWindow: (id: string) => void;
  // ── v2.6: Snap Groups ────────────────────────────────────────────────────
  snapWindows: (id: string, targetId: string, snapX: number, snapY: number) => void;
  unsnapWindow: (id: string) => void;
  moveSnapGroup: (groupId: string, dx: number, dy: number, excludeId: string) => void;
  // ── v2.6: Pop-out ────────────────────────────────────────────────────────
  markPopped: (id: string, popped: boolean) => void;
  // ── v2.6: Count helpers ──────────────────────────────────────────────────
  countWindowsOfType: (type: WindowType) => number;
}

const DEFAULT_WINDOWS: WindowData[] = [
  {
    id: 'win-tree-main',
    title: 'Navegador de Arquivos',
    type: 'file-tree',
    depth: 1, // Degrau 1 (Contexto Z = -400px)
    x: -520,
    y: -260,
    width: 320,
    height: 540,
    zIndex: 10,
    payload: {},
  },
  {
    id: 'win-editor-main',
    title: 'Editor: index.ts',
    type: 'editor',
    depth: 0, // Degrau 0 (Foco Z = 0px)
    x: -160,
    y: -260,
    width: 680,
    height: 540,
    zIndex: 25,
    payload: {},
  },
  {
    id: 'win-git-main',
    title: 'Git & Versionamento',
    type: 'git-panel',
    depth: 1, // Degrau 1 (Contexto Z = -400px)
    x: 550,
    y: -260,
    width: 440,
    height: 540,
    zIndex: 12,
    payload: {},
  },
  {
    id: 'win-note-ideias',
    title: 'Nota: Ideias Espaciais',
    type: 'note',
    depth: 2, // Degrau 2 (Arquivo / Referência Z = -700px)
    x: 160,
    y: -140,
    width: 420,
    height: 480,
    zIndex: 5,
    payload: {
      noteId: 'note-default-1',
      title: 'Ideias Espaciais',
      markdownContent: `# Ideias & Referências 📌\n\n- [x] Canvas 3D com 3 degraus de profundidade (0, -400, -700)\n- [x] Monaco Editor Notepad++ com multi-tabs\n- [x] Git Local com Stage / Unstage / Commit / Branches\n- [x] Diff viewer side-by-side e unified com neon styling\n- [x] Integração com instâncias Forgejo / Gitea / Codeberg\n\n*Esta nota vive no Degrau 2 (Arquivo/Referência).*`,
    },
  },
  {
    id: 'win-note-tutorial',
    title: 'Nota: Tutorial Automação & Logs',
    type: 'note',
    depth: 2, // Degrau 2 (Arquivo / Referência Z = -700px)
    x: -320,
    y: -140,
    width: 440,
    height: 480,
    zIndex: 4,
    payload: {
      noteId: 'note-tutorial-1',
      title: 'Tutorial Automação & Logs',
      markdownContent: `# ⚡ Automação & Timestamp Logger\n\nCriamos o script \`scripts/timestamp_logger.py\` de exemplo para novos usuários!\n\n### 1. Task Runner:\nAbra a janela **Tarefas & Scripts** e vá na aba **Autodescobertos** para rodar o script em 1 clique.\n\n### 2. Crontab:\nAbra a janela **Crontab** para agendar a execução periódica do script (ex: \`python scripts/timestamp_logger.py\`).\n\n### 3. Mini-Workflows:\nCrie fluxos visuais conectando gatilhos a nós de código e requisições HTTP!`,
    },
  },
];

export const useWindowsStore = create<WindowsStoreState>((set, get) => ({
  windows: DEFAULT_WINDOWS,
  activeWindowId: 'win-editor-main',
  maxZIndex: 30,
  isInitialized: false,

  initWindows: async () => {
    try {
      const stored = await loadWindowsFromStorage();
      if (stored && stored.length > 0) {
        set({
          windows: stored,
          activeWindowId: stored[0]?.id ?? null,
          isInitialized: true,
        });
        return;
      }
    } catch (err) {
      console.warn('Could not load windows from storage:', err);
    }

    // Default initialization
    set({
      windows: DEFAULT_WINDOWS,
      activeWindowId: 'win-editor-main',
      isInitialized: true,
    });
  },

  snapEnabled: typeof localStorage !== 'undefined' ? localStorage.getItem('nebula_snap_enabled') !== 'false' : true,
  setSnapEnabled: (enabled: boolean) => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nebula_snap_enabled', String(enabled));
    }
    set({ snapEnabled: enabled });
  },

  bringToFront: (id: string) => {
    const state = get();
    const nextZ = state.maxZIndex + 1;
    set({
      activeWindowId: id,
      maxZIndex: nextZ,
      windows: state.windows.map((w) => (w.id === id ? { ...w, zIndex: nextZ } : w)),
    });
  },

  openWindow: (type, payload = {}, targetDepth) => {
    const state = get();
    const id = `win-${type}-${Date.now()}`;
    const nextZ = state.maxZIndex + 1;

    const canvasState = useCanvasStore.getState();
    const currentCamera = canvasState.camera;
    // Padronizar spawn de novas janelas no Degrau 0
    const depth: DepthLevel = targetDepth !== undefined ? targetDepth : 0;

    let defaultWidth = 420;
    let defaultHeight = 480;
    let defaultTitle = 'Janela';

    // Count existing windows of this type for instance badge
    const existingCount = state.windows.filter((w) => w.type === type).length;
    const instanceSuffix = existingCount > 0 ? ` #${existingCount + 1}` : '';

    if (type === 'file-tree' || type === 'file-browser') {
      defaultWidth = 320;
      defaultHeight = 540;
      defaultTitle = `Arquivos${instanceSuffix}`;
    } else if (type === 'editor') {
      defaultWidth = 720;
      defaultHeight = 540;
      defaultTitle = `Editor${instanceSuffix}`;
    } else if (type === 'git-panel') {
      defaultWidth = 460;
      defaultHeight = 540;
      defaultTitle = 'Git & Versionamento';
    } else if (type === 'diff') {
      defaultWidth = 760;
      defaultHeight = 500;
      defaultTitle = 'Diff Viewer';
    } else if (type === 'file-preview') {
      defaultWidth = 560;
      defaultHeight = 540;
      const previewPayload = payload as FilePreviewPayload;
      defaultTitle = previewPayload.fileName || 'Preview de Arquivo';
    } else if (type === 'note') {
      defaultWidth = 380;
      defaultHeight = 480;
      const notePayload = payload as NotePayload;
      defaultTitle = notePayload.title || 'Nova Nota';
    } else if (type === 'launcher') {
      defaultWidth = 460;
      defaultHeight = 360;
      defaultTitle = 'Nebula Launcher';
    } else if (type === 'terminal') {
      defaultWidth = 640;
      defaultHeight = 380;
      defaultTitle = `Terminal${instanceSuffix}`;
    } else if (type === 'ai-chat') {
      defaultWidth = 400;
      defaultHeight = 560;
      defaultTitle = 'Nebula AI';
    } else if (type === 'global-search') {
      defaultWidth = 520;
      defaultHeight = 520;
      defaultTitle = 'Busca Global no Workspace';
    } else if (type === 'task-runner') {
      defaultWidth = 560;
      defaultHeight = 500;
      defaultTitle = 'Painel de Tarefas (Scripts)';
    } else if (type === 'graph') {
      defaultWidth = 640;
      defaultHeight = 520;
      defaultTitle = 'Graph — Mapa de Conexões';
    } else if (type === 'docker-monitor') {
      defaultWidth = 620;
      defaultHeight = 540;
      defaultTitle = 'Docker Monitor';
    } else if (type === 'settings-global') {
      defaultWidth = 720;
      defaultHeight = 560;
      defaultTitle = 'Configurações Globais';
    } else if (type === 'login') {
      defaultWidth = 400;
      defaultHeight = 480;
      defaultTitle = 'Autenticação';
    }
    // ── v2.6 Window Types ─────────────────────────────────────────────────
    else if (type === 'workflow') {
      defaultWidth = 800;
      defaultHeight = 580;
      defaultTitle = `Workflow${instanceSuffix}`;
    } else if (type === 'crontab') {
      defaultWidth = 640;
      defaultHeight = 520;
      defaultTitle = 'Crontab — Agendador';
    } else if (type === 'kanban') {
      defaultWidth = 760;
      defaultHeight = 540;
      defaultTitle = `Kanban${instanceSuffix}`;
    } else if (type === 'pdf-viewer') {
      defaultWidth = 620;
      defaultHeight = 580;
      defaultTitle = 'PDF / Imagem';
    } else if (type === 'web-embed') {
      defaultWidth = 720;
      defaultHeight = 560;
      defaultTitle = `Web${instanceSuffix}`;
    } else if (type === 'api-client') {
      defaultWidth = 700;
      defaultHeight = 560;
      defaultTitle = `API Client${instanceSuffix}`;
    } else if (type === 'snippets') {
      defaultWidth = 420;
      defaultHeight = 500;
      defaultTitle = 'Snippets';
    } else if (type === 'live-preview') {
      defaultWidth = 900;
      defaultHeight = 560;
      defaultTitle = `Live Preview${instanceSuffix}`;
    }

    // Padronizar spawn de novas janelas em (0,0) do degrau 0
    const offset = (state.windows.length % 5) * 20;
    const newWindow: WindowData = {
      id,
      title: defaultTitle,
      type,
      depth,
      x: Math.round(-defaultWidth / 2 + offset),
      y: Math.round(-defaultHeight / 2 + offset),
      width: defaultWidth,
      height: defaultHeight,
      zIndex: nextZ,
      payload,
      instanceId: existingCount > 0 ? `${type}-${existingCount + 1}` : undefined,
    };

    const newWindows = [...state.windows, newWindow];
    set({
      windows: newWindows,
      activeWindowId: id,
      maxZIndex: nextZ,
    });

    saveWindowsToStorage(newWindows);
    return id;
  },

  openDuplicateWindow: (sourceId: string) => {
    const state = get();
    const source = state.windows.find((w) => w.id === sourceId);
    if (!source) return null;

    const id = `win-${source.type}-${Date.now()}`;
    const nextZ = state.maxZIndex + 1;
    const existingCount = state.windows.filter((w) => w.type === source.type).length;

    const duplicate: WindowData = {
      ...source,
      id,
      zIndex: nextZ,
      x: source.x + 32,
      y: source.y + 32,
      isMinimized: false,
      isMaximized: false,
      snapGroup: undefined,
      instanceId: `${source.type}-${existingCount + 1}`,
      title: source.title.replace(/ #\d+$/, '') + ` #${existingCount + 1}`,
    };

    const newWindows = [...state.windows, duplicate];
    set({ windows: newWindows, activeWindowId: id, maxZIndex: nextZ });
    saveWindowsToStorage(newWindows);
    return id;
  },

  openFilePreview: (payload: FilePreviewPayload) => {
    const state = get();
    // Check if a preview window with this path already exists
    const existing = state.windows.find(
      (w) => w.type === 'file-preview' && (w.payload as FilePreviewPayload)?.filePath === payload.filePath
    );

    if (existing) {
      // Bring existing to focus (Degrau 0) and activate
      get().setWindowDepth(existing.id, 0);
      get().bringToFront(existing.id);
      get().updateWindowPayload(existing.id, payload);
      return;
    }

    // Ensure any open FileTree stays or recedes to Degrau 1 as per design spec
    const updatedWindows = state.windows.map((w) => {
      if (w.type === 'file-tree' && w.depth === 0) {
        return { ...w, depth: 1 as DepthLevel };
      }
      return w;
    });

    const id = `win-preview-${Date.now()}`;
    const nextZ = state.maxZIndex + 1;
    const canvasState = useCanvasStore.getState();
    const currentCamera = canvasState.camera;
    const currentPlane = canvasState.currentDepthPlane ?? 0;

    const newWindow: WindowData = {
      id,
      title: payload.fileName,
      type: 'file-preview',
      depth: currentPlane,
      x: Math.round(-currentCamera.x - 580 / 2),
      y: Math.round(-currentCamera.y - 560 / 2 + 28),
      width: 580,
      height: 560,
      zIndex: nextZ,
      payload,
    };

    const nextWindows = [...updatedWindows, newWindow];
    set({
      windows: nextWindows,
      activeWindowId: id,
      maxZIndex: nextZ,
    });

    saveWindowsToStorage(nextWindows);
  },

  createNote: (targetDepth?: DepthLevel, title = 'Nova Nota', content = '# Nova Nota\n\nComece a escrever suas ideias aqui...') => {
    const noteId = `note-${Date.now()}`;
    const notePayload: NotePayload = {
      noteId,
      title,
      markdownContent: content,
    };

    return get().openWindow('note', notePayload, targetDepth);
  },

  closeWindow: (id: string) => {
    const newWindows = get().windows.filter((w) => w.id !== id);
    set({
      windows: newWindows,
      activeWindowId: newWindows.length > 0 ? newWindows[newWindows.length - 1].id : null,
    });
    saveWindowsToStorage(newWindows);
  },

  toggleMinimizeWindow: (id: string) => {
    const newWindows = get().windows.map((w) =>
      w.id === id ? { ...w, isMinimized: !w.isMinimized } : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  updateWindowPosition: (id: string, x: number, y: number) => {
    const newWindows = get().windows.map((w) => (w.id === id ? { ...w, x, y } : w));
    set({ windows: newWindows });
    debouncedSaveWindowsToStorage(newWindows);
  },

  setWindowDepth: (id: string, depth: DepthLevel) => {
    const newWindows = get().windows.map((w) => (w.id === id ? { ...w, depth } : w));
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  resizeWindow: (id: string, width: number, height: number) => {
    const minW = 280;
    const minH = 220;
    const newWindows = get().windows.map((w) =>
      w.id === id
        ? {
            ...w,
            width: Math.max(minW, width),
            height: Math.max(minH, height),
          }
        : w
    );
    set({ windows: newWindows });
    debouncedSaveWindowsToStorage(newWindows);
  },

  updateWindowPayload: (id: string, payload: Partial<WindowData['payload']>) => {
    const newWindows = get().windows.map((w) =>
      w.id === id ? { ...w, payload: { ...w.payload, ...payload } } : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  resetLayout: async () => {
    await clearAllWindowsStorage();
    set({
      windows: DEFAULT_WINDOWS,
      activeWindowId: 'win-editor-main',
      maxZIndex: 30,
    });
    saveWindowsToStorage(DEFAULT_WINDOWS);
  },

  pinWindow: (id: string) => {
    const newWindows = get().windows.map((w) =>
      w.id === id ? { ...w, isPinned: true } : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  unpinWindow: (id: string) => {
    const newWindows = get().windows.map((w) =>
      w.id === id ? { ...w, isPinned: false } : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  maximizeWindow: (id: string) => {
    const newWindows = get().windows.map((w) =>
      w.id === id
        ? { ...w, isMaximized: true, prevWidth: w.width, prevHeight: w.height }
        : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  restoreWindow: (id: string) => {
    const newWindows = get().windows.map((w) =>
      w.id === id
        ? {
            ...w,
            isMaximized: false,
            width: w.prevWidth ?? w.width,
            height: w.prevHeight ?? w.height,
          }
        : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  // ── v2.6: Snap Groups ────────────────────────────────────────────────────
  snapWindows: (id: string, targetId: string, snapX: number, snapY: number) => {
    const state = get();
    const source = state.windows.find((w) => w.id === id);
    const target = state.windows.find((w) => w.id === targetId);
    if (!source || !target) return;

    const groupId =
      source.snapGroup ?? target.snapGroup ?? `snap-${Date.now()}`;

    const newWindows = state.windows.map((w) => {
      if (w.id === id) return { ...w, x: snapX, y: snapY, snapGroup: groupId };
      if (w.id === targetId) return { ...w, snapGroup: groupId };
      return w;
    });
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  unsnapWindow: (id: string) => {
    const current = get().windows;
    const target = current.find((w) => w.id === id);
    if (!target || !target.snapGroup) return;

    const group = target.snapGroup;
    const othersInGroup = current.filter((w) => w.snapGroup === group && w.id !== id);

    // Calculate displacement away from the group beyond SNAP_THRESHOLD (40px)
    // so it doesn't immediately stick or re-snap on micro-movement
    let pushX = 0;
    let pushY = 0;
    if (othersInGroup.length > 0) {
      const avgOtherX =
        othersInGroup.reduce((sum, o) => sum + (o.x + o.width / 2), 0) /
        othersInGroup.length;
      const avgOtherY =
        othersInGroup.reduce((sum, o) => sum + (o.y + o.height / 2), 0) /
        othersInGroup.length;
      const targetCenterX = target.x + target.width / 2;
      const targetCenterY = target.y + target.height / 2;

      const dx = targetCenterX - avgOtherX;
      const dy = targetCenterY - avgOtherY;

      const SEPARATION = 60; // 60px > 40px SNAP_THRESHOLD
      if (Math.abs(dx) >= Math.abs(dy)) {
        pushX = dx >= 0 ? SEPARATION : -SEPARATION;
      } else {
        pushY = dy >= 0 ? SEPARATION : -SEPARATION;
      }
    } else {
      pushX = 60;
    }

    const newWindows = current.map((w) => {
      if (w.id === id) {
        return {
          ...w,
          x: w.x + pushX,
          y: w.y + pushY,
          snapGroup: undefined,
        };
      }
      // If only 1 other window remains in this group, it cannot form a group by itself
      if (othersInGroup.length === 1 && w.snapGroup === group) {
        return { ...w, snapGroup: undefined };
      }
      return w;
    });

    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  moveSnapGroup: (groupId: string, dx: number, dy: number, excludeId: string) => {
    const newWindows = get().windows.map((w) => {
      if (w.snapGroup === groupId && w.id !== excludeId) {
        return { ...w, x: w.x + dx, y: w.y + dy };
      }
      return w;
    });
    set({ windows: newWindows });
    debouncedSaveWindowsToStorage(newWindows);
  },

  // ── v2.6: Pop-out ────────────────────────────────────────────────────────
  markPopped: (id: string, popped: boolean) => {
    const newWindows = get().windows.map((w) =>
      w.id === id ? { ...w, isPopped: popped } : w
    );
    set({ windows: newWindows });
    saveWindowsToStorage(newWindows);
  },

  // ── v2.6: Count helpers ──────────────────────────────────────────────────
  countWindowsOfType: (type: WindowType) => {
    return get().windows.filter((w) => w.type === type).length;
  },
}));


