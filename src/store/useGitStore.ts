import { create } from 'zustand';
import {
  ForgejoConfig,
  ForgejoIssue,
  ForgejoRepo,
  GitBranch,
  GitCommit,
  GitFileStatus,
} from '../types';
import {
  generateGitHash,
  INITIAL_GIT_BRANCHES,
  INITIAL_GIT_COMMITS,
} from '../lib/git';
import {
  DEFAULT_FORGEJO_CONFIG,
  fetchForgejoRepoIssues,
  fetchForgejoUserRepos,
  loadForgejoConfig,
  saveForgejoConfig,
} from '../lib/forgejo';
import { MOCK_FILE_CONTENTS } from '../lib/fs';

interface GitStoreState {
  isRepo: boolean;
  currentBranch: string;
  branches: GitBranch[];
  fileStatuses: GitFileStatus[];
  commits: GitCommit[];
  headCommit: GitCommit | null;
  
  // Baseline clean content of files from HEAD
  headFileContents: Record<string, string>;
  // Current working tree modified contents
  workingFileContents: Record<string, string>;

  // Forgejo / Gitea
  forgejoConfig: ForgejoConfig;
  forgejoRepos: ForgejoRepo[];
  forgejoIssues: ForgejoIssue[];
  isFetchingForgejo: boolean;
  forgejoError: string | null;

  // Active Git panel tab
  activeTab: 'changes' | 'branches' | 'history' | 'remotes' | 'issues';

  // Actions
  initGit: () => Promise<void>;
  setActiveTab: (tab: 'changes' | 'branches' | 'history' | 'remotes' | 'issues') => void;
  stageFile: (path: string) => void;
  unstageFile: (path: string) => void;
  stageAll: () => void;
  unstageAll: () => void;
  discardFileChanges: (path: string) => void;
  commitChanges: (message: string, authorName?: string, authorEmail?: string) => Promise<boolean>;
  createBranch: (name: string) => boolean;
  checkoutBranch: (name: string) => boolean;
  deleteBranch: (name: string) => boolean;
  
  // File change tracking
  notifyFileEdited: (path: string, newContent: string) => void;
  getFileBaseContent: (path: string) => string;

  // Forgejo Actions
  updateForgejoConfig: (partial: Partial<ForgejoConfig>) => Promise<void>;
  fetchRemoteRepos: () => Promise<void>;
  fetchRemoteIssues: (owner: string, repo: string) => Promise<void>;
}

// Initial mock tracked files
const INITIAL_HEAD_CONTENTS: Record<string, string> = { ...MOCK_FILE_CONTENTS };

// Pre-populate some modified files so the user immediately sees working changes!
const INITIAL_WORKING_CONTENTS: Record<string, string> = {
  ...MOCK_FILE_CONTENTS,
  'src/index.ts': `${MOCK_FILE_CONTENTS['src/index.ts'] || ''}\n// v0.2: Spatial Git & Forgejo integrations active\nexport const VERSION = '0.2.0-nebula';\n`,
  'notes/ideias.md': `${MOCK_FILE_CONTENTS['notes/ideias.md'] || ''}\n- [x] Monaco Editor Notepad++ style with multi-tabs\n- [x] Git diff viewer with neon cyan/coral line highlights\n`,
};

const INITIAL_STATUSES: GitFileStatus[] = [
  { path: 'src/index.ts', status: 'modified', staged: false },
  { path: 'notes/ideias.md', status: 'modified', staged: true },
];

