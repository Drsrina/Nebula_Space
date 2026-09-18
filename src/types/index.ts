export type DepthLevel = 0 | 1 | 2;

export type WindowType =
  | 'file-tree'
  | 'file-browser'
  | 'file-preview'
  | 'editor'
  | 'git-panel'
  | 'diff'
  | 'note'
  | 'launcher'
  | 'settings'
  | 'settings-global'
  | 'terminal'
  | 'ai-chat'
  | 'global-search'
  | 'task-runner'
  | 'graph'
  | 'docker-monitor'
  | 'login'
  // ── v2.6 New Window Types ─────────────────────────────────────────────────
  | 'workflow'
  | 'crontab'
  | 'kanban'
  | 'pdf-viewer'
  | 'web-embed'
  | 'api-client'
  | 'snippets'
  | 'live-preview'
  // ── v2.7 New Window Types ─────────────────────────────────────────────────
  | 'code-sandbox'
  | 'plugin-manager';


export interface EditorTab {
  filePath: string;
  fileName: string;
  content: string;
  savedContent: string;
  isDirty: boolean;
  language?: string;
  gitStatus?: 'modified' | 'untracked' | 'added' | 'deleted' | 'clean';
  handle?: FileSystemFileHandle;
}

export interface EditorPayload {
  tabs: EditorTab[];
  activeTabPath: string;
}

export interface GitFileStatus {
  path: string;
  status: 'modified' | 'added' | 'deleted' | 'untracked' | 'staged-modified' | 'staged-added' | 'staged-deleted';
  staged: boolean;
}

export interface GitCommit {
  oid: string;
  shortOid: string;
  message: string;
  author: {
    name: string;
    email: string;
    timestamp: number;
  };
  parentOids: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  ahead?: number;
  behind?: number;
}

export interface ForgejoConfig {
  instanceUrl: string;
  username: string;
  token: string;
  selectedRepo?: string;
}

export interface ForgejoRepo {
  id: number;
  name: string;
  full_name: string;
  description: string;
  private: boolean;
  html_url: string;
  clone_url: string;
  stars_count: number;
  forks_count: number;
  open_issues_count: number;
  open_pr_counter?: number;
  default_branch: string;
  owner: {
    login: string;
    avatar_url: string;
  };
}

export interface ForgejoIssue {
  id: number;
  number: number;
  title: string;
  state: 'open' | 'closed';
  html_url: string;
  created_at: string;
  user: {
    login: string;
    avatar_url: string;
  };
  pull_request?: Record<string, unknown>;
}

export interface DiffPayload {
  filePath: string;
  oldContent: string;
  newContent: string;
  oldHeader?: string;
  newHeader?: string;
  commitOid?: string;
  commitMessage?: string;
}

export interface FilePreviewPayload {
  filePath: string;
  fileName: string;
  fileExtension?: string;
  content: string;
  size?: number;
  lastModified?: number;
  isBinary?: boolean;
}

export interface NotePayload {
  noteId: string;
  markdownContent: string;
  title: string;
}

export interface FileTreePayload {
  selectedPath?: string;
}

export interface GitPanelPayload {
  initialTab?: 'changes' | 'branches' | 'history' | 'remotes' | 'issues';
}

export type WindowPayload =
  | FilePreviewPayload
  | EditorPayload
  | GitPanelPayload
  | DiffPayload
  | NotePayload
  | FileTreePayload
  | Record<string, unknown>;

export interface WindowData {
  id: string;
  title: string;
  type: WindowType;
  depth: DepthLevel; // 0 = Focus (Z=0), 1 = Context (Z=-400px), 2 = Reference/Archive (Z=-800px)
  x: number;
  y: number;
  width: number;
  height: number;
  isMinimized?: boolean;
  isPinned?: boolean;       // janela segue a câmera (fixed na viewport)
  isMaximized?: boolean;    // janela ocupa 100% da viewport
  isPopped?: boolean;       // janela destacada em nova aba do browser (pop-out)
  prevWidth?: number;       // salva width antes de maximizar
  prevHeight?: number;      // salva height antes de maximizar
  payload?: WindowPayload;
  zIndex?: number;
  // ── v2.6: Multi-instance + Snap ──────────────────────────────────────────
  instanceId?: string;      // ID único de instância para multi-window do mesmo tipo
  snapGroup?: string;       // ID do grupo de snap — janelas snapped se movem juntas
}

export interface FSFileNode {
  id: string;
  name: string;
  kind: 'file' | 'directory';
  path: string;
  handle?: FileSystemFileHandle | FileSystemDirectoryHandle;
  children?: FSFileNode[];
  size?: number;
  lastModified?: number;
  extension?: string;
}

export interface SavedNote {
  id: string;
  title: string;
  content: string;
  createdAt: number;
  updatedAt: number;
}

export interface DepthConfig {
  level: DepthLevel;
  z: number;
  name: string;
  subtitle: string;
  blur: string;
  opacity: number;
  scale: number;
  boxShadow: string;
  borderColor: string;
}
