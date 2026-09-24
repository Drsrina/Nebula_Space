import { create } from 'zustand';
import { EditorTab } from '../types';
import { writeFileContent } from '../lib/fs';
import { useGitStore } from './useGitStore';
import { adapterManager } from '../lib/adapters';

export function detectLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  switch (ext) {
    case 'ts':
    case 'tsx':
      return 'typescript';
    case 'js':
    case 'jsx':
      return 'javascript';
    case 'json':
      return 'json';
    case 'css':
      return 'css';
    case 'html':
      return 'html';
    case 'md':
    case 'markdown':
      return 'markdown';
    case 'py':
      return 'python';
    case 'rs':
      return 'rust';
    case 'go':
      return 'go';
    case 'sh':
    case 'bash':
      return 'shell';
    case 'yaml':
    case 'yml':
      return 'yaml';
    case 'sql':
      return 'sql';
    default:
      return 'plaintext';
  }
}

interface EditorStoreState {
  tabs: EditorTab[];
  activeTabPath: string | null;
  cursorLine: number;
  cursorCol: number;
  wordWrap: boolean;
  minimap: boolean;
  fontSize: number;
  theme: string;
  showOutline: boolean;

  // Actions
  openFileInEditor: (file: {
    path: string;
    name: string;
    content: string;
    handle?: FileSystemFileHandle;
  }) => void;
  closeTab: (path: string) => void;
  setActiveTab: (path: string) => void;
  updateTabContent: (path: string, content: string) => void;
  saveActiveFile: () => Promise<boolean>;
  saveFileByPath: (path: string) => Promise<boolean>;
  setCursorPosition: (line: number, col: number) => void;
  toggleWordWrap: () => void;
  toggleMinimap: () => void;
  setFontSize: (size: number) => void;
  setTheme: (theme: string) => void;
  toggleOutline: () => void;
  closeOtherTabs: (keepPath: string) => void;
  closeAllTabs: () => void;
  revertFileByPath: (path: string) => void;
  saveFileAs: (currentPath: string, newPath: string) => Promise<boolean>;
}

const INITIAL_EDITOR_TABS: EditorTab[] = [
  {
    filePath: 'src/index.ts',
    fileName: 'index.ts',
    content: `// Nebula Spatial Workspace v0.2
// Powered by React + Vite + CSS 3D Preserve-3d

export interface WorkspaceConfig {
  name: string;
  planes: [0, 1, 2];
  focusZ: number;
  contextZ: number;
  archiveZ: number;
}

export const activeWorkspace: WorkspaceConfig = {
  name: 'Local Computer Core',
  planes: [0, 1, 2],
  focusZ: 0,
  contextZ: -400,
  archiveZ: -800,
};

console.log("Nebula system online: ready for spatial coding.");
`,
    savedContent: `// Nebula Spatial Workspace v0.2
// Powered by React + Vite + CSS 3D Preserve-3d

export interface WorkspaceConfig {
  name: string;
  planes: [0, 1, 2];
  focusZ: number;
  contextZ: number;
  archiveZ: number;
}

export const activeWorkspace: WorkspaceConfig = {
  name: 'Local Computer Core',
  planes: [0, 1, 2],
  focusZ: 0,
  contextZ: -400,
  archiveZ: -800,
};
`,
    isDirty: true,
    language: 'typescript',
    gitStatus: 'modified',
  },
  {
    filePath: 'notes/ideias.md',
    fileName: 'ideias.md',
    content: `# Nebula v0.2 - Spatial Engineering

- [x] Monaco Code Editor estilo Notepad++
- [x] Abas múltiplas e indicador dirty (*)
- [x] Painel Git local com Stage / Unstage / Commit / History
- [x] Diff viewer com realce neon
- [ ] Forgejo / Gitea synchronizer
`,
    savedContent: `# Nebula v0.2 - Spatial Engineering

- [x] Monaco Code Editor estilo Notepad++
- [x] Abas múltiplas e indicador dirty (*)
- [x] Painel Git local com Stage / Unstage / Commit / History
- [x] Diff viewer com realce neon
- [ ] Forgejo / Gitea synchronizer
`,
    isDirty: false,
    language: 'markdown',
    gitStatus: 'clean',
  },
];