export const useGitStore = create<GitStoreState>((set, get) => ({
  isRepo: true,
  currentBranch: 'main',
  branches: INITIAL_GIT_BRANCHES,
  fileStatuses: INITIAL_STATUSES,
  commits: INITIAL_GIT_COMMITS,
  headCommit: INITIAL_GIT_COMMITS[0] || null,
  headFileContents: INITIAL_HEAD_CONTENTS,
  workingFileContents: INITIAL_WORKING_CONTENTS,

  forgejoConfig: DEFAULT_FORGEJO_CONFIG,
  forgejoRepos: [],
  forgejoIssues: [],
  isFetchingForgejo: false,
  forgejoError: null,

  activeTab: 'changes',

  initGit: async () => {
    try {
      const cfg = await loadForgejoConfig();
      set({ forgejoConfig: cfg });
    } catch (err) {
      console.warn('Error initializing git store config:', err);
    }
  },

  setActiveTab: (tab) => set({ activeTab: tab }),

  stageFile: (path: string) => {
    set((state) => ({
      fileStatuses: state.fileStatuses.map((fs) =>
        fs.path === path ? { ...fs, staged: true } : fs
      ),
    }));
  },

  unstageFile: (path: string) => {
    set((state) => ({
      fileStatuses: state.fileStatuses.map((fs) =>
        fs.path === path ? { ...fs, staged: false } : fs
      ),
    }));
  },

  stageAll: () => {
    set((state) => ({
      fileStatuses: state.fileStatuses.map((fs) => ({ ...fs, staged: true })),
    }));
  },

  unstageAll: () => {
    set((state) => ({
      fileStatuses: state.fileStatuses.map((fs) => ({ ...fs, staged: false })),
    }));
  },

  discardFileChanges: (path: string) => {
    const baseContent = get().headFileContents[path] ?? '';
    set((state) => ({
      workingFileContents: {
        ...state.workingFileContents,
        [path]: baseContent,
      },
      fileStatuses: state.fileStatuses.filter((fs) => fs.path !== path),
    }));
  },

  commitChanges: async (message: string, authorName = 'Nebula Dev', authorEmail = 'dev@nebula.space') => {
    const state = get();
    const staged = state.fileStatuses.filter((fs) => fs.staged);
    if (staged.length === 0 || !message.trim()) {
      return false;
    }

    const oid = generateGitHash(`${message}-${Date.now()}-${authorEmail}`);
    const shortOid = oid.slice(0, 7);

    const newCommit: GitCommit = {
      oid,
      shortOid,
      message: message.trim(),
      author: {
        name: authorName,
        email: authorEmail,
        timestamp: Date.now(),
      },
      parentOids: state.headCommit ? [state.headCommit.oid] : [],
    };

    // Update HEAD file contents with the staged changes
    const updatedHead = { ...state.headFileContents };
    for (const fs of staged) {
      if (state.workingFileContents[fs.path] !== undefined) {
        updatedHead[fs.path] = state.workingFileContents[fs.path];
      }
    }

    // Remaining unstaged files stay modified; staged files become clean
    const remainingStatuses = state.fileStatuses.filter((fs) => !fs.staged);

    // Update branches ahead counter
    const updatedBranches = state.branches.map((b) =>
      b.isCurrent ? { ...b, ahead: (b.ahead || 0) + 1 } : b
    );

    set({
      commits: [newCommit, ...state.commits],
      headCommit: newCommit,
      headFileContents: updatedHead,
      fileStatuses: remainingStatuses,
      branches: updatedBranches,
    });

    return true;
  },

  createBranch: (name: string) => {
    const cleanName = name.trim().replace(/\s+/g, '-');
    if (!cleanName) return false;
    const exists = get().branches.some((b) => b.name === cleanName);
    if (exists) return false;

    const newBranch: GitBranch = {
      name: cleanName,
      isCurrent: true,
      ahead: 0,
      behind: 0,
    };

    set((state) => ({
      currentBranch: cleanName,
      branches: [
        ...state.branches.map((b) => ({ ...b, isCurrent: false })),
        newBranch,
      ],
    }));
    return true;
  },

  checkoutBranch: (name: string) => {
    const state = get();
    const branch = state.branches.find((b) => b.name === name);
    if (!branch) return false;

    set({
      currentBranch: name,
      branches: state.branches.map((b) => ({
        ...b,
        isCurrent: b.name === name,
      })),
    });
    return true;
  },

  deleteBranch: (name: string) => {
    const state = get();
    if (state.currentBranch === name || state.branches.length <= 1) {
      return false; // Can't delete active branch
    }

    set({
      branches: state.branches.filter((b) => b.name !== name),
    });
    return true;
  },

  notifyFileEdited: (path: string, newContent: string) => {
    const state = get();
    const baseContent = state.headFileContents[path] ?? '';
    const isDifferent = baseContent !== newContent;

    const existingStatus = state.fileStatuses.find((fs) => fs.path === path);

    let updatedStatuses = [...state.fileStatuses];
    if (isDifferent) {
      if (!existingStatus) {
        updatedStatuses.push({
          path,
          status: state.headFileContents[path] === undefined ? 'untracked' : 'modified',
          staged: false,
        });
      }
    } else {
      // Content matches HEAD again
      updatedStatuses = updatedStatuses.filter((fs) => fs.path !== path);
    }

    set({
      workingFileContents: {
        ...state.workingFileContents,
        [path]: newContent,
      },
      fileStatuses: updatedStatuses,
    });
  },

  getFileBaseContent: (path: string) => {
    return get().headFileContents[path] ?? MOCK_FILE_CONTENTS[path] ?? '';
  },

  updateForgejoConfig: async (partial) => {
    const current = get().forgejoConfig;
    const updated = { ...current, ...partial };
    set({ forgejoConfig: updated });
    await saveForgejoConfig(updated);
  },

  fetchRemoteRepos: async () => {
    const cfg = get().forgejoConfig;
    if (!cfg.instanceUrl || !cfg.token) {
      set({ forgejoError: 'Por favor, informe a URL da instância e o Token nos campos acima.' });
      return;
    }

    set({ isFetchingForgejo: true, forgejoError: null });
    try {
      const repos = await fetchForgejoUserRepos(cfg);
      set({ forgejoRepos: repos, isFetchingForgejo: false });
    } catch (err: unknown) {
      const error = err as Error;
      set({
        forgejoError: error.message || 'Falha ao conectar com o servidor Forgejo.',
        isFetchingForgejo: false,
      });
    }
  },

  fetchRemoteIssues: async (owner: string, repo: string) => {
    const cfg = get().forgejoConfig;
    set({ isFetchingForgejo: true, forgejoError: null });
    try {
      const issues = await fetchForgejoRepoIssues(cfg, owner, repo);
      set({ forgejoIssues: issues, isFetchingForgejo: false });
    } catch (err: unknown) {
      const error = err as Error;
      set({
        forgejoError: error.message || 'Falha ao carregar issues.',
        isFetchingForgejo: false,
      });
    }
  },
}));
