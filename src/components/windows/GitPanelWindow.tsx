import React, { useState } from 'react';
import {
  GitBranch as GitBranchIcon,
  GitCommit as GitCommitIcon,
  FileDiff,
  Plus,
  Trash2,
  Check,
  RotateCcw,
  Layers,
  Server,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  Eye,
  EyeOff,
  GitPullRequest,
  CheckCircle2,
  Send,
  HelpCircle,
  FolderGit2,
  ChevronDown,
  ArrowDown,
  ArrowUp,
  FolderOpen,
  Cloud,
  ShieldCheck,
  ShieldAlert,
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { GitCommit, GitProviderType } from '../../types';

export const GitPanelWindow: React.FC = () => {
  const {
    currentBranch,
    branches,
    fileStatuses,
    commits,
    activeTab,
    setActiveTab,
    stageFile,
    unstageFile,
    stageAll,
    unstageAll,
    discardFileChanges,
    commitChanges,
    createBranch,
    checkoutBranch,
    deleteBranch,
    getFileBaseContent,
    workingFileContents,
    // Multi-repo
    repositories,
    activeRepoId,
    activeRepo,
    switchRepository,
    addRepository,
    removeRepository,
    // Remote Sync
    syncStatus,
    fetchRemote,
    pullRemote,
    pushRemote,
    syncRemote,
    // Providers
    providers,
    updateProviderAccount,
    testProviderAccount,
    fetchProviderRepos,
    // Forgejo
    forgejoConfig,
    updateForgejoConfig,
    forgejoRepos,
    forgejoIssues,
    isFetchingForgejo,
    forgejoError,
    fetchRemoteRepos,
    fetchRemoteIssues,
  } = useGitStore();

  const { openWindow } = useWindowsStore();

  // Commit Form State
  const [commitMessage, setCommitMessage] = useState('');
  const [authorName, setAuthorName] = useState('Nebula Dev');
  const [authorEmail, setAuthorEmail] = useState('dev@nebula.space');
  const [isCommitting, setIsCommitting] = useState(false);
  const [commitSuccess, setCommitSuccess] = useState(false);

  // New branch state
  const [newBranchName, setNewBranchName] = useState('');

  // Dropdown states
  const [showRepoDropdown, setShowRepoDropdown] = useState(false);
  const [showBranchDropdown, setShowBranchDropdown] = useState(false);
  const [branchFilter, setBranchFilter] = useState('');

  // Modals for adding / cloning repo
  const [showAddRepoModal, setShowAddRepoModal] = useState(false);
  const [newRepoName, setNewRepoName] = useState('');
  const [newRepoPath, setNewRepoPath] = useState('/workspace');
  const [newRepoRemoteUrl, setNewRepoRemoteUrl] = useState('');
  const [newRepoProvider, setNewRepoProvider] = useState<'github' | 'gitlab' | 'forgejo' | 'local'>('github');

  // Provider config states
  const [selectedProviderTab, setSelectedProviderTab] = useState<GitProviderType>('github');
  const [showProviderToken, setShowProviderToken] = useState<Record<string, boolean>>({});
  const [providerTesting, setProviderTesting] = useState(false);
  const [providerTestResult, setProviderTestResult] = useState<{ ok: boolean; message: string } | null>(null);
  const [providerRemoteRepos, setProviderRemoteRepos] = useState<any[]>([]);
  const [isFetchingProviderRepos, setIsFetchingProviderRepos] = useState(false);

  // Forgejo Token visibility legacy
  const [showToken, setShowToken] = useState(false);
  const [selectedRepoFullName, setSelectedRepoFullName] = useState<string>('');

  const stagedFiles = fileStatuses.filter((f) => f.staged);
  const unstagedFiles = fileStatuses.filter((f) => !f.staged);

  const handleCommit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commitMessage.trim() || stagedFiles.length === 0) return;

    setIsCommitting(true);
    const success = await commitChanges(commitMessage, authorName, authorEmail);
    setIsCommitting(false);

    if (success) {
      setCommitMessage('');
      setCommitSuccess(true);
      setTimeout(() => setCommitSuccess(false), 2000);
    }
  };

  const handleOpenDiff = (path: string) => {
    const oldContent = getFileBaseContent(path);
    const newContent = workingFileContents[path] ?? oldContent;
    const currentDepth = useCanvasStore.getState().currentDepthPlane;

    openWindow(
      'diff',
      {
        filePath: path,
        oldContent,
        newContent,
        oldHeader: 'HEAD',
        newHeader: 'Working Tree',
      },
      currentDepth
    );
  };

  const handleOpenCommitDiff = (commit: GitCommit) => {
    const currentDepth = useCanvasStore.getState().currentDepthPlane;
    openWindow(
      'diff',
      {
        filePath: 'Commit: ' + commit.shortOid,
        oldContent: `Commit hash: ${commit.oid}\nAutor: ${commit.author.name} <${commit.author.email}>\nData: ${new Date(commit.author.timestamp).toLocaleString()}\n\n${commit.message}\n`,
        newContent: `// Detalhes da snapshot do commit ${commit.shortOid}\n// Modificações integradas no histórico local do Nebula\n\n+ ${commit.message}\n`,
        oldHeader: `Parent OID: ${commit.parentOids[0] || 'root'}`,
        newHeader: `Commit: ${commit.shortOid}`,
        commitOid: commit.oid,
        commitMessage: commit.message,
      },
      currentDepth
    );
  };

  const handleCreateBranch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newBranchName.trim()) return;
    createBranch(newBranchName);
    setNewBranchName('');
    setShowBranchDropdown(false);
  };

  const handleAddRepoSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newRepoName.trim() || !newRepoPath.trim()) return;
    addRepository({
      name: newRepoName,
      path: newRepoPath,
      remoteUrl: newRepoRemoteUrl,
      provider: newRepoProvider,
    });
    setNewRepoName('');
    setNewRepoRemoteUrl('');
    setShowAddRepoModal(false);
  };

  const handleTestProvider = async (provider: GitProviderType) => {
    setProviderTesting(true);
    setProviderTestResult(null);
    try {
      const res = await testProviderAccount(provider);
      setProviderTestResult(res);
    } finally {
      setProviderTesting(false);
    }
  };

  const handleLoadProviderRepos = async (provider: GitProviderType) => {
    setIsFetchingProviderRepos(true);
    try {
      const repos = await fetchProviderRepos(provider);
      setProviderRemoteRepos(repos);
    } catch (err: any) {
      setProviderTestResult({ ok: false, message: err?.message || 'Erro ao buscar repositórios' });
    } finally {
      setIsFetchingProviderRepos(false);
    }
  };

  const currentRepo = activeRepo || repositories[0];
  const aheadCount = currentRepo?.ahead || 0;
  const behindCount = currentRepo?.behind || 0;

  return (
    <div className="flex flex-col h-full bg-[#050914] text-[#d1e0f5] select-text">
      {/* ── GITHUB DESKTOP STYLE HEADER ───────────────────────────────────── */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 bg-[#060c1a] border-b border-[#14233e] select-none shrink-0">
        <div className="flex items-center gap-2">
          {/* 1. Repository Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowRepoDropdown(!showRepoDropdown)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#09152b] hover:bg-[#0e2040] border border-[#1b345e] hover:border-[#3ba9ff]/50 text-left transition-all cursor-pointer"
            >
              <FolderGit2 className="w-4 h-4 text-[#3ba9ff] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#7a92b8] uppercase font-bold tracking-wider leading-none">
                  Repositório Atual
                </span>
                <span className="text-xs font-bold text-[#e6f0ff] font-mono leading-tight">
                  {currentRepo?.name || 'nebula-workspace'}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#7a92b8] ml-1 shrink-0" />
            </button>

            {/* Repositories Dropdown */}
            {showRepoDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-72 rounded-xl bg-[#091325] border border-[#1b345e] shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 p-2 text-xs">
                <div className="px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-[#7a92b8] border-b border-[#14233e]">
                  Repositórios no Nebula ({repositories.length})
                </div>
                <div className="max-h-48 overflow-y-auto py-1 space-y-0.5">
                  {repositories.map((repo) => {
                    const isActive = repo.id === activeRepoId;
                    return (
                      <div
                        key={repo.id}
                        onClick={() => {
                          switchRepository(repo.id);
                          setShowRepoDropdown(false);
                        }}
                        className={`flex items-center justify-between p-2 rounded-lg cursor-pointer transition-colors ${
                          isActive
                            ? 'bg-[#3ba9ff]/20 text-[#5eead4] border border-[#3ba9ff]/40'
                            : 'hover:bg-[#0e1d38] text-[#d1e0f5]'
                        }`}
                      >
                        <div className="flex flex-col truncate">
                          <span className="font-bold truncate font-mono text-[11px]">{repo.name}</span>
                          <span className="text-[10px] text-[#6b82a6] truncate">{repo.path}</span>
                        </div>
                        {isActive && <Check className="w-3.5 h-3.5 text-[#5eead4] shrink-0" />}
                      </div>
                    );
                  })}
                </div>
                <div className="border-t border-[#14233e] pt-1.5 mt-1 space-y-1">
                  <button
                    type="button"
                    onClick={() => {
                      setShowRepoDropdown(false);
                      setShowAddRepoModal(true);
                    }}
                    className="w-full flex items-center gap-2 p-1.5 rounded-lg hover:bg-[#3ba9ff]/15 text-[#3ba9ff] font-semibold text-[11px] transition-colors"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Adicionar Repositório Local...</span>
                  </button>
                </div>
              </div>
            )}
          </div>

          {/* 2. Branch Selector */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowBranchDropdown(!showBranchDropdown)}
              className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-[#09152b] hover:bg-[#0e2040] border border-[#1b345e] hover:border-[#5eead4]/50 text-left transition-all cursor-pointer"
            >
              <GitBranchIcon className="w-4 h-4 text-[#5eead4] shrink-0" />
              <div className="flex flex-col">
                <span className="text-[10px] text-[#7a92b8] uppercase font-bold tracking-wider leading-none">
                  Branch Atual
                </span>
                <span className="text-xs font-bold text-[#5eead4] font-mono leading-tight">
                  {currentBranch}
                </span>
              </div>
              <ChevronDown className="w-3.5 h-3.5 text-[#7a92b8] ml-1 shrink-0" />
            </button>

            {/* Branch Dropdown */}
            {showBranchDropdown && (
              <div className="absolute top-full left-0 mt-1.5 w-64 rounded-xl bg-[#091325] border border-[#1b345e] shadow-[0_10px_30px_rgba(0,0,0,0.6)] z-50 p-2 text-xs">
                <input
                  type="text"
                  placeholder="Filtrar ou nova branch..."
                  value={branchFilter}
                  onChange={(e) => setBranchFilter(e.target.value)}
                  className="w-full px-2 py-1.5 mb-2 rounded bg-[#050914] border border-[#1b345e] text-xs text-[#e6f0ff] outline-none"
                  autoFocus
                />
                <div className="max-h-44 overflow-y-auto space-y-0.5">
                  {branches
                    .filter((b) => b.name.toLowerCase().includes(branchFilter.toLowerCase()))
                    .map((b) => {
                      const isCurrent = b.name === currentBranch;
                      return (
                        <div
                          key={b.name}
                          onClick={() => {
                            checkoutBranch(b.name);
                            setShowBranchDropdown(false);
                          }}
                          className={`flex items-center justify-between p-1.5 rounded-lg cursor-pointer ${
                            isCurrent
                              ? 'bg-[#5eead4]/15 text-[#5eead4] font-bold'
                              : 'hover:bg-[#0e1d38] text-[#d1e0f5]'
                          }`}
                        >
                          <span className="font-mono text-[11px] truncate">{b.name}</span>
                          {isCurrent && <Check className="w-3.5 h-3.5 text-[#5eead4]" />}
                        </div>
                      );
                    })}
                </div>
                {branchFilter.trim() && !branches.some((b) => b.name === branchFilter.trim()) && (
                  <button
                    type="button"
                    onClick={() => {
                      createBranch(branchFilter.trim());
                      setBranchFilter('');
                      setShowBranchDropdown(false);
                    }}
                    className="w-full mt-2 flex items-center justify-center gap-1.5 py-1.5 rounded bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40 font-bold text-[11px]"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Criar branch &quot;{branchFilter.trim()}&quot;</span>
                  </button>
                )}
              </div>
            )}
          </div>
        </div>

        {/* 3. Remote Sync Area */}
        <div className="flex items-center gap-1.5">
          {/* Fetch Origin */}
          <button
            type="button"
            onClick={fetchRemote}
            disabled={syncStatus.isSyncing}
            title="Buscar commits do servidor remoto (Fetch)"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-[#0d1c36] hover:bg-[#13294d] border border-[#1f3a68] text-xs font-medium text-[#c8dcf7] transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 text-[#3ba9ff] ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            <span>Fetch origin</span>
          </button>

          {/* Pull Origin */}
          <button
            type="button"
            onClick={pullRemote}
            disabled={syncStatus.isSyncing}
            title={behindCount > 0 ? `${behindCount} commit(s) para puxar do remoto` : 'Puxar alterações remotas'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
              behindCount > 0
                ? 'bg-[#3ba9ff]/25 border-[#3ba9ff] text-[#ffffff] shadow-[0_0_12px_rgba(59,169,255,0.4)] animate-pulse'
                : 'bg-[#0d1c36] border-[#1f3a68] text-[#8ea8cc] hover:text-[#ffffff]'
            }`}
          >
            <ArrowDown className="w-3.5 h-3.5 text-[#3ba9ff]" />
            <span>Pull</span>
            {behindCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#3ba9ff] text-[#050914] text-[10px] font-black">
                {behindCount}
              </span>
            )}
          </button>

          {/* Push Origin */}
          <button
            type="button"
            onClick={pushRemote}
            disabled={syncStatus.isSyncing}
            title={aheadCount > 0 ? `${aheadCount} commit(s) locais prontos para enviar` : 'Enviar commits locais'}
            className={`flex items-center gap-1 px-2.5 py-1.5 rounded-lg border text-xs font-semibold transition-all cursor-pointer disabled:opacity-50 ${
              aheadCount > 0
                ? 'bg-[#5eead4]/25 border-[#5eead4] text-[#ffffff] shadow-[0_0_12px_rgba(94,234,212,0.4)]'
                : 'bg-[#0d1c36] border-[#1f3a68] text-[#8ea8cc] hover:text-[#ffffff]'
            }`}
          >
            <ArrowUp className="w-3.5 h-3.5 text-[#5eead4]" />
            <span>Push</span>
            {aheadCount > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-[#5eead4] text-[#050914] text-[10px] font-black">
                {aheadCount}
              </span>
            )}
          </button>

          {/* Sync Button */}
          <button
            type="button"
            onClick={syncRemote}
            disabled={syncStatus.isSyncing}
            title="Sincronizar (Pull & Push combinados)"
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-gradient-to-r from-[#3ba9ff]/20 to-[#5eead4]/20 hover:from-[#3ba9ff]/30 hover:to-[#5eead4]/30 border border-[#5eead4]/40 text-xs font-bold text-[#e6f0ff] transition-all cursor-pointer"
          >
            <RotateCcw className={`w-3.5 h-3.5 text-[#5eead4] ${syncStatus.isSyncing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Sync</span>
          </button>
        </div>
      </div>

      {/* ── GIT NAVIGATION TABS ───────────────────────────────────────────── */}
      <div className="flex items-center border-b border-[#14233e] bg-[#070e1e] px-2 text-xs font-semibold select-none overflow-x-auto shrink-0">
        <button
          onClick={() => setActiveTab('changes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'changes'
              ? 'border-[#3ba9ff] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <FileDiff className="w-3.5 h-3.5 text-[#3ba9ff]" />
          <span>Alterações</span>
          {fileStatuses.length > 0 && (
            <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40">
              {fileStatuses.length}
            </span>
          )}
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'history'
              ? 'border-[#5eead4] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitCommitIcon className="w-3.5 h-3.5 text-[#5eead4]" />
          <span>Histórico</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40">
            {commits.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'branches'
              ? 'border-[#a78bfa] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitBranchIcon className="w-3.5 h-3.5 text-[#a78bfa]" />
          <span>Branches</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#a78bfa]/20 text-[#a78bfa] border border-[#a78bfa]/40">
            {branches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('remotes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'remotes'
              ? 'border-[#f59e0b] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Provedores & Remotos</span>
        </button>

        <button
          onClick={() => setActiveTab('issues')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 cursor-pointer ${
            activeTab === 'issues'
              ? 'border-[#ec4899] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5 text-[#ec4899]" />
          <span>Issues / PRs</span>
        </button>
      </div>

      {/* ── TAB BODY ─────────────────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto p-3">
        {/* TAB: CHANGES */}
        {activeTab === 'changes' && (
          <div className="flex flex-col h-full gap-4">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between bg-[#081022] p-2 rounded-lg border border-[#14233e]">
              <div className="flex items-center gap-2">
                <GitBranchIcon className="w-4 h-4 text-[#5eead4]" />
                <span className="text-xs text-[#8ca3c6]">Branch atual:</span>
                <span className="text-xs font-mono font-bold text-[#5eead4] px-2 py-0.5 rounded bg-[#5eead4]/15 border border-[#5eead4]/30">
                  {currentBranch}
                </span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={stageAll}
                  disabled={unstagedFiles.length === 0}
                  className="px-2 py-1 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#e2edff] text-[11px] font-semibold border border-[#3ba9ff]/30 disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Stage All
                </button>
                <button
                  onClick={unstageAll}
                  disabled={stagedFiles.length === 0}
                  className="px-2 py-1 rounded bg-[#13223d] hover:bg-[#192c4e] text-[#a0b5d4] text-[11px] font-semibold border border-[#1d335a] disabled:opacity-40 transition-colors cursor-pointer"
                >
                  Unstage All
                </button>
              </div>
            </div>

            {/* Changes View Grid */}
            <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-h-[220px]">
              {/* Unstaged Changes */}
              <div className="flex flex-col border border-[#162744] rounded-lg bg-[#070d1c] p-2.5 overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-[#14233e] mb-2 text-xs">
                  <span className="font-semibold text-[#f59e0b] flex items-center gap-1">
                    Não preparados ({unstagedFiles.length})
                  </span>
                  <span className="text-[10px] text-[#6b82a6]">Working Tree</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                  {unstagedFiles.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#5e779d]">
                      Nenhuma modificação não preparada.
                    </div>
                  ) : (
                    unstagedFiles.map((fs) => (
                      <div
                        key={fs.path}
                        className="group flex items-center justify-between px-2 py-1.5 rounded bg-[#091224] hover:bg-[#0e1b33] border border-[#132442] text-xs transition-colors"
                      >
                        <div
                          onClick={() => handleOpenDiff(fs.path)}
                          className="flex items-center gap-2 truncate cursor-pointer flex-1 mr-2"
                        >
                          <span
                            className={`w-2 h-2 rounded-full shrink-0 ${
                              fs.status === 'untracked' ? 'bg-[#a855f7]' : 'bg-[#f59e0b]'
                            }`}
                          />
                          <span className="truncate text-[#d1e0f5] group-hover:text-white font-mono text-[11px]">
                            {fs.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenDiff(fs.path)}
                            title="Ver Diff"
                            className="p-1 rounded hover:bg-[#1a2f54] text-[#7a92b8] hover:text-[#5eead4] cursor-pointer"
                          >
                            <FileDiff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => discardFileChanges(fs.path)}
                            title="Descartar alterações (reverter ao HEAD)"
                            className="p-1 rounded hover:bg-[#3d1a22] text-[#ff5c7a] cursor-pointer"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => stageFile(fs.path)}
                            title="Preparar arquivo (Stage)"
                            className="px-1.5 py-0.5 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/40 text-[#3ba9ff] border border-[#3ba9ff]/40 text-[10px] font-bold cursor-pointer"
                          >
                            +
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Staged Changes */}
              <div className="flex flex-col border border-[#162744] rounded-lg bg-[#070d1c] p-2.5 overflow-hidden">
                <div className="flex items-center justify-between pb-2 border-b border-[#14233e] mb-2 text-xs">
                  <span className="font-semibold text-[#5eead4] flex items-center gap-1">
                    Prontos para Commit ({stagedFiles.length})
                  </span>
                  <span className="text-[10px] text-[#6b82a6]">Staged (Index)</span>
                </div>

                <div className="flex-1 overflow-y-auto space-y-1 scrollbar-thin">
                  {stagedFiles.length === 0 ? (
                    <div className="text-center py-8 text-xs text-[#5e779d]">
                      Nenhum arquivo no stage. Clique no &quot;+&quot; para adicionar.
                    </div>
                  ) : (
                    stagedFiles.map((fs) => (
                      <div
                        key={fs.path}
                        className="group flex items-center justify-between px-2 py-1.5 rounded bg-[#091224] hover:bg-[#0e1b33] border border-[#132442] text-xs transition-colors"
                      >
                        <div
                          onClick={() => handleOpenDiff(fs.path)}
                          className="flex items-center gap-2 truncate cursor-pointer flex-1 mr-2"
                        >
                          <span className="w-2 h-2 rounded-full shrink-0 bg-[#5eead4]" />
                          <span className="truncate text-[#d1e0f5] group-hover:text-white font-mono text-[11px]">
                            {fs.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenDiff(fs.path)}
                            title="Ver Diff"
                            className="p-1 rounded hover:bg-[#1a2f54] text-[#7a92b8] hover:text-[#5eead4] cursor-pointer"
                          >
                            <FileDiff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => unstageFile(fs.path)}
                            title="Remover do stage"
                            className="px-1.5 py-0.5 rounded bg-[#ef4444]/20 hover:bg-[#ef4444]/40 text-[#ff5c7a] border border-[#ef4444]/40 text-[10px] font-bold cursor-pointer"
                          >
                            -
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>

            {/* Commit Box Form */}
            <form
              onSubmit={handleCommit}
              className="bg-[#081022] border border-[#14233e] rounded-lg p-3 space-y-3"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-[#ffffff] flex items-center gap-1.5">
                  <GitCommitIcon className="w-4 h-4 text-[#3ba9ff]" />
                  Novo Commit
                </span>
                <span className="text-[11px] text-[#7a92b8]">
                  {stagedFiles.length} arquivo(s) selecionado(s)
                </span>
              </div>

              <div>
                <input
                  type="text"
                  placeholder="Mensagem do commit (ex: feat: add spatial layout presets)"
                  value={commitMessage}
                  onChange={(e) => setCommitMessage(e.target.value)}
                  disabled={isCommitting}
                  className="w-full bg-[#050914] border border-[#192b4a] rounded px-3 py-2 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff] placeholder-[#4f678a]"
                />
              </div>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <input
                  type="text"
                  value={authorName}
                  onChange={(e) => setAuthorName(e.target.value)}
                  placeholder="Nome do autor"
                  className="bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1 text-[#8ea8cc] focus:outline-none"
                />
                <input
                  type="email"
                  value={authorEmail}
                  onChange={(e) => setAuthorEmail(e.target.value)}
                  placeholder="Email"
                  className="bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1 text-[#8ea8cc] focus:outline-none"
                />
              </div>

              <div className="flex items-center justify-between pt-1">
                {commitSuccess ? (
                  <span className="text-xs text-[#5eead4] flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    Commit realizado com sucesso!
                  </span>
                ) : (
                  <span className="text-[11px] text-[#5e779d]">
                    Commits locais podem ser enviados via Push
                  </span>
                )}

                <button
                  type="submit"
                  disabled={stagedFiles.length === 0 || !commitMessage.trim() || isCommitting}
                  className="px-4 py-1.5 rounded bg-gradient-to-r from-[#3ba9ff] to-[#5eead4] hover:opacity-90 disabled:opacity-40 text-[#050914] font-bold text-xs flex items-center gap-1.5 transition-all shadow-[0_0_15px_rgba(59,169,255,0.2)] cursor-pointer"
                >
                  <Send className="w-3.5 h-3.5" />
                  <span>{isCommitting ? 'Gravando...' : 'Fazer Commit'}</span>
                </button>
              </div>
            </form>
          </div>
        )}

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#8ca3c6]">
              <span>Histórico de Commits ({commits.length})</span>
              <span className="text-[11px] text-[#5e779d]">Clique para inspecionar</span>
            </div>

            <div className="space-y-2">
              {commits.map((commit, idx) => (
                <div
                  key={commit.oid}
                  onClick={() => handleOpenCommitDiff(commit)}
                  className="group p-3 rounded-lg bg-[#070d1c] border border-[#14233e] hover:border-[#3ba9ff]/50 hover:bg-[#09152b] transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-1">
                    <div className="flex items-center gap-2">
                      <span className="px-1.5 py-0.5 rounded font-mono text-[10px] font-bold bg-[#3ba9ff]/15 text-[#3ba9ff] border border-[#3ba9ff]/30">
                        {commit.shortOid}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.2 rounded text-[9px] font-black bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40">
                          HEAD
                        </span>
                      )}
                    </div>
                    <span className="text-[10px] text-[#5e779d]">
                      {new Date(commit.author.timestamp).toLocaleDateString()} às{' '}
                      {new Date(commit.author.timestamp).toLocaleTimeString([], {
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-[#e2edff] group-hover:text-white mb-1.5">
                    {commit.message}
                  </p>

                  <div className="flex items-center justify-between text-[11px] text-[#6b82a6]">
                    <span>
                      {commit.author.name} &lt;{commit.author.email}&gt;
                    </span>
                    <span className="text-[10px] text-[#3ba9ff] group-hover:underline flex items-center gap-1">
                      Ver snapshot <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: BRANCHES */}
        {activeTab === 'branches' && (
          <div className="space-y-4">
            {/* Create Branch Form */}
            <form
              onSubmit={handleCreateBranch}
              className="flex items-center gap-2 bg-[#081022] p-2.5 rounded-lg border border-[#14233e]"
            >
              <input
                type="text"
                placeholder="Nome da nova branch (ex: feature/layout-presets)"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                className="flex-1 bg-[#050914] border border-[#192b4a] rounded px-3 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#5eead4]"
              />
              <button
                type="submit"
                disabled={!newBranchName.trim()}
                className="px-3 py-1.5 rounded bg-[#5eead4]/20 hover:bg-[#5eead4]/30 text-[#5eead4] border border-[#5eead4]/40 text-xs font-bold flex items-center gap-1 disabled:opacity-40 transition-colors cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Criar</span>
              </button>
            </form>

            {/* Branches List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#8ca3c6]">Branches Locais</span>
              <div className="space-y-1.5">
                {branches.map((b) => {
                  const isCurrent = b.name === currentBranch;
                  return (
                    <div
                      key={b.name}
                      className={`flex items-center justify-between p-2.5 rounded-lg border transition-colors ${
                        isCurrent
                          ? 'bg-[#0b172d] border-[#5eead4]/50 shadow-[0_0_15px_rgba(94,234,212,0.1)]'
                          : 'bg-[#070d1c] border-[#14233e] hover:bg-[#0a1428]'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <GitBranchIcon
                          className={`w-4 h-4 ${
                            isCurrent ? 'text-[#5eead4]' : 'text-[#627d9f]'
                          }`}
                        />
                        <span
                          className={`text-xs font-mono font-medium ${
                            isCurrent ? 'text-[#ffffff] font-bold' : 'text-[#a0b5d4]'
                          }`}
                        >
                          {b.name}
                        </span>
                        {isCurrent && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40">
                            atual
                          </span>
                        )}
                        {b.ahead ? (
                          <span className="text-[10px] text-[#3ba9ff]">+{b.ahead} commits</span>
                        ) : null}
                      </div>

                      <div className="flex items-center gap-2">
                        {!isCurrent && (
                          <>
                            <button
                              onClick={() => checkoutBranch(b.name)}
                              className="px-2.5 py-1 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#3ba9ff] border border-[#3ba9ff]/40 text-xs font-semibold transition-colors cursor-pointer"
                            >
                              Checkout
                            </button>
                            <button
                              onClick={() => deleteBranch(b.name)}
                              title="Excluir branch"
                              className="p-1 rounded hover:bg-[#3d1a22] text-[#7a92b8] hover:text-[#ff5c7a] transition-colors cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* TAB: REMOTES & PROVIDERS (GitHub, GitLab, Forgejo) */}
        {activeTab === 'remotes' && (
          <div className="space-y-4">
            {/* Provider Tabs */}
            <div className="flex items-center gap-2 border-b border-[#14233e] pb-2">
              {(['github', 'gitlab', 'forgejo'] as GitProviderType[]).map((prov) => {
                const isSelected = selectedProviderTab === prov;
                const provAccount = providers[prov];
                const labels: Record<GitProviderType, string> = {
                  github: 'GitHub',
                  gitlab: 'GitLab',
                  forgejo: 'Forgejo / Gitea',
                };
                return (
                  <button
                    key={prov}
                    type="button"
                    onClick={() => {
                      setSelectedProviderTab(prov);
                      setProviderTestResult(null);
                      setProviderRemoteRepos([]);
                    }}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                      isSelected
                        ? 'bg-[#3ba9ff]/20 text-[#ffffff] border border-[#3ba9ff]/40'
                        : 'bg-[#070e1c] text-[#7a92b8] border border-transparent hover:border-[#1b345e]'
                    }`}
                  >
                    <span>{labels[prov]}</span>
                    {provAccount?.connected ? (
                      <span className="w-2 h-2 rounded-full bg-[#5eead4] shadow-[0_0_6px_#5eead4]" />
                    ) : (
                      <span className="w-2 h-2 rounded-full bg-[#475569]" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Active Provider Config Form */}
            {(() => {
              const currentProv = selectedProviderTab;
              const account = providers[currentProv];
              const isTokenVisible = showProviderToken[currentProv] || false;

              return (
                <div className="bg-[#081022] border border-[#14233e] rounded-lg p-3 space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-[#ffffff] flex items-center gap-1.5">
                      <Cloud className="w-4 h-4 text-[#3ba9ff]" />
                      Configuração da Conta {currentProv === 'forgejo' ? 'Forgejo / Codeberg' : currentProv === 'gitlab' ? 'GitLab' : 'GitHub'}
                    </span>
                    {account.connected ? (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#5eead4]/15 text-[#5eead4] border border-[#5eead4]/30 flex items-center gap-1">
                        <ShieldCheck className="w-3 h-3" />
                        Conectado ({account.username || 'Autenticado'})
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#475569]/20 text-[#94a3b8] border border-[#475569]/30 flex items-center gap-1">
                        <ShieldAlert className="w-3 h-3" />
                        Não autenticado
                      </span>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                    {currentProv !== 'github' && (
                      <div>
                        <label className="block text-[11px] text-[#7a92b8] mb-1">
                          URL da Instância / Host:
                        </label>
                        <input
                          type="url"
                          value={account.instanceUrl}
                          onChange={(e) =>
                            updateProviderAccount(currentProv, { instanceUrl: e.target.value })
                          }
                          placeholder={
                            currentProv === 'gitlab'
                              ? 'https://gitlab.com'
                              : 'https://codeberg.org'
                          }
                          className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff]"
                        />
                      </div>
                    )}

                    <div>
                      <label className="block text-[11px] text-[#7a92b8] mb-1">
                        Usuário:
                      </label>
                      <input
                        type="text"
                        value={account.username}
                        onChange={(e) =>
                          updateProviderAccount(currentProv, { username: e.target.value })
                        }
                        placeholder="ex: seu-usuario"
                        className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff]"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] text-[#7a92b8] mb-1">
                      Personal Access Token (PAT):
                    </label>
                    <div className="relative flex items-center">
                      <input
                        type={isTokenVisible ? 'text' : 'password'}
                        value={account.token}
                        onChange={(e) =>
                          updateProviderAccount(currentProv, { token: e.target.value })
                        }
                        placeholder={`Insira o token de acesso ${currentProv.toUpperCase()} (com escopo repo/write)...`}
                        className="w-full bg-[#050914] border border-[#192b4a] rounded pl-2.5 pr-8 py-1.5 text-xs text-[#e2edff] font-mono focus:outline-none focus:border-[#3ba9ff]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setShowProviderToken((prev) => ({
                            ...prev,
                            [currentProv]: !isTokenVisible,
                          }))
                        }
                        className="absolute right-2 text-[#6b82a6] hover:text-white cursor-pointer"
                      >
                        {isTokenVisible ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleTestProvider(currentProv)}
                        disabled={providerTesting || !account.token}
                        className="px-3 py-1.5 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#3ba9ff] border border-[#3ba9ff]/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${providerTesting ? 'animate-spin' : ''}`} />
                        <span>Testar Conexão</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleLoadProviderRepos(currentProv)}
                        disabled={isFetchingProviderRepos || !account.token}
                        className="px-3 py-1.5 rounded bg-[#5eead4]/20 hover:bg-[#5eead4]/30 text-[#5eead4] border border-[#5eead4]/40 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer disabled:opacity-40"
                      >
                        <FolderGit2 className={`w-3.5 h-3.5 ${isFetchingProviderRepos ? 'animate-spin' : ''}`} />
                        <span>Listar Repositórios</span>
                      </button>
                    </div>

                    {account.instanceUrl && (
                      <a
                        href={account.instanceUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] text-[#3ba9ff] hover:underline flex items-center gap-1"
                      >
                        Abrir {currentProv} na web <ExternalLink className="w-3 h-3" />
                      </a>
                    )}
                  </div>

                  {providerTestResult && (
                    <div
                      className={`p-2 rounded text-xs border ${
                        providerTestResult.ok
                          ? 'bg-[#10b981]/15 border-[#10b981]/40 text-[#5eead4]'
                          : 'bg-[#ef4444]/15 border-[#ef4444]/40 text-[#ff708b]'
                      }`}
                    >
                      {providerTestResult.message}
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Provider Remote Repositories list */}
            {providerRemoteRepos.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs font-semibold text-[#8ca3c6]">
                  Repositórios Encontrados no Provedor ({providerRemoteRepos.length})
                </span>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {providerRemoteRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-2.5 rounded-lg bg-[#070d1c] border border-[#14233e] flex items-center justify-between hover:border-[#3ba9ff]/40 transition-colors"
                    >
                      <div className="flex flex-col truncate mr-2">
                        <span className="text-xs font-bold text-[#e6f0ff] font-mono truncate">
                          {repo.full_name}
                        </span>
                        {repo.description && (
                          <span className="text-[10px] text-[#7a92b8] truncate">{repo.description}</span>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          addRepository({
                            name: repo.name,
                            path: `/workspace/${repo.name}`,
                            remoteUrl: repo.clone_url || repo.html_url,
                            provider: selectedProviderTab,
                          });
                          alert(`Repositório ${repo.name} vinculado ao Nebula com sucesso!`);
                        }}
                        className="px-2.5 py-1 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/40 text-[#3ba9ff] border border-[#3ba9ff]/40 text-[11px] font-bold shrink-0 cursor-pointer"
                      >
                        + Vincular ao Nebula
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB: ISSUES / PRS */}
        {activeTab === 'issues' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#8ca3c6]">
                Issues e Pull Requests {selectedRepoFullName ? `(${selectedRepoFullName})` : ''}
              </span>
              {selectedRepoFullName && (
                <button
                  onClick={() => {
                    const [owner, name] = selectedRepoFullName.split('/');
                    fetchRemoteIssues(owner, name);
                  }}
                  disabled={isFetchingForgejo}
                  className="text-xs text-[#3ba9ff] hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className={`w-3 h-3 ${isFetchingForgejo ? 'animate-spin' : ''}`} />
                  Atualizar
                </button>
              )}
            </div>

            {forgejoIssues.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#5e779d] bg-[#070d1c] border border-[#14233e] rounded-lg p-4">
                <HelpCircle className="w-8 h-8 text-[#ec4899]/40 mx-auto mb-2" />
                <p>Nenhuma issue ou PR encontrada para o repositório selecionado.</p>
                <p className="text-[11px] text-[#4d6382] mt-1">
                  Configure uma conta remota na aba &quot;Provedores & Remotos&quot; para consultar issues de GitHub, GitLab ou Forgejo.
                </p>
              </div>
            ) : (
              <div className="space-y-1.5">
                {forgejoIssues.map((issue) => {
                  const isPR = !!issue.pull_request;
                  return (
                    <a
                      key={issue.id}
                      href={issue.html_url}
                      target="_blank"
                      rel="noreferrer"
                      className="group flex items-start justify-between p-2.5 rounded-lg bg-[#070d1c] hover:bg-[#0c162b] border border-[#14233e] hover:border-[#ec4899]/40 transition-colors"
                    >
                      <div className="flex items-start gap-2.5">
                        {isPR ? (
                          <GitPullRequest className="w-4 h-4 text-[#ec4899] shrink-0 mt-0.5" />
                        ) : (
                          <AlertTriangle className="w-4 h-4 text-[#3ba9ff] shrink-0 mt-0.5" />
                        )}
                        <div>
                          <p className="text-xs font-semibold text-[#e2edff] group-hover:text-white">
                            #{issue.number} {issue.title}
                          </p>
                          <p className="text-[10px] text-[#6b82a6] mt-0.5">
                            por {issue.user.login} •{' '}
                            {new Date(issue.created_at).toLocaleDateString()}
                          </p>
                        </div>
                      </div>

                      <span
                        className={`text-[10px] px-2 py-0.5 rounded-full font-bold border ${
                          issue.state === 'open'
                            ? 'bg-[#10b981]/20 text-[#5eead4] border-[#5eead4]/30'
                            : 'bg-[#64748b]/20 text-[#94a3b8] border-[#64748b]/30'
                        }`}
                      >
                        {issue.state}
                      </span>
                    </a>
                  );
                })}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── MODAL: ADICIONAR REPOSITÓRIO LOCAL / REMOTO ──────────────────── */}
      {showAddRepoModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md bg-[#091325] border border-[#1b345e] rounded-xl p-4 shadow-2xl space-y-3">
            <h3 className="text-sm font-bold text-[#e6f0ff] flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-[#3ba9ff]" />
              Adicionar Repositório ao Nebula
            </h3>

            <form onSubmit={handleAddRepoSubmit} className="space-y-3 text-xs">
              <div>
                <label className="block text-[11px] text-[#7a92b8] mb-1">
                  Nome do Repositório:
                </label>
                <input
                  type="text"
                  required
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="ex: meu-backend-api"
                  className="w-full bg-[#050914] border border-[#192b4a] rounded px-3 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7a92b8] mb-1">
                  Caminho da Pasta no Workspace / Container:
                </label>
                <input
                  type="text"
                  required
                  value={newRepoPath}
                  onChange={(e) => setNewRepoPath(e.target.value)}
                  placeholder="/workspace ou /workspace/subpasta"
                  className="w-full bg-[#050914] border border-[#192b4a] rounded px-3 py-1.5 text-xs text-[#e2edff] font-mono focus:outline-none focus:border-[#3ba9ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7a92b8] mb-1">
                  URL Remota Git (Opcional):
                </label>
                <input
                  type="url"
                  value={newRepoRemoteUrl}
                  onChange={(e) => setNewRepoRemoteUrl(e.target.value)}
                  placeholder="https://github.com/usuario/repo.git"
                  className="w-full bg-[#050914] border border-[#192b4a] rounded px-3 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff]"
                />
              </div>

              <div>
                <label className="block text-[11px] text-[#7a92b8] mb-1">Provedor:</label>
                <select
                  value={newRepoProvider}
                  onChange={(e) => setNewRepoProvider(e.target.value as any)}
                  className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none"
                >
                  <option value="github">GitHub</option>
                  <option value="gitlab">GitLab</option>
                  <option value="forgejo">Forgejo / Gitea</option>
                  <option value="local">Apenas Local</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2 border-t border-[#14233e]">
                <button
                  type="button"
                  onClick={() => setShowAddRepoModal(false)}
                  className="px-3 py-1.5 rounded hover:bg-[#0e1d38] text-[#7a92b8] text-xs font-semibold cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-4 py-1.5 rounded bg-[#3ba9ff] hover:bg-[#3ba9ff]/90 text-[#050914] text-xs font-bold cursor-pointer"
                >
                  Adicionar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