export const useEditorStore = create<EditorStoreState>((set, get) => ({
  tabs: INITIAL_EDITOR_TABS,
  activeTabPath: 'src/index.ts',
  cursorLine: 1,
  cursorCol: 1,
  wordWrap: true,
  minimap: true,
  fontSize: 13,

  openFileInEditor: ({ path, name, content, handle }) => {
    const state = get();
    const existingIndex = state.tabs.findIndex((t) => t.filePath === path);

    if (existingIndex !== -1) {
      // Tab already open, just make it active
      set({ activeTabPath: path });
      return;
    }

    const lang = detectLanguage(name);
    const newTab: EditorTab = {
      filePath: path,
      fileName: name,
      content,
      savedContent: content,
      isDirty: false,
      language: lang,
      handle,
    };

    set({
      tabs: [...state.tabs, newTab],
      activeTabPath: path,
    });
  },

  closeTab: (path: string) => {
    const state = get();
    const tabToClose = state.tabs.find((t) => t.filePath === path);
    if (!tabToClose) return;

    const remaining = state.tabs.filter((t) => t.filePath !== path);
    let nextActive = state.activeTabPath;

    if (state.activeTabPath === path) {
      nextActive = remaining.length > 0 ? remaining[remaining.length - 1].filePath : null;
    }

    set({
      tabs: remaining,
      activeTabPath: nextActive,
    });
  },

  closeOtherTabs: (keepPath: string) => {
    const state = get();
    const keptTab = state.tabs.find((t) => t.filePath === keepPath);
    if (!keptTab) return;
    set({
      tabs: [keptTab],
      activeTabPath: keepPath,
    });
  },

  closeAllTabs: () => {
    set({
      tabs: [],
      activeTabPath: null,
    });
  },

  revertFileByPath: (path: string) => {
    const state = get();
    const tab = state.tabs.find((t) => t.filePath === path);
    if (!tab) return;
    set({
      tabs: state.tabs.map((t) =>
        t.filePath === path ? { ...t, content: t.savedContent, isDirty: false } : t
      ),
    });
    useGitStore.getState().notifyFileEdited(path, tab.savedContent);
  },

  setActiveTab: (path: string) => {
    set({ activeTabPath: path });
  },

  updateTabContent: (path: string, content: string) => {
    const state = get();
    const tab = state.tabs.find((t) => t.filePath === path);
    if (!tab) return;

    const isDirty = content !== tab.savedContent;

    set({
      tabs: state.tabs.map((t) =>
        t.filePath === path ? { ...t, content, isDirty } : t
      ),
    });

    // Notify Git store of the change
    useGitStore.getState().notifyFileEdited(path, content);
  },

  saveActiveFile: async () => {
    const activePath = get().activeTabPath;
    if (!activePath) return false;
    return await get().saveFileByPath(activePath);
  },

  saveFileByPath: async (path: string) => {
    const state = get();
    const tab = state.tabs.find((t) => t.filePath === path);
    if (!tab) return false;

    if (tab.handle) {
      try {
        const success = await writeFileContent(tab.handle, tab.content);
        if (!success) {
          console.error('Failed to write to file handle');
          return false;
        }
      } catch (err) {
        console.error('Save error:', err);
        return false;
      }
    } else {
      try {
        const adapter = adapterManager.getAdapter();
        await adapter.writeFile(path, tab.content);
      } catch (err) {
        console.error('Save error via adapter:', err);
        return false;
      }
    }

    // Mark as clean
    set({
      tabs: state.tabs.map((t) =>
        t.filePath === path ? { ...t, savedContent: t.content, isDirty: false } : t
      ),
    });

    // Dispatch decoupled custom event to notify listeners (FS tree refresh, preview update)
    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nebula_file_saved', {
          detail: { path, content: tab.content },
        })
      );
    }

    return true;
  },

  saveFileAs: async (currentPath: string, newPath: string) => {
    const state = get();
    const tab = state.tabs.find((t) => t.filePath === currentPath);
    if (!tab) return false;

    try {
      const adapter = adapterManager.getAdapter();
      await adapter.writeFile(newPath, tab.content);
    } catch (err) {
      console.error('SaveAs error via adapter:', err);
      return false;
    }

    const newName = newPath.split(/[/\\]/).pop() || newPath;
    const newTab: EditorTab = {
      filePath: newPath,
      fileName: newName,
      content: tab.content,
      savedContent: tab.content,
      isDirty: false,
      language: detectLanguage(newName),
    };

    set({
      tabs: [...state.tabs.filter((t) => t.filePath !== newPath), newTab],
      activeTabPath: newPath,
    });

    if (typeof window !== 'undefined') {
      window.dispatchEvent(
        new CustomEvent('nebula_file_saved', {
          detail: { path: newPath, content: tab.content },
        })
      );
    }

    return true;
  },

  setCursorPosition: (line: number, col: number) => {
    set({ cursorLine: line, cursorCol: col });
  },

  toggleWordWrap: () => {
    set((state) => ({ wordWrap: !state.wordWrap }));
  },

  toggleMinimap: () => {
    set((state) => ({ minimap: !state.minimap }));
  },

  setFontSize: (size: number) => {
    set({ fontSize: Math.max(10, Math.min(24, size)) });
  },

  theme: 'nebula-dark',
  showOutline: false,

  setTheme: (theme: string) => {
    set({ theme });
  },

  toggleOutline: () => {
    set((state) => ({ showOutline: !state.showOutline }));
  },
}));

