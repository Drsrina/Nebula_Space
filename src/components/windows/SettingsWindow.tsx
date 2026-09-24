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
  QrCode,
  KeyRound,
  ShieldCheck,
  Check,
  Trash2,
  Eye,
  EyeOff,
  AlertCircle,
  Palette,
  Sun,
  Moon,
  FileCode,
} from 'lucide-react';
import { useFSStore } from '../../store/useFSStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useThemeStore, ACCENT_PRESETS, AccentPreset, ThemeMode } from '../../store/useThemeStore';
import { clearAuthToken, authFetch } from '../../lib/api';
import { exportWorkspaceBackup, importWorkspaceBackup } from '../../lib/workspaceBackup';

export const SettingsWindow: React.FC = () => {
  const {
    themeMode,
    accent,
    customCss,
    customCssEnabled,
    setThemeMode,
    setAccent,
    setCustomCss,
    setCustomCssEnabled,
  } = useThemeStore();

  const cssFileInputRef = useRef<HTMLInputElement>(null);
  const [localCss, setLocalCss] = useState(customCss);
  const [cssSavedToast, setCssSavedToast] = useState(false);

  useEffect(() => {
    setLocalCss(customCss);
  }, [customCss]);
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

  // --- Segurança, Troca de Senha e MFA ---
  const [authStatus, setAuthStatus] = useState<{
    hasPassword: boolean;
    mfaEnabled: boolean;
    user?: string;
  } | null>(null);
  const [loadingAuthStatus, setLoadingAuthStatus] = useState(false);

  // Alteração de Senha
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPass, setShowCurrentPass] = useState(false);
  const [showNewPass, setShowNewPass] = useState(false);
  const [isChangingPass, setIsChangingPass] = useState(false);
  const [passFeedback, setPassFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // MFA
  const [showMfaSetup, setShowMfaSetup] = useState(false);
  const [isGeneratingMfa, setIsGeneratingMfa] = useState(false);
  const [mfaData, setMfaData] = useState<{ secret: string; otpAuthUrl: string; qrCode: string } | null>(null);
  const [mfaTotpInput, setMfaTotpInput] = useState('');
  const [isActivatingMfa, setIsActivatingMfa] = useState(false);
  const [mfaFeedback, setMfaFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Desativação de MFA
  const [showDisableMfa, setShowDisableMfa] = useState(false);
  const [disableMfaPassword, setDisableMfaPassword] = useState('');
  const [isDisablingMfa, setIsDisablingMfa] = useState(false);

  const fetchAuthStatus = async () => {
    setLoadingAuthStatus(true);
    try {
      const res = await authFetch('/api/auth/status');
      if (res.ok) {
        const data = await res.json();
        setAuthStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setLoadingAuthStatus(false);
    }
  };

  useEffect(() => {
    fetchAuthStatus();
  }, []);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPassFeedback(null);

    if (newPassword.length < 4) {
      setPassFeedback({ type: 'error', message: 'A nova senha deve ter pelo menos 4 caracteres.' });
      return;
    }
    if (newPassword !== confirmPassword) {
      setPassFeedback({ type: 'error', message: 'A nova senha e a confirmação não coincidem.' });
      return;
    }

    setIsChangingPass(true);
    try {
      const res = await authFetch('/api/auth/change-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setPassFeedback({ type: 'success', message: 'Senha administrativa atualizada com sucesso!' });
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
        setTimeout(() => setPassFeedback(null), 5000);
      } else {
        setPassFeedback({ type: 'error', message: data.error || 'Erro ao alterar a senha.' });
      }
    } catch {
      setPassFeedback({ type: 'error', message: 'Falha de conexão com o servidor.' });
    } finally {
      setIsChangingPass(false);
    }
  };

  const handleStartMfaSetup = async () => {
    setIsGeneratingMfa(true);
    setMfaFeedback(null);
    setMfaTotpInput('');
    try {
      const res = await authFetch('/api/auth/mfa/generate', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        setMfaData(data);
        setShowMfaSetup(true);
      } else {
        const errData = await res.json().catch(() => ({}));
        setMfaFeedback({ type: 'error', message: errData.error || 'Erro ao gerar credenciais MFA.' });
      }
    } catch {
      setMfaFeedback({ type: 'error', message: 'Falha ao conectar com o servidor para gerar MFA.' });
    } finally {
      setIsGeneratingMfa(false);
    }
  };

  const handleConfirmEnableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!mfaData || mfaTotpInput.length < 6) return;

    setIsActivatingMfa(true);
    setMfaFeedback(null);
    try {
      const res = await authFetch('/api/auth/mfa/enable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ secret: mfaData.secret, totp: mfaTotpInput }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMfaFeedback({ type: 'success', message: 'Autenticação em Dois Fatores ativada com sucesso!' });
        setShowMfaSetup(false);
        setMfaData(null);
        setMfaTotpInput('');
        fetchAuthStatus();
        setTimeout(() => setMfaFeedback(null), 5000);
      } else {
        setMfaFeedback({ type: 'error', message: data.error || 'Código TOTP inválido. Verifique o relógio do seu celular e tente novamente.' });
      }
    } catch {
      setMfaFeedback({ type: 'error', message: 'Falha de comunicação com o servidor.' });
    } finally {
      setIsActivatingMfa(false);
    }
  };

  const handleDisableMfa = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!disableMfaPassword) return;

    setIsDisablingMfa(true);
    setMfaFeedback(null);
    try {
      const res = await authFetch('/api/auth/mfa/disable', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: disableMfaPassword }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setMfaFeedback({ type: 'success', message: 'MFA desativado e dispositivos removidos com sucesso!' });
        setShowDisableMfa(false);
        setDisableMfaPassword('');
        fetchAuthStatus();
        setTimeout(() => setMfaFeedback(null), 5000);
      } else {
        setMfaFeedback({ type: 'error', message: data.error || 'Senha incorreta para desativação.' });
      }
    } catch {
      setMfaFeedback({ type: 'error', message: 'Falha ao desativar MFA.' });
    } finally {
      setIsDisablingMfa(false);
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

      {/* Temas Globais & Personalização CSS (2.8.1) */}
      <div className="mt-4 p-4 rounded-xl bg-[#0a1628]/60 border border-[#3ba9ff]/25 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#3ba9ff]/15">
          <div className="flex items-center gap-2">
            <Palette className="w-5 h-5 text-[#5eead4]" />
            <div>
              <div className="text-xs font-bold text-[#e6f0ff] flex items-center gap-2">
                <span>Temas Globais do Workspace & CSS Personalizado</span>
                <span className="text-[10px] font-mono text-[#5eead4] bg-[#5eead4]/15 px-2 py-0.5 rounded-full border border-[#5eead4]/30">
                  v2.8.1
                </span>
              </div>
              <div className="text-[11px] text-[#7a92b8]">
                Alterne entre modos claro e escuro, selecione paletas de destaque ou injete sua própria folha de estilos CSS.
              </div>
            </div>
          </div>
        </div>

        {/* 1. Seleção de Modo de Tema */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-semibold text-[#e6f0ff]">Modo de Tema</label>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            {[
              {
                id: 'dark' as ThemeMode,
                name: 'Dark (Deep Space)',
                desc: 'Visual escuro cyberpunk com vidro azul/ciano',
                icon: Moon,
              },
              {
                id: 'light' as ThemeMode,
                name: 'Light (Nebula Day)',
                desc: 'Tema claro para ambientes iluminados e leitura diurna',
                icon: Sun,
              },
              {
                id: 'custom' as ThemeMode,
                name: 'Personalizado',
                desc: 'Cores de realce customizáveis e CSS injetado',
                icon: Palette,
              },
            ].map((t) => {
              const Icon = t.icon;
              const isSelected = themeMode === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setThemeMode(t.id)}
                  className={`p-3 rounded-xl border text-left transition-all cursor-pointer flex flex-col gap-1.5 ${
                    isSelected
                      ? 'bg-[#3ba9ff]/20 border-[#5eead4] shadow-[0_0_15px_rgba(94,234,212,0.25)] text-[#e6f0ff]'
                      : 'bg-[#070e1c] border-[#162744] text-[#7a92b8] hover:border-[#3ba9ff]/40 hover:text-[#cbd5e1]'
                  }`}
                >
                  <div className="flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${isSelected ? 'text-[#5eead4]' : 'text-[#7a92b8]'}`} />
                    <span className="text-xs font-bold">{t.name}</span>
                  </div>
                  <p className="text-[10px] opacity-80 leading-relaxed">{t.desc}</p>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Paletas de Destaque (Accent Colors) */}
        <div className="flex flex-col gap-2 pt-1 border-t border-[#3ba9ff]/10">
          <label className="text-xs font-semibold text-[#e6f0ff] flex items-center justify-between">
            <span>Cor de Realce Global (Accent Palette)</span>
            <span className="text-[10px] font-mono text-[#5eead4]">
              {ACCENT_PRESETS[accent]?.name || 'Nebula Cyan'}
            </span>
          </label>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2">
            {(Object.keys(ACCENT_PRESETS) as AccentPreset[]).map((key) => {
              const preset = ACCENT_PRESETS[key];
              const isSelected = accent === key;
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setAccent(key)}
                  className={`p-2.5 rounded-lg border text-center transition-all cursor-pointer flex flex-col items-center gap-1.5 ${
                    isSelected
                      ? 'border-[#5eead4] bg-[#3ba9ff]/20 shadow-[0_0_12px_rgba(94,234,212,0.3)]'
                      : 'border-[#162744] bg-[#070e1c] hover:border-[#3ba9ff]/30'
                  }`}
                >
                  <div
                    className="w-5 h-5 rounded-full border border-white/20 shadow"
                    style={{ backgroundColor: preset.primary }}
                  />
                  <span className="text-[10px] font-medium text-[#e6f0ff] truncate max-w-full">
                    {key.toUpperCase()}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 3. Editor de Arquivo CSS Customizado */}
        <div className="flex flex-col gap-3 pt-2 border-t border-[#3ba9ff]/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FileCode className="w-4 h-4 text-[#5eead4]" />
              <div>
                <div className="text-xs font-semibold text-[#e6f0ff]">Folha de Estilos Personalizada (CSS)</div>
                <div className="text-[11px] text-[#7a92b8]">
                  Injete regras de CSS diretamente na interface do Nebula ou carregue um arquivo .css do seu computador.
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setCustomCssEnabled(!customCssEnabled)}
              className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all cursor-pointer border ${
                customCssEnabled
                  ? 'bg-[#10b981]/20 border-[#10b981]/50 text-[#34d399] shadow-[0_0_12px_rgba(16,185,129,0.2)]'
                  : 'bg-[#1e293b]/60 border-slate-700 text-slate-400'
              }`}
            >
              {customCssEnabled ? 'CSS Ativo' : 'CSS Inativo'}
            </button>
          </div>

          <div className="flex flex-col gap-2">
            <textarea
              value={localCss}
              onChange={(e) => setLocalCss(e.target.value)}
              placeholder="/* Digite ou cole seu CSS customizado aqui... */&#10;.window-container {&#10;  border-radius: 12px;&#10;}"
              rows={6}
              className="w-full px-3 py-2.5 bg-[#060c18] border border-[#3ba9ff]/30 rounded-xl text-xs font-mono text-[#5eead4] focus:outline-none focus:border-[#5eead4] resize-y placeholder:text-[#3e5675]"
              spellCheck={false}
            />

            <input
              ref={cssFileInputRef}
              type="file"
              accept=".css,text/css"
              onChange={async (e) => {
                const file = e.target.files?.[0];
                if (!file) return;
                try {
                  const text = await file.text();
                  setLocalCss(text);
                  setCustomCss(text);
                  setCustomCssEnabled(true);
                  setCssSavedToast(true);
                  setTimeout(() => setCssSavedToast(false), 3000);
                } catch {
                  // ignore
                } finally {
                  if (cssFileInputRef.current) cssFileInputRef.current.value = '';
                }
              }}
              className="hidden"
            />

            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => cssFileInputRef.current?.click()}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3ba9ff]/15 hover:bg-[#3ba9ff]/25 border border-[#3ba9ff]/30 text-[#e6f0ff] text-xs font-medium transition-all cursor-pointer"
                >
                  <Upload className="w-3.5 h-3.5 text-[#5eead4]" />
                  <span>Carregar Arquivo .css</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const sample = `/* Exemplo de Estilização Customizada Nebula */
.window-container {
  box-shadow: 0 10px 40px rgba(0, 0, 0, 0.7) !important;
}
.window-header {
  letter-spacing: 0.05em;
}`;
                    setLocalCss(sample);
                  }}
                  className="px-2.5 py-1.5 rounded-lg bg-[#070e1c] border border-white/10 hover:border-white/20 text-[#7a92b8] hover:text-[#e6f0ff] text-xs font-mono transition-all cursor-pointer"
                >
                  Carregar Exemplo
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setLocalCss('');
                    setCustomCss('');
                  }}
                  className="px-2.5 py-1.5 rounded-lg text-[#ff5c7a] hover:bg-[#ff5c7a]/10 text-xs font-mono transition-all cursor-pointer"
                >
                  Limpar
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  setCustomCss(localCss);
                  setCustomCssEnabled(true);
                  setCssSavedToast(true);
                  setTimeout(() => setCssSavedToast(false), 2500);
                }}
                className="flex items-center gap-1.5 px-4 py-1.5 rounded-lg bg-gradient-to-r from-[#5eead4] to-[#3ba9ff] text-[#050810] text-xs font-bold transition-all shadow-[0_0_15px_rgba(94,234,212,0.3)] cursor-pointer"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Aplicar e Salvar CSS</span>
              </button>
            </div>

            {cssSavedToast && (
              <div className="text-xs text-[#5eead4] flex items-center gap-1.5 font-mono pt-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                CSS personalizado aplicado globalmente e salvo no armazenamento!
              </div>
            )}
          </div>
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

      {/* Segurança Global, Alteração de Senha & 2FA / MFA */}
      <div className="mt-4 p-4 rounded-xl bg-[#0a1628]/60 border border-[#3ba9ff]/25 flex flex-col gap-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#3ba9ff]/15">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-[#5eead4]" />
            <div>
              <div className="text-xs font-bold text-[#e6f0ff] flex items-center gap-2">
                <span>Segurança Administrativa & Autenticação</span>
                {authStatus?.mfaEnabled ? (
                  <span className="text-[10px] font-mono text-[#34d399] bg-[#34d399]/15 px-2 py-0.5 rounded-full border border-[#34d399]/30 flex items-center gap-1">
                    <Check className="w-3 h-3" /> MFA Ativo
                  </span>
                ) : (
                  <span className="text-[10px] font-mono text-[#7a92b8] bg-slate-800/80 px-2 py-0.5 rounded-full border border-slate-700">
                    MFA Desativado
                  </span>
                )}
              </div>
              <div className="text-[11px] text-[#7a92b8]">
                Gerencie a senha de acesso global do Workspace e configure a Autenticação em Dois Fatores (TOTP).
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={fetchAuthStatus}
            title="Atualizar status de segurança"
            className="p-1.5 rounded-lg bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/20 text-[#3ba9ff] transition-all cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loadingAuthStatus ? 'animate-spin' : ''}`} />
          </button>
        </div>

        {/* 1. Troca de Senha */}
        <form onSubmit={handleChangePassword} className="p-3.5 rounded-xl bg-[#070e1c]/80 border border-[#3ba9ff]/20 flex flex-col gap-3">
          <div className="text-xs font-semibold text-[#5eead4] flex items-center gap-1.5">
            <KeyRound className="w-4 h-4 text-[#3ba9ff]" />
            <span>Alterar Senha do Administrador</span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div>
              <label className="text-[10px] font-mono text-[#7a92b8] block mb-1">Senha Atual</label>
              <div className="relative">
                <input
                  type={showCurrentPass ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  placeholder="Senha atual..."
                  className="w-full px-2.5 py-1.5 pr-8 bg-[#060c18] border border-[#3ba9ff]/30 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPass(!showCurrentPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#506c94] hover:text-[#e6f0ff]"
                >
                  {showCurrentPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#7a92b8] block mb-1">Nova Senha</label>
              <div className="relative">
                <input
                  type={showNewPass ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Nova senha (min. 4 carac.)..."
                  className="w-full px-2.5 py-1.5 pr-8 bg-[#060c18] border border-[#3ba9ff]/30 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPass(!showNewPass)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-[#506c94] hover:text-[#e6f0ff]"
                >
                  {showNewPass ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <div>
              <label className="text-[10px] font-mono text-[#7a92b8] block mb-1">Confirmar Nova Senha</label>
              <input
                type={showNewPass ? 'text' : 'password'}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Repita a nova senha..."
                className="w-full px-2.5 py-1.5 bg-[#060c18] border border-[#3ba9ff]/30 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]"
              />
            </div>
          </div>

          <div className="flex items-center justify-between pt-1">
            <div className="text-[10px] text-[#7a92b8] font-mono">
              Salvo de forma persistente em <code className="text-[#3ba9ff]">/data/auth-config.json</code>
            </div>
            <button
              type="submit"
              disabled={isChangingPass || !currentPassword || !newPassword}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#3ba9ff] hover:bg-[#5eead4] text-[#050810] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              <Save className="w-3.5 h-3.5" />
              <span>{isChangingPass ? 'Salvando...' : 'Atualizar Senha'}</span>
            </button>
          </div>

          {passFeedback && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 font-mono ${
                passFeedback.type === 'success'
                  ? 'bg-[#5eead4]/10 border-[#5eead4]/30 text-[#5eead4]'
                  : 'bg-[#ff5c7a]/10 border-[#ff5c7a]/30 text-[#ff5c7a]'
              }`}
            >
              {passFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5eead4]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ff5c7a]" />
              )}
              <span>{passFeedback.message}</span>
            </div>
          )}
        </form>

        {/* 2. Gerenciamento de MFA */}
        <div className="p-3.5 rounded-xl bg-[#070e1c]/80 border border-[#3ba9ff]/20 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <QrCode className="w-4 h-4 text-[#5eead4]" />
              <div>
                <div className="text-xs font-semibold text-[#e6f0ff]">Autenticação em Dois Fatores (TOTP)</div>
                <div className="text-[11px] text-[#7a92b8]">
                  Compatível com Google Authenticator, Authy, Microsoft Authenticator e 1Password.
                </div>
              </div>
            </div>

            {!authStatus?.mfaEnabled ? (
              <button
                type="button"
                onClick={handleStartMfaSetup}
                disabled={isGeneratingMfa}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#5eead4]/15 hover:bg-[#5eead4]/25 border border-[#5eead4]/40 text-[#5eead4] text-xs font-semibold transition-all cursor-pointer disabled:opacity-50"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{isGeneratingMfa ? 'Gerando QR...' : 'Ativar MFA / Configurar Dispositivo'}</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={() => {
                  setShowDisableMfa(!showDisableMfa);
                  setDisableMfaPassword('');
                }}
                className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ff5c7a]/15 hover:bg-[#ff5c7a]/25 border border-[#ff5c7a]/40 text-[#ff8ba7] text-xs font-semibold transition-all cursor-pointer"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Desativar MFA / Remover Dispositivos</span>
              </button>
            )}
          </div>

          {/* Modal / Bloco de Ativação de MFA com QR Code */}
          {showMfaSetup && mfaData && (
            <div className="mt-2 p-4 rounded-xl bg-[#060c18] border border-[#5eead4]/30 flex flex-col gap-3">
              <div className="text-xs font-mono text-[#5eead4] font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Passo a Passo: Ativação de Autenticador TOTP</span>
              </div>

              <div className="flex flex-col sm:flex-row items-center gap-4 py-2">
                <div className="p-2 bg-white rounded-xl shadow-lg shrink-0">
                  <img src={mfaData.qrCode} alt="MFA QR Code" className="w-40 h-40 rounded" />
                </div>
                <div className="flex flex-col gap-2 font-mono text-xs text-[#7a92b8] flex-1">
                  <p>1. Abra seu aplicativo autenticador no smartphone.</p>
                  <p>2. Escaneie a imagem QR Code ao lado.</p>
                  <div className="p-2 rounded bg-[#0a1628] border border-[#3ba9ff]/20">
                    <span className="text-[10px] text-[#7a92b8] block">Ou insira manualmente o código secreto:</span>
                    <strong className="text-[#5eead4] select-all break-all text-xs tracking-wider">{mfaData.secret}</strong>
                  </div>
                  <p>3. Digite abaixo o código de 6 dígitos gerado pelo app para confirmar:</p>
                </div>
              </div>

              <form onSubmit={handleConfirmEnableMfa} className="flex items-center gap-2 pt-1">
                <input
                  type="text"
                  value={mfaTotpInput}
                  onChange={(e) => setMfaTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  maxLength={6}
                  className="w-32 px-3 py-2 bg-[#0a1628] border border-[#5eead4]/40 rounded-lg text-[#5eead4] text-center text-lg tracking-[0.3em] font-mono font-bold focus:outline-none focus:border-[#5eead4]"
                />
                <button
                  type="submit"
                  disabled={isActivatingMfa || mfaTotpInput.length < 6}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-gradient-to-r from-[#5eead4] to-[#3ba9ff] text-[#050810] text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer shadow-[0_0_15px_rgba(94,234,212,0.3)]"
                >
                  <Check className="w-4 h-4" />
                  <span>{isActivatingMfa ? 'Validando...' : 'Confirmar e Ativar MFA'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowMfaSetup(false)}
                  className="px-3 py-2 rounded-lg bg-transparent text-[#7a92b8] hover:text-[#e6f0ff] text-xs font-mono transition-colors cursor-pointer"
                >
                  Cancelar
                </button>
              </form>
            </div>
          )}

          {/* Bloco de Desativação de MFA */}
          {showDisableMfa && authStatus?.mfaEnabled && (
            <form onSubmit={handleDisableMfa} className="mt-2 p-3.5 rounded-xl bg-[#1c0d15] border border-[#ff5c7a]/30 flex flex-col gap-3">
              <div className="text-xs text-[#ff8ba7] font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-4 h-4 text-[#ff5c7a]" />
                <span>Confirmação de Desativação do MFA</span>
              </div>
              <p className="text-[11px] text-[#7a92b8]">
                Ao desativar o MFA, todos os dispositivos e chaves TOTP configurados serão revogados. Para sua segurança, digite a senha administrativa atual:
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="password"
                  value={disableMfaPassword}
                  onChange={(e) => setDisableMfaPassword(e.target.value)}
                  placeholder="Digite sua senha administrativa..."
                  className="flex-1 max-w-sm px-3 py-1.5 bg-[#060c18] border border-[#ff5c7a]/40 rounded-lg text-xs font-mono text-[#e6f0ff] focus:outline-none focus:border-[#ff5c7a]"
                />
                <button
                  type="submit"
                  disabled={isDisablingMfa || !disableMfaPassword}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg bg-[#ff5c7a] hover:bg-[#ff7593] text-white text-xs font-bold transition-all disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>{isDisablingMfa ? 'Desativando...' : 'Confirmar e Revogar Dispositivos'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setShowDisableMfa(false)}
                  className="px-2.5 py-1.5 rounded-lg text-[#7a92b8] hover:text-[#e6f0ff] text-xs font-mono cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          )}

          {mfaFeedback && (
            <div
              className={`p-2.5 rounded-lg border text-xs flex items-center gap-2 font-mono ${
                mfaFeedback.type === 'success'
                  ? 'bg-[#5eead4]/10 border-[#5eead4]/30 text-[#5eead4]'
                  : 'bg-[#ff5c7a]/10 border-[#ff5c7a]/30 text-[#ff5c7a]'
              }`}
            >
              {mfaFeedback.type === 'success' ? (
                <CheckCircle2 className="w-4 h-4 shrink-0 text-[#5eead4]" />
              ) : (
                <AlertCircle className="w-4 h-4 shrink-0 text-[#ff5c7a]" />
              )}
              <span>{mfaFeedback.message}</span>
            </div>
          )}
        </div>
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
