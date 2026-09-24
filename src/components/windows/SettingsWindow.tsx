import React, { useState, useEffect, useRef } from 'react';
import {
  Server,
  Shield,
  Key,
  HardDrive,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Save,
  Globe,
  Lock,
  Magnet,
  Monitor,
  LogOut,
  Sparkles,
  Download,
  Upload,
  Database,
  FileJson,
} from 'lucide-react';
import { useFSStore } from '../../store/useFSStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { clearAuthToken } from '../../lib/api';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../../lib/workspaceBackup';

export const SettingsWindow: React.FC = () => {
  const {
    mode,
    switchMode,
    remoteConfig,
    updateServerSettings,
    isRemoteAvailable,
    roots,
    refreshCurrentDir,
  } = useFSStore();

  const { snapEnabled, setSnapEnabled, openWindow } = useWindowsStore();
  const [resMode, setResMode] = useState<string>(() => {
    return (typeof localStorage !== 'undefined' && localStorage.getItem('nebula_res_mode')) || 'ultra';
  });

  const handleSetResMode = (mode: string) => {
    setResMode(mode);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('nebula_res_mode', mode);
    }
    if (typeof document !== 'undefined') {
      document.body.classList.remove('res-ultra-sharp', 'res-retina');
      if (mode === 'ultra') document.body.classList.add('res-ultra-sharp');
      if (mode === 'retina') document.body.classList.add('res-retina');
    }
  };

  useEffect(() => {
    handleSetResMode(resMode);
  }, []);

  const handleLogout = () => {
    clearAuthToken();
    window.dispatchEvent(new CustomEvent('nebula_logout'));
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [backupStatus, setBackupStatus] = useState<{
    success: boolean;
    message: string;
  } | null>(null);

  const handleExportBackup = async () => {
    setIsExporting(true);
    setBackupStatus(null);
    const ok = await exportWorkspaceBackup();
    setIsExporting(false);
    if (ok) {
      setBackupStatus({
        success: true,
        message: 'Arquivo .nebula.json gerado e baixado com sucesso!',
      });
      setTimeout(() => setBackupStatus(null), 4000);
    } else {
      setBackupStatus({
        success: false,
        message: 'Falha ao gerar o arquivo de backup.',
      });
    }
  };

  const handleImportFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsImporting(true);
    setBackupStatus(null);
    try {
      const text = await file.text();
      const res = await importWorkspaceBackup(text);
      setBackupStatus(res);
      if (res.success) {
        setTimeout(() => setBackupStatus(null), 5000);
      }
    } catch (err: any) {
      setBackupStatus({
        success: false,
        message: `Falha ao ler arquivo: ${err?.message || 'Arquivo corrompido'}`,
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const [baseUrl, setBaseUrl] = useState(remoteConfig.baseUrl || '');
  const [token, setToken] = useState(remoteConfig.token || '');
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message: string;
    details?: any;
  } | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => {
    setBaseUrl(remoteConfig.baseUrl || '');
    setToken(remoteConfig.token || '');
  }, [remoteConfig]);

  const handleTestConnection = async () => {
    setIsTesting(true);
    setTestResult(null);
    const start = performance.now();

    try {
      const cleanBase = baseUrl.replace(/\/+$/, '');
      const url = `${cleanBase}/api/health`;
      const headers: Record<string, string> = {};
      if (token.trim()) {
        headers['Authorization'] = `Bearer ${token.trim()}`;
      }

      const res = await fetch(url, { method: 'GET', headers });
      const elapsed = Math.round(performance.now() - start);

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: res.statusText }));
        setTestResult({
          success: false,
          message: `Erro HTTP ${res.status}: ${err.error || res.statusText}`,
        });
        setIsTesting(false);
        return;
      }

      const data = await res.json();
      setTestResult({
        success: true,
        message: `Conexão bem-sucedida! Latência: ${elapsed}ms. Modo: ${data.mode}. Raízes: ${data.roots?.length || 0}`,
        details: data,
      });
    } catch (err: any) {
      setTestResult({
        success: false,
        message: `Falha ao alcançar servidor: ${err.message || 'Verifique o endereço e CORS'}`,
      });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    const isOk = await updateServerSettings({
      baseUrl: baseUrl.trim(),
      token: token.trim(),
    });
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
    if (isOk) {
      await refreshCurrentDir();
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/90 text-[#e6f0ff] p-5 overflow-y-auto">
      <div className="mb-5 pb-4 border-b border-[#3ba9ff]/15">
        <h2 className="text-base font-bold text-[#5eead4] flex items-center gap-2">
          <Server className="w-5 h-5 text-[#3ba9ff]" />
          Configurações do Servidor & Filesystem
        </h2>
        <p className="text-xs text-[#7a92b8] mt-1">
          Alterne entre o backend HTTP de VPS (1Panel / Docker) e o modo local do navegador.
        </p>
      </div>

      {/* Mode Selection */}
      <div className="mb-6">
        <label className="text-xs font-semibold text-[#e6f0ff] block mb-2">Modo de Operação Ativo</label>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => switchMode('remote')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
              mode === 'remote'
                ? 'bg-[#3ba9ff]/20 border-[#5eead4] shadow-[0_0_20px_rgba(94,234,212,0.2)]'
                : 'bg-[#0a1628]/60 border-[#3ba9ff]/20 hover:border-[#3ba9ff]/40'
            }`}
          >
            <div className="p-2 rounded-lg bg-[#3ba9ff]/20 text-[#3ba9ff] mt-0.5">
              <Server className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e6f0ff] flex items-center gap-1.5">
                <span>Servidor VPS (HTTP API)</span>
                {isRemoteAvailable && (
                  <span className="text-[10px] text-[#5eead4] bg-[#5eead4]/15 px-1.5 py-0.2 rounded font-mono">
                    Online
                  </span>
                )}
              </div>
              <p className="text-[11px] text-[#7a92b8] mt-1 leading-relaxed">
                Acessa o sistema de arquivos da VPS via container Docker e bind mounts com proteção path traversal.
              </p>
            </div>
          </button>

          <button
            type="button"
            onClick={() => switchMode('local')}
            className={`flex items-start gap-3 p-3.5 rounded-xl border text-left transition-all ${
              mode === 'local'
                ? 'bg-[#3ba9ff]/20 border-[#5eead4] shadow-[0_0_20px_rgba(94,234,212,0.2)]'
                : 'bg-[#0a1628]/60 border-[#3ba9ff]/20 hover:border-[#3ba9ff]/40'
            }`}
          >
            <div className="p-2 rounded-lg bg-[#5eead4]/20 text-[#5eead4] mt-0.5">
              <HardDrive className="w-4 h-4" />
            </div>
            <div>
              <div className="text-xs font-bold text-[#e6f0ff]">Navegador Nativo (Local)</div>
              <p className="text-[11px] text-[#7a92b8] mt-1 leading-relaxed">
                Utiliza a File System Access API para abrir pastas diretamente do seu computador desktop.
              </p>
            </div>
          </button>
        </div>
      </div>

      {/* Remote Backend Settings Form */}
      <form onSubmit={handleSave} className="space-y-4 bg-[#0a1628]/60 border border-[#3ba9ff]/20 rounded-2xl p-4 mb-6">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#3ba9ff] flex items-center gap-1.5">
          <Globe className="w-4 h-4" />
          Parâmetros do Backend Remoto
        </h3>

        <div>
          <label className="text-xs text-[#e6f0ff] block mb-1">URL do Backend (Host ou VPS)</label>
          <input
            type="text"
            value={baseUrl}
            onChange={(e) => setBaseUrl(e.target.value)}
            placeholder="Deixe em branco para usar o mesmo host ou http://seu-ip:3001"
            className="w-full px-3 py-2 bg-[#070e1c] border border-[#3ba9ff]/30 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
          />
          <p className="text-[10px] text-[#7a92b8] mt-1">
            Se estiver usando o Docker multi-stage incluído ou rodando localmente, deixe vazio.
          </p>
        </div>

        <div>
          <label className="text-xs text-[#e6f0ff] block mb-1 flex items-center justify-between">
            <span>Token de Autenticação (NEBULA_TOKEN)</span>
            <span className="text-[10px] text-[#7a92b8]">Armazenado com segurança no IndexedDB</span>
          </label>
          <div className="relative">
            <Key className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#7a92b8]" />
            <input
              type="password"
              value={token}
              onChange={(e) => setToken(e.target.value)}
              placeholder="Digite seu token secreto..."
              className="w-full pl-9 pr-3 py-2 bg-[#070e1c] border border-[#3ba9ff]/30 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
            />
          </div>
        </div>

        {/* Buttons */}
        <div className="flex items-center justify-between pt-2">
          <button
            type="button"
            onClick={handleTestConnection}
            disabled={isTesting}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#e6f0ff] text-xs font-medium transition-all cursor-pointer disabled:opacity-50"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isTesting ? 'animate-spin text-[#5eead4]' : ''}`} />
            <span>{isTesting ? 'Testando...' : 'Testar Conexão'}</span>
          </button>

          <button
            type="submit"
            className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-[#3ba9ff] hover:bg-[#5eead4] text-[#050810] text-xs font-bold transition-all shadow-[0_0_15px_rgba(59,169,255,0.4)] cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            <span>Salvar Parâmetros</span>
          </button>
        </div>

        {/* Test Result Alert */}
        {testResult && (
          <div
            className={`p-3 rounded-xl border text-xs flex items-start gap-2.5 font-mono ${
              testResult.success
                ? 'bg-[#5eead4]/10 border-[#5eead4]/30 text-[#5eead4]'
                : 'bg-[#ff5c7a]/10 border-[#ff5c7a]/30 text-[#ff5c7a]'
            }`}
          >
            {testResult.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div>{testResult.message}</div>
              {testResult.details?.roots && (
                <div className="text-[10px] text-[#7a92b8] mt-1">
                  Raízes ativas: {testResult.details.roots.map((r: any) => r.path).join(', ')}
                </div>
              )}
            </div>
          </div>
        )}

        {saveSuccess && (
          <div className="text-xs text-[#5eead4] flex items-center gap-1 font-mono">
            <CheckCircle2 className="w-3.5 h-3.5" />
            Configurações salvas no IndexedDB!
          </div>
        )}
      </form>

      {/* Janelas & Snapping Magnético */}
      <div className="mt-5 p-4 rounded-xl bg-[#0a1628]/60 border border-[#3ba9ff]/20 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Magnet className="w-4 h-4 text-[#5eead4]" />
            <div>
              <div className="text-xs font-semibold text-[#e6f0ff]">Anexar Janelas (Snapping Magnético)</div>
              <div className="text-[11px] text-[#7a92b8]">Permite colar janelas lado a lado ao arrastá-las próximas.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={() => setSnapEnabled(!snapEnabled)}
            className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
              snapEnabled
                ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#34d399] shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                : 'bg-[#1e293b]/60 border-slate-700 text-slate-400'
            }`}
          >
            {snapEnabled ? 'Ativado' : 'Desativado'}
          </button>
        </div>
        <p className="text-[11px] text-[#7a92b8] border-t border-[#3ba9ff]/10 pt-2 leading-relaxed">
          💡 <strong>Dica de Desencaixe:</strong> Quando janelas estiverem coladas/anexadas, basta clicar no botão 
          <span className="text-[#5eead4] font-mono mx-1 px-1.5 py-0.5 rounded bg-[#3ba9ff]/10 border border-[#3ba9ff]/30 text-[10px]">Desencaixar</span>
          no cabeçalho da janela para soltá-las imediatamente.
        </p>
      </div>

      {/* Resolução e Fidelidade Visual */}
      <div className="mt-4 p-4 rounded-xl bg-[#0a1628]/60 border border-[#3ba9ff]/20 flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Monitor className="w-4 h-4 text-[#6ea8ff]" />
          <div>
            <div className="text-xs font-semibold text-[#e6f0ff]">Resolução e Nitidez Visual</div>
            <div className="text-[11px] text-[#7a92b8]">Ajuste a nitidez do texto e renderização 3D do Nebula.</div>
          </div>
        </div>
        <div className="grid grid-cols-3 gap-2 pt-1">
          {[
            { id: 'normal', label: 'Padrão (1x)', desc: 'Desempenho nativo' },
            { id: 'ultra', label: 'Ultra-Nítido', desc: 'Contraste e font-smoothing' },
            { id: 'retina', label: 'Retina / HiDPI', desc: 'Textos crisp e aceleração' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => handleSetResMode(item.id)}
              className={`p-2.5 rounded-lg border text-left transition-all cursor-pointer ${
                resMode === item.id
                  ? 'bg-[#3ba9ff]/20 border-[#5eead4] text-[#5eead4] shadow-[0_0_12px_rgba(94,234,212,0.2)]'
                  : 'bg-[#070e1c] border-[#162744] text-[#7a92b8] hover:border-[#3ba9ff]/40 hover:text-[#cbd5e1]'
              }`}
            >
              <div className="text-xs font-medium">{item.label}</div>
              <div className="text-[10px] opacity-75 mt-0.5">{item.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Backup & Migração de Workspace (.nebula.json) */}
      <div className="mt-4 p-4 rounded-xl bg-[#0a1628]/60 border border-[#5eead4]/25 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Database className="w-4 h-4 text-[#5eead4]" />
            <div>
              <div className="text-xs font-semibold text-[#e6f0ff] flex items-center gap-1.5">
                <span>Backup & Migração de Workspace</span>
                <span className="text-[10px] font-mono text-[#5eead4] bg-[#5eead4]/15 px-1.5 py-0.5 rounded border border-[#5eead4]/30">
                  .nebula.json
                </span>
              </div>
              <div className="text-[11px] text-[#7a92b8]">
                Exporte ou restaure todo o estado (janelas 3D, notas do IndexedDB, abas e configurações) em um único arquivo.
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept=".json,.nebula.json"
            onChange={handleImportFile}
            className="hidden"
          />

          <button
            type="button"
            onClick={handleExportBackup}
            disabled={isExporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/35 text-[#3ba9ff] hover:text-[#5eead4] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <Download className={`w-3.5 h-3.5 ${isExporting ? 'animate-bounce' : ''}`} />
            <span>{isExporting ? 'Exportando...' : 'Exportar Workspace (.nebula.json)'}</span>
          </button>

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isImporting}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#5eead4]/15 hover:bg-[#5eead4]/25 border border-[#5eead4]/35 text-[#5eead4] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
          >
            <Upload className={`w-3.5 h-3.5 ${isImporting ? 'animate-spin' : ''}`} />
            <span>{isImporting ? 'Restaurando...' : 'Importar Backup (.nebula.json)'}</span>
          </button>
        </div>

        {backupStatus && (
          <div
            className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 font-mono ${
              backupStatus.success
                ? 'bg-[#5eead4]/10 border-[#5eead4]/30 text-[#5eead4]'
                : 'bg-[#ff5c7a]/10 border-[#ff5c7a]/30 text-[#ff5c7a]'
            }`}
          >
            {backupStatus.success ? (
              <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5eead4]" />
            ) : (
              <AlertTriangle className="w-4 h-4 shrink-0 text-[#ff5c7a]" />
            )}
            <span>{backupStatus.message}</span>
          </div>
        )}
      </div>

      {/* Sessão e Logout */}
      <div className="mt-4 p-4 rounded-xl bg-[#0a1628]/60 border border-[#ff5c7a]/25 flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Lock className="w-4 h-4 text-[#ff5c7a]" />
            <div>
              <div className="text-xs font-semibold text-[#e6f0ff]">Sessão de Usuário</div>
              <div className="text-[11px] text-[#7a92b8]">Gerenciamento de credenciais locais e login administrativo.</div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#ff5c7a]/15 hover:bg-[#ff5c7a]/25 border border-[#ff5c7a]/40 text-[#ff8ba7] text-xs font-semibold transition-all cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Fazer Logout</span>
          </button>
        </div>
        <div className="p-2.5 rounded-lg bg-[#070e1c] border border-white/5 text-[11px] text-[#7a92b8] font-mono">
          <span className="text-[#34d399] font-semibold">Credenciais Padrão:</span> Usuário: <span className="text-white font-bold">admin</span> | Senha: <span className="text-white font-bold">admin123</span>
        </div>
      </div>

      {/* Security & Isolation Summary */}
      <div className="mt-4 bg-[#0a1628]/40 border border-[#3ba9ff]/10 rounded-xl p-3.5 text-xs text-[#7a92b8]">
        <div className="flex items-center gap-2 font-semibold text-[#e6f0ff] mb-1">
          <Shield className="w-4 h-4 text-[#5eead4]" />
          Proteção de Isolamento e Segurança
        </div>
        <ul className="list-disc list-inside space-y-1 text-[11px] mt-2">
          <li>Path Traversal Protection: todo caminho é normalizado contra <code>NEBULA_ROOTS</code>.</li>
          <li>Limite seguro de leitura de 10 MB por arquivo para evitar estouro de memória.</li>
          <li>Rate Limiting automático para mitigação de varreduras abusivas.</li>
        </ul>
      </div>
    </div>
  );
};
