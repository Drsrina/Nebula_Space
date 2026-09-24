import { create } from 'zustand';
import { SpatialLayoutPreset } from '../types';
import { useWindowsStore } from './useWindowsStore';
import { useCanvasStore } from './useCanvasStore';

const STORAGE_KEY = 'nebula-layout-presets-v1';

export const BUILTIN_PRESETS: SpatialLayoutPreset[] = [
  {
    id: 'preset-coding',
    name: 'Coding',
    description: 'Editor no D0, Diff no D1, Git & Versionamento no D2',
    icon: 'code',
    isBuiltIn: true,
    windows: [
      {
        type: 'editor',
        title: 'Editor de Código',
        depth: 0,
        x: -450,
        y: -310,
        width: 900,
        height: 640,
      },
      {
        type: 'diff',
        title: 'Diff Viewer',
        depth: 1,
        x: -400,
        y: -270,
        width: 800,
        height: 560,
      },
      {
        type: 'git-panel',
        title: 'Git & Versionamento',
        depth: 2,
        x: -380,
        y: -250,
        width: 760,
        height: 520,
      },
    ],
    camera: { x: 0, y: 0, z: 0 },
  },
  {
    id: 'preset-review-notes',
    name: 'Review / Notes',
    description: 'Duas notas lado a lado no D0, File Browser no D1',
    icon: 'book-open',
    isBuiltIn: true,
    windows: [
      {
        type: 'note',
        title: 'Anotações de Design 🎨',
        depth: 0,
        x: -520,
        y: -280,
        width: 500,
        height: 580,
        payload: {
          noteId: 'note-design',
          title: 'Anotações de Design 🎨',
          markdownContent: `# Anotações de Design & Arquitetura 🎨\n\n- [x] Canvas 3D com 3 degraus de profundidade (D0, D1, D2)\n- [x] Presets espaciais com transição fluida\n- [x] Git & Versionamento multi-repositório estilo GitHub Desktop`,
        },
      },
      {
        type: 'note',
        title: 'Roadmap v2.8.0 🚀',
        depth: 0,
        x: 10,
        y: -280,
        width: 500,
        height: 580,
        payload: {
          noteId: 'note-roadmap',
          title: 'Roadmap v2.8.0 🚀',
          markdownContent: `# Roadmap v2.8.0 🚀\n\n- [x] Terminal Interativo real no container\n- [x] Git Sync remoto (Push, Pull, Fetch) com PAT\n- [x] Conexão com GitHub, GitLab e Forgejo\n- [x] Presets espaciais D0/D1/D2`,
        },
      },
      {
        type: 'file-browser',
        title: 'Arquivos do Workspace',
        depth: 1,
        x: -360,
        y: -250,
        width: 720,
        height: 520,
      },
    ],
    camera: { x: 0, y: 0, z: 0 },
  },
  {
    id: 'preset-fullstack',
    name: 'Full Stack & Ops',
    description: 'Editor + Terminal no D0, Task Runner + Docker no D1, Git no D2',
    icon: 'layers',
    isBuiltIn: true,
    windows: [
      {
        type: 'editor',
        title: 'Editor de Código',
        depth: 0,
        x: -560,
        y: -290,
        width: 620,
        height: 600,
      },
      {
        type: 'terminal',
        title: 'Terminal Interativo',
        depth: 0,
        x: 80,
        y: -290,
        width: 520,
        height: 600,
      },
      {
        type: 'task-runner',
        title: 'Task Runner',
        depth: 1,
        x: -460,
        y: -260,
        width: 480,
        height: 520,
      },
      {
        type: 'docker-monitor',
        title: 'Docker Monitor',
        depth: 1,
        x: 40,
        y: -260,
        width: 440,
        height: 520,
      },
      {
        type: 'git-panel',
        title: 'Git & Versionamento',
        depth: 2,
        x: -360,
        y: -240,
        width: 720,
        height: 500,
      },
    ],
    camera: { x: 0, y: 0, z: 0 },
  },
  {
    id: 'preset-zen',
    name: 'Zen / Foco Total',
    description: 'Apenas Editor centralizado no Degrau 0',
    icon: 'sparkles',
    isBuiltIn: true,
    windows: [
      {
        type: 'editor',
        title: 'Editor de Código',
        depth: 0,
        x: -480,
        y: -310,
        width: 960,
        height: 640,
      },
    ],
    camera: { x: 0, y: 0, z: 0 },
  },
];

