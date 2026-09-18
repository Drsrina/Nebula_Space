import React, { useState, useEffect } from 'react';
import {
  Lock,
  KeyRound,
  QrCode,
  Eye,
  EyeOff,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Sparkles,
} from 'lucide-react';
import { getAuthToken, setAuthToken, authFetch } from '../../lib/api';

interface LoginWindowProps {
  onSuccess?: (token: string) => void;
}

type Step = 'password' | 'totp' | 'qr-setup' | 'done';

export const LoginWindow: React.FC<LoginWindowProps> = ({ onSuccess }) => {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [qrData, setQrData] = useState<{ qrCode: string; secret: string; otpAuthUrl: string } | null>(null);

  // Verifica se o servidor requer autenticação ao montar
  useEffect(() => {
    const checkAuth = async () => {
      const stored = getAuthToken();
      if (stored) {
        onSuccess?.(stored);
        return;
      }
      // Testa se o servidor aceita sem auth (modo dev)
      const res = await fetch('/api/health');
      if (res.ok) {
        const data = await res.json();
        if (!data.authRequired) {
          onSuccess?.('dev-mode-no-auth');
        }
      }
    };
    checkAuth();
  }, []);

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      const data = await res.json();

      if (res.status === 206 && data.mfaRequired) {
        // Senha correta, mas MFA pendente
        setStep('totp');
      } else if (res.ok && data.token) {
        setAuthToken(data.token);
        setStep('done');
        onSuccess?.(data.token);
      } else {
        setError(data.error || 'Erro ao autenticar.');
      }
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleTotpSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, totp: totpCode }),
      });

      const data = await res.json();

      if (res.ok && data.token) {
        setAuthToken(data.token);
        setStep('done');
        onSuccess?.(data.token);
      } else {
        setError(data.error || 'Código TOTP inválido.');
      }
    } catch (err) {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  const loadQrSetup = async () => {
    setIsLoading(true);
    setError('');
    try {
      const headers: Record<string, string> = {};
      if (password) {
        headers['x-admin-password'] = password;
      }
      const res = await authFetch('/api/auth/mfa-setup', { headers });
      if (res.ok) {
        const data = await res.json();
        setQrData(data);
        setStep('qr-setup');
      } else {
        const errData = await res.json().catch(() => ({}));
        setError(errData.error || 'Setup de MFA não disponível. Configure NEBULA_MFA_SETUP=true.');
      }
    } catch {
      setError('Erro ao carregar QR Code.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center bg-[#060c18] p-6 font-mono text-xs">
      {/* Logo */}
      <div className="flex flex-col items-center gap-3 mb-8">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-tr from-[#3ba9ff] to-[#5eead4] flex items-center justify-center shadow-[0_0_40px_rgba(94,234,212,0.4)]">
          <Sparkles className="w-7 h-7 text-[#050810]" />
        </div>
        <div className="text-center">
          <h1 className="text-lg font-bold text-[#e6f0ff] tracking-widest uppercase">Nebula</h1>
          <p className="text-[11px] text-[#7a92b8] mt-0.5">Workspace Espacial · v2.5</p>
        </div>
      </div>

      <div className="w-full max-w-[320px] space-y-3">
        {/* ── Etapa 1: Senha ───────────────────────────────────────────────── */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="space-y-3">
            <div>
              <label className="text-[10px] text-[#7a92b8] mb-1.5 block">Senha do Administrador</label>
              <div className="relative">
                <Lock className="w-3.5 h-3.5 text-[#3ba9ff] absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  autoFocus
                  className="w-full pl-9 pr-10 py-2.5 rounded-xl bg-[#0a1628] border border-[#3ba9ff]/30 focus:border-[#5eead4] text-[#e6f0ff] text-xs outline-none transition-all"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#506c94] hover:text-[#e6f0ff] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#ff5c7a] bg-[#ff5c7a]/10 border border-[#ff5c7a]/25 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#3ba9ff] to-[#5eead4] text-[#050810] font-bold text-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Lock className="w-4 h-4" />}
              Entrar
            </button>

            <button
              type="button"
              onClick={loadQrSetup}
              className="w-full text-center text-[10px] text-[#506c94] hover:text-[#3ba9ff] transition-colors py-1 cursor-pointer"
            >
              <QrCode className="w-3 h-3 inline mr-1" />
              Configurar MFA (primeiro acesso)
            </button>
          </form>
        )}

        {/* ── Etapa 2: TOTP ───────────────────────────────────────────────── */}
        {step === 'totp' && (
          <form onSubmit={handleTotpSubmit} className="space-y-3">
            <div className="text-center text-[11px] text-[#7a92b8] pb-1">
              <KeyRound className="w-5 h-5 mx-auto mb-2 text-[#5eead4]" />
              Digite o código de 6 dígitos do seu autenticador
            </div>

            <div className="relative">
              <KeyRound className="w-3.5 h-3.5 text-[#5eead4] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-[#0a1628] border border-[#5eead4]/30 focus:border-[#5eead4] text-[#e6f0ff] text-center text-xl tracking-[0.4em] font-bold outline-none transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#ff5c7a] bg-[#ff5c7a]/10 border border-[#ff5c7a]/25 rounded-lg px-3 py-2">
                <AlertCircle className="w-3.5 h-3.5 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || totpCode.length < 6}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-gradient-to-r from-[#5eead4] to-[#3ba9ff] text-[#050810] font-bold text-xs transition-all hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <KeyRound className="w-4 h-4" />}
              Verificar Código
            </button>

            <button
              type="button"
              onClick={() => { setStep('password'); setError(''); }}
              className="w-full text-center text-[10px] text-[#506c94] hover:text-[#3ba9ff] transition-colors cursor-pointer"
            >
              ← Voltar
            </button>
          </form>
        )}

        {/* ── Etapa 3: QR Setup ───────────────────────────────────────────── */}
        {step === 'qr-setup' && qrData && (
          <div className="space-y-4">
            <div className="text-center">
              <QrCode className="w-5 h-5 mx-auto mb-2 text-[#5eead4]" />
              <p className="text-[11px] text-[#7a92b8]">Escaneie com Google Authenticator, Authy ou similar</p>
            </div>

            <div className="flex justify-center">
              <img src={qrData.qrCode} alt="QR Code MFA" className="rounded-xl w-44 h-44 border-4 border-[#3ba9ff]/20" />
            </div>

            <div className="bg-[#0a1628] rounded-xl p-3 border border-[#5eead4]/20">
              <p className="text-[9px] text-[#7a92b8] mb-1">Secret (inserção manual):</p>
              <p className="text-[11px] font-mono text-[#5eead4] break-all">{qrData.secret}</p>
            </div>

            <button
              type="button"
              onClick={() => { setStep('password'); setError(''); }}
              className="w-full py-2.5 rounded-xl bg-[#3ba9ff]/20 border border-[#3ba9ff]/40 text-[#5eead4] text-xs font-bold hover:bg-[#3ba9ff]/30 transition-all cursor-pointer"
            >
              Pronto — Fazer Login
            </button>
          </div>
        )}

        {/* ── Concluído ───────────────────────────────────────────────────── */}
        {step === 'done' && (
          <div className="text-center space-y-3">
            <CheckCircle2 className="w-10 h-10 mx-auto text-[#5eead4]" />
            <p className="text-[#e6f0ff]">Autenticado com sucesso!</p>
          </div>
        )}
      </div>
    </div>
  );
};
