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
} from 'lucide-react';
import { useGitStore } from '../../store/useGitStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { GitCommit } from '../../types';

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
    forgejoConfig,
    updateForgejoConfig,
    forgejoRepos,
    forgejoIssues,
    isFetchingForgejo,
    forgejoError,
    fetchRemoteRepos,
    fetchRemoteIssues,
    getFileBaseContent,
    workingFileContents,
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

  // Forgejo Token visibility
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
  };

  return (
    <div className="flex flex-col h-full bg-[#050914] text-[#d1e0f5] select-text">
      {/* Git Navigation Tabs */}
      <div className="flex items-center border-b border-[#14233e] bg-[#070e1e] px-2 text-xs font-semibold select-none overflow-x-auto">
        <button
          onClick={() => setActiveTab('changes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 ${
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
          onClick={() => setActiveTab('branches')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'branches'
              ? 'border-[#5eead4] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitBranchIcon className="w-3.5 h-3.5 text-[#5eead4]" />
          <span>Branches</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40">
            {branches.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'history'
              ? 'border-[#3ba9ff] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitCommitIcon className="w-3.5 h-3.5 text-[#3ba9ff]" />
          <span>Histórico</span>
          <span className="px-1.5 py-0.2 rounded-full text-[10px] bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40">
            {commits.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('remotes')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'remotes'
              ? 'border-[#f59e0b] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <Server className="w-3.5 h-3.5 text-[#f59e0b]" />
          <span>Remotes (Forgejo)</span>
        </button>

        <button
          onClick={() => setActiveTab('issues')}
          className={`flex items-center gap-1.5 px-3 py-2.5 border-b-2 transition-all shrink-0 ${
            activeTab === 'issues'
              ? 'border-[#ec4899] text-[#ffffff] bg-[#0a1529]'
              : 'border-transparent text-[#7a92b8] hover:text-[#d1e0f5]'
          }`}
        >
          <GitPullRequest className="w-3.5 h-3.5 text-[#ec4899]" />
          <span>Issues / PRs</span>
        </button>
      </div>

      {/* Tab Body */}
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
                  className="px-2 py-1 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#e2edff] text-[11px] font-semibold border border-[#3ba9ff]/30 disabled:opacity-40 transition-colors"
                >
                  Stage All
                </button>
                <button
                  onClick={unstageAll}
                  disabled={stagedFiles.length === 0}
                  className="px-2 py-1 rounded bg-[#13223d] hover:bg-[#192c4e] text-[#a0b5d4] text-[11px] font-semibold border border-[#1d335a] disabled:opacity-40 transition-colors"
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
                            className="p-1 rounded hover:bg-[#1a2f54] text-[#7a92b8] hover:text-[#5eead4]"
                          >
                            <FileDiff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => discardFileChanges(fs.path)}
                            title="Descartar alterações (reverter ao HEAD)"
                            className="p-1 rounded hover:bg-[#3d1a22] text-[#ff5c7a]"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => stageFile(fs.path)}
                            title="Preparar arquivo (Stage)"
                            className="px-1.5 py-0.5 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/40 text-[#3ba9ff] border border-[#3ba9ff]/40 text-[10px] font-bold"
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
                      Nenhum arquivo preparado. Clique em + para preparar.
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
                          <span className="w-2 h-2 rounded-full shrink-0 bg-[#5eead4] shadow-[0_0_6px_#5eead4]" />
                          <span className="truncate text-[#d1e0f5] group-hover:text-white font-mono text-[11px]">
                            {fs.path}
                          </span>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            onClick={() => handleOpenDiff(fs.path)}
                            title="Ver Diff"
                            className="p-1 rounded hover:bg-[#1a2f54] text-[#7a92b8] hover:text-[#5eead4]"
                          >
                            <FileDiff className="w-3.5 h-3.5" />
                          </button>
                          <button
                            onClick={() => unstageFile(fs.path)}
                            title="Remover da preparação (Unstage)"
                            className="px-1.5 py-0.5 rounded bg-[#ef4444]/20 hover:bg-[#ef4444]/40 text-[#ff5c7a] border border-[#ff5c7a]/40 text-[10px] font-bold"
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
              className="bg-[#081022] border border-[#14233e] rounded-lg p-3 space-y-2 shrink-0"
            >
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-[#e2edff] flex items-center gap-1.5">
                  <GitCommitIcon className="w-3.5 h-3.5 text-[#3ba9ff]" />
                  Criar Commit
                </span>
                <span className="text-[10px] text-[#6b82a6]">
                  {stagedFiles.length} arquivo(s) preparado(s)
                </span>
              </div>

              <textarea
                value={commitMessage}
                onChange={(e) => setCommitMessage(e.target.value)}
                placeholder="Mensagem do commit (ex: feat: add spatial depth navigation)..."
                rows={2}
                className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#3ba9ff] placeholder-[#4e678e] resize-none"
              />

              <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                <div className="flex items-center gap-2 text-[11px] text-[#6b84a9]">
                  <span>Autor:</span>
                  <input
                    type="text"
                    value={authorName}
                    onChange={(e) => setAuthorName(e.target.value)}
                    className="bg-[#050914] border border-[#192b4a] rounded px-1.5 py-0.5 text-[11px] text-[#d1e0f5] w-28 focus:outline-none focus:border-[#3ba9ff]"
                  />
                  <input
                    type="email"
                    value={authorEmail}
                    onChange={(e) => setAuthorEmail(e.target.value)}
                    className="bg-[#050914] border border-[#192b4a] rounded px-1.5 py-0.5 text-[11px] text-[#d1e0f5] w-36 focus:outline-none focus:border-[#3ba9ff]"
                  />
                </div>

                <button
                  type="submit"
                  disabled={stagedFiles.length === 0 || !commitMessage.trim() || isCommitting}
                  className={`px-4 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 border transition-all ${
                    commitSuccess
                      ? 'bg-[#10b981]/30 border-[#10b981] text-[#34d399]'
                      : stagedFiles.length > 0 && commitMessage.trim()
                      ? 'bg-[#3ba9ff] hover:bg-[#3ba9ff]/90 text-[#050810] border-[#3ba9ff] shadow-[0_0_12px_rgba(59,169,255,0.4)]'
                      : 'bg-[#13223d] border-[#1d335a] text-[#5e779d] opacity-50 cursor-not-allowed'
                  }`}
                >
                  {commitSuccess ? (
                    <>
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399]" />
                      <span>Commit Realizado!</span>
                    </>
                  ) : (
                    <>
                      <Send className="w-3.5 h-3.5" />
                      <span>Commit ({stagedFiles.length})</span>
                    </>
                  )}
                </button>
              </div>
            </form>
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
              <GitBranchIcon className="w-4 h-4 text-[#5eead4]" />
              <input
                type="text"
                value={newBranchName}
                onChange={(e) => setNewBranchName(e.target.value)}
                placeholder="Nome da nova branch (ex: feature/monaco)..."
                className="flex-1 bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#5eead4] placeholder-[#4e678e]"
              />
              <button
                type="submit"
                disabled={!newBranchName.trim()}
                className="px-3 py-1.5 rounded bg-[#5eead4]/20 hover:bg-[#5eead4]/30 text-[#5eead4] border border-[#5eead4]/40 text-xs font-bold flex items-center gap-1.5 disabled:opacity-40 transition-colors"
              >
                <Plus className="w-3.5 h-3.5" /> Criar Branch
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
                              className="px-2.5 py-1 rounded bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#3ba9ff] border border-[#3ba9ff]/40 text-xs font-semibold transition-colors"
                            >
                              Checkout
                            </button>
                            <button
                              onClick={() => deleteBranch(b.name)}
                              title="Excluir branch"
                              className="p-1 rounded hover:bg-[#3d1a22] text-[#7a92b8] hover:text-[#ff5c7a] transition-colors"
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

        {/* TAB: HISTORY */}
        {activeTab === 'history' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-xs text-[#8ca3c6]">
              <span>Histórico de Commits ({commits.length})</span>
              <span className="text-[10px] text-[#5e779d]">Clique para inspecionar</span>
            </div>

            <div className="space-y-2">
              {commits.map((commit, idx) => (
                <div
                  key={commit.oid}
                  onClick={() => handleOpenCommitDiff(commit)}
                  className="group flex flex-col p-3 rounded-lg bg-[#070d1c] hover:bg-[#0b162b] border border-[#14233e] hover:border-[#3ba9ff]/50 transition-all cursor-pointer"
                >
                  <div className="flex items-center justify-between gap-2 mb-1">
                    <div className="flex items-center gap-2 font-mono text-xs">
                      <span className="px-1.5 py-0.5 rounded bg-[#3ba9ff]/20 text-[#3ba9ff] font-bold border border-[#3ba9ff]/30 text-[11px]">
                        {commit.shortOid}
                      </span>
                      {idx === 0 && (
                        <span className="px-1.5 py-0.5 rounded bg-[#5eead4]/20 text-[#5eead4] font-bold text-[10px]">
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

                  <p className="text-xs font-semibold text-[#e2edff] group-hover:text-[#5eead4] transition-colors line-clamp-2 mb-1.5">
                    {commit.message}
                  </p>

                  <div className="flex items-center justify-between text-[10px] text-[#6b82a6]">
                    <span>
                      {commit.author.name} &lt;{commit.author.email}&gt;
                    </span>
                    <span className="text-[#3ba9ff] group-hover:underline flex items-center gap-1">
                      Ver snapshot <ExternalLink className="w-3 h-3" />
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* TAB: REMOTES (FORGEJO / GITEA) */}
        {activeTab === 'remotes' && (
          <div className="space-y-4">
            {/* Warning Banner */}
            <div className="flex items-start gap-2.5 p-3 rounded-lg bg-[#f59e0b]/10 border border-[#f59e0b]/30 text-xs text-[#fcd34d]">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-[#f59e0b]" />
              <div>
                <p className="font-semibold mb-0.5">Segurança do Token de Acesso</p>
                <p className="text-[11px] opacity-90">
                  O token é armazenado localmente via IndexedDB do seu navegador sem criptografia no
                  lado do cliente. Recomendamos criar um Personal Access Token com escopo restrito de
                  leitura/escrita no seu Forgejo ou Codeberg.
                </p>
              </div>
            </div>

            {/* Remote Config Form */}
            <div className="bg-[#081022] border border-[#14233e] rounded-lg p-3 space-y-3">
              <span className="text-xs font-bold text-[#ffffff] flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-[#f59e0b]" />
                Configuração da Instância Forgejo / Gitea
              </span>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-xs">
                <div>
                  <label className="block text-[11px] text-[#7a92b8] mb-1">
                    URL da Instância Forgejo:
                  </label>
                  <input
                    type="url"
                    value={forgejoConfig.instanceUrl}
                    onChange={(e) => updateForgejoConfig({ instanceUrl: e.target.value })}
                    placeholder="https://codeberg.org ou https://git.meudominio.com"
                    className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#f59e0b]"
                  />
                </div>

                <div>
                  <label className="block text-[11px] text-[#7a92b8] mb-1">
                    Nome de Usuário Forgejo:
                  </label>
                  <input
                    type="text"
                    value={forgejoConfig.username}
                    onChange={(e) => updateForgejoConfig({ username: e.target.value })}
                    placeholder="ex: nebuladev"
                    className="w-full bg-[#050914] border border-[#192b4a] rounded px-2.5 py-1.5 text-xs text-[#e2edff] focus:outline-none focus:border-[#f59e0b]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] text-[#7a92b8] mb-1">
                  Personal Access Token:
                </label>
                <div className="relative flex items-center">
                  <input
                    type={showToken ? 'text' : 'password'}
                    value={forgejoConfig.token}
                    onChange={(e) => updateForgejoConfig({ token: e.target.value })}
                    placeholder="Insira o token gerado em Configurações > Aplicações..."
                    className="w-full bg-[#050914] border border-[#192b4a] rounded pl-2.5 pr-8 py-1.5 text-xs text-[#e2edff] font-mono focus:outline-none focus:border-[#f59e0b]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowToken(!showToken)}
                    className="absolute right-2 text-[#6b82a6] hover:text-white"
                  >
                    {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between pt-1">
                <button
                  type="button"
                  onClick={fetchRemoteRepos}
                  disabled={isFetchingForgejo}
                  className="px-4 py-1.5 rounded bg-[#f59e0b]/20 hover:bg-[#f59e0b]/30 text-[#fcd34d] border border-[#f59e0b]/40 text-xs font-bold flex items-center gap-1.5 transition-colors"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${isFetchingForgejo ? 'animate-spin' : ''}`}
                  />
                  <span>Carregar Repositórios</span>
                </button>

                {forgejoConfig.instanceUrl && (
                  <a
                    href={forgejoConfig.instanceUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-[11px] text-[#3ba9ff] hover:underline flex items-center gap-1"
                  >
                    Abrir instância na web <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>

              {forgejoError && (
                <div className="p-2 rounded bg-[#ef4444]/15 border border-[#ef4444]/30 text-[11px] text-[#ff708b]">
                  {forgejoError}
                </div>
              )}
            </div>

            {/* Repositories List */}
            <div className="space-y-2">
              <span className="text-xs font-semibold text-[#8ca3c6]">
                Repositórios Remotos no Forgejo ({forgejoRepos.length})
              </span>

              {forgejoRepos.length === 0 ? (
                <div className="text-center py-6 text-xs text-[#5e779d] bg-[#070d1c] border border-[#14233e] rounded-lg">
                  Nenhum repositório carregado. Preencha o Token acima e clique em &quot;Carregar Repositórios&quot;.
                </div>
              ) : (
                <div className="space-y-2">
                  {forgejoRepos.map((repo) => (
                    <div
                      key={repo.id}
                      className="p-3 rounded-lg bg-[#070d1c] border border-[#14233e] hover:border-[#f59e0b]/40 transition-colors flex flex-col gap-1.5"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-xs text-[#ffffff]">
                            {repo.full_name}
                          </span>
                          {repo.private && (
                            <span className="text-[10px] px-1.5 py-0.2 rounded bg-[#334155] text-[#94a3b8]">
                              Privado
                            </span>
                          )}
                        </div>
                        <a
                          href={repo.html_url}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[#3ba9ff] hover:text-[#5eead4] p-1"
                          title="Ver no Forgejo"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>

                      {repo.description && (
                        <p className="text-[11px] text-[#8ca3c6]">{repo.description}</p>
                      )}

                      <div className="flex items-center justify-between text-[11px] text-[#5e779d] pt-1">
                        <div className="flex items-center gap-3">
                          <span>★ {repo.stars_count}</span>
                          <span>Forks: {repo.forks_count}</span>
                          <span>Issues: {repo.open_issues_count}</span>
                        </div>

                        <button
                          onClick={() => {
                            setSelectedRepoFullName(repo.full_name);
                            const [owner, name] = repo.full_name.split('/');
                            fetchRemoteIssues(owner, name);
                            setActiveTab('issues');
                          }}
                          className="text-[10px] text-[#5eead4] hover:underline"
                        >
                          Ver Issues / PRs &rarr;
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
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
                  className="text-xs text-[#3ba9ff] hover:underline flex items-center gap-1"
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
                  Vá até a aba &quot;Remotes&quot; para escolher um repositório conectado via API do Forgejo.
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
    </div>
  );
};