interface LayoutPresetsState {
  presets: SpatialLayoutPreset[];
  activePresetId: string | null;
  loadPresets: () => void;
  applyPreset: (presetId: string) => boolean;
  saveCurrentAsPreset: (name: string, description?: string) => string;
  deletePreset: (presetId: string) => boolean;
}

export const useLayoutPresetsStore = create<LayoutPresetsState>((set, get) => ({
  presets: [...BUILTIN_PRESETS],
  activePresetId: 'preset-coding',

  loadPresets: () => {
    if (typeof localStorage === 'undefined') {
      set({ presets: [...BUILTIN_PRESETS] });
      return;
    }
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed: SpatialLayoutPreset[] = JSON.parse(saved);
        const customs = parsed.filter((p) => !p.isBuiltIn);
        set({ presets: [...BUILTIN_PRESETS, ...customs] });
        return;
      }
    } catch (err) {
      console.warn('Erro ao carregar presets:', err);
    }
    set({ presets: [...BUILTIN_PRESETS] });
  },

  applyPreset: (presetId: string) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (!preset) return false;

    const windowsStore = useWindowsStore.getState();
    const canvasStore = useCanvasStore.getState();

    // Clear all existing windows
    const currentWindows = [...windowsStore.windows];
    for (const w of currentWindows) {
      windowsStore.closeWindow(w.id);
    }

    // Spawn preset windows
    for (const winSpec of preset.windows) {
      const newId = windowsStore.openWindow(
        winSpec.type,
        winSpec.payload || {},
        winSpec.depth
      );
      if (newId) {
        windowsStore.updateWindowPosition(newId, winSpec.x, winSpec.y);
        windowsStore.resizeWindow(newId, winSpec.width, winSpec.height);
      }
    }

    // Reset camera to focus (0, 0, 0)
    canvasStore.resetCamera();
    canvasStore.jumpToDepthPlane(0);

    set({ activePresetId: presetId });
    return true;
  },

  saveCurrentAsPreset: (name: string, description = 'Layout salvo pelo usuário') => {
    const windowsStore = useWindowsStore.getState();
    const currentWindows = windowsStore.windows.filter((w) => !w.isMinimized);

    const presetWindows = currentWindows.map((w) => ({
      type: w.type,
      title: w.title,
      depth: w.depth,
      x: w.x,
      y: w.y,
      width: w.width,
      height: w.height,
      payload: w.payload,
    }));

    const newPreset: SpatialLayoutPreset = {
      id: `preset-custom-${Date.now()}`,
      name: name.trim() || `Layout ${new Date().toLocaleTimeString()}`,
      description: description.trim(),
      isBuiltIn: false,
      windows: presetWindows,
      camera: { x: 0, y: 0, z: 0 },
    };

    const updated = [...get().presets, newPreset];
    set({ presets: updated, activePresetId: newPreset.id });

    if (typeof localStorage !== 'undefined') {
      try {
        const customs = updated.filter((p) => !p.isBuiltIn);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
      } catch (err) {
        console.warn('Erro ao salvar preset:', err);
      }
    }

    return newPreset.id;
  },

  deletePreset: (presetId: string) => {
    const preset = get().presets.find((p) => p.id === presetId);
    if (!preset || preset.isBuiltIn) return false;

    const updated = get().presets.filter((p) => p.id !== presetId);
    set({
      presets: updated,
      activePresetId: get().activePresetId === presetId ? null : get().activePresetId,
    });

    if (typeof localStorage !== 'undefined') {
      try {
        const customs = updated.filter((p) => !p.isBuiltIn);
        localStorage.setItem(STORAGE_KEY, JSON.stringify(customs));
      } catch (err) {
        console.warn('Erro ao deletar preset:', err);
      }
    }

    return true;
  },
}));
