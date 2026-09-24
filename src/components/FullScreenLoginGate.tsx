import React, { useState } from 'react';
import {
  Lock,
  KeyRound,
  Eye,
  EyeOff,
  Loader2,
  AlertCircle,
  Sparkles,
  ShieldCheck,
  CheckCircle2,
} from 'lucide-react';
import { setAuthToken } from '../lib/api';

interface FullScreenLoginGateProps {
  onLoginSuccess: (token: string) => void;
}

type Step = 'password' | 'totp';

export const FullScreenLoginGate: React.FC<FullScreenLoginGateProps> = ({ onLoginSuccess }) => {
  const [step, setStep] = useState<Step>('password');
  const [password, setPassword] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

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
        setStep('totp');
      } else if (res.ok && data.token) {
        setAuthToken(data.token);
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Senha incorreta.');
      }
    } catch {
      setError('Não foi possível conectar ao servidor do Nebula.');
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
        onLoginSuccess(data.token);
      } else {
        setError(data.error || 'Código TOTP inválido.');
      }
    } catch {
      setError('Não foi possível conectar ao servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[999999] bg-[#050810] flex flex-col items-center justify-center p-6 select-none overflow-hidden font-sans">
      {/* Ambient background glows */}
      <div
        className="absolute w-[800px] h-[800px] rounded-full pointer-events-none blur-[140px] opacity-20"
        style={{
          background: 'radial-gradient(circle, #5eead4 0%, #3ba9ff 45%, transparent 75%)',
          left: 'calc(50% - 400px)',
          top: 'calc(50% - 400px)',
        }}
      />
      <div
        className="absolute w-[600px] h-[600px] rounded-full pointer-events-none blur-[120px] opacity-15"
        style={{
          background: 'radial-gradient(circle, #a78bfa 0%, #3ba9ff 50%, transparent 70%)',
          left: 'calc(50% - 300px)',
          top: 'calc(50% - 300px)',
        }}
      />

      {/* Login Card */}
      <div className="relative z-10 w-full max-w-md bg-[#0a1426]/90 backdrop-blur-2xl border border-[#3ba9ff]/30 rounded-3xl p-8 shadow-[0_0_60px_rgba(59,169,255,0.2),0_25px_50px_rgba(0,0,0,0.8)] flex flex-col gap-6">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center gap-3">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#3ba9ff] to-[#5eead4] flex items-center justify-center shadow-[0_0_35px_rgba(94,234,212,0.4)]">
            <Sparkles className="w-8 h-8 text-[#050810]" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider uppercase font-mono">
              Nebula Workspace
            </h1>
            <p className="text-xs text-[#7a92b8] mt-1 font-mono">
              Ambiente Espacial 3D · Autenticação Segura
            </p>
          </div>
        </div>

        {/* Credentials helper banner */}
        <div className="p-3 rounded-xl bg-[#070e1c] border border-[#3ba9ff]/20 text-xs font-mono flex items-center gap-2.5">
          <ShieldCheck className="w-4 h-4 text-[#5eead4] shrink-0" />
          <div className="text-[11px] text-[#7a92b8]">
            <span className="text-[#34d399] font-semibold">Credenciais Padrão:</span><br />
            Usuário: <strong className="text-white">admin</strong> | Senha: <strong className="text-white">admin123</strong>
          </div>
        </div>

        {/* Step: Password */}
        {step === 'password' && (
          <form onSubmit={handlePasswordSubmit} className="flex flex-col gap-4">
            <div>
              <label className="text-[11px] font-mono text-[#7a92b8] mb-1.5 block">
                Senha Administrativa
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-[#3ba9ff] absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Digite sua senha..."
                  autoFocus
                  className="w-full pl-10 pr-10 py-3 rounded-xl bg-[#060c18] border border-[#3ba9ff]/30 focus:border-[#5eead4] text-[#e6f0ff] text-xs font-mono outline-none transition-all focus:ring-1 focus:ring-[#5eead4]/40"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-[#506c94] hover:text-[#e6f0ff] transition-colors cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#ff5c7a] bg-[#ff5c7a]/10 border border-[#ff5c7a]/30 rounded-xl px-3.5 py-2.5 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || !password}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#3ba9ff] to-[#5eead4] text-[#050810] font-bold text-xs font-mono transition-all hover:opacity-95 shadow-[0_0_20px_rgba(59,169,255,0.4)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#050810]" />
              ) : (
                <Lock className="w-4 h-4 text-[#050810]" />
              )}
              <span>Entrar no Workspace</span>
            </button>
          </form>
        )}

        {/* Step: TOTP */}
        {step === 'totp' && (
          <form onSubmit={handleTotpSubmit} className="flex flex-col gap-4">
            <div className="text-center text-xs font-mono text-[#7a92b8]">
              <KeyRound className="w-6 h-6 mx-auto mb-2 text-[#5eead4]" />
              Digite o código de 6 dígitos gerado pelo seu aplicativo autenticador:
            </div>

            <div className="relative">
              <KeyRound className="w-4 h-4 text-[#5eead4] absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-[#060c18] border border-[#5eead4]/40 focus:border-[#5eead4] text-[#e6f0ff] text-center text-xl tracking-[0.4em] font-mono font-bold outline-none transition-all"
              />
            </div>

            {error && (
              <div className="flex items-center gap-2 text-[#ff5c7a] bg-[#ff5c7a]/10 border border-[#ff5c7a]/30 rounded-xl px-3.5 py-2.5 text-xs font-mono">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <button
              type="submit"
              disabled={isLoading || totpCode.length < 6}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-[#5eead4] to-[#3ba9ff] text-[#050810] font-bold text-xs font-mono transition-all hover:opacity-95 shadow-[0_0_20px_rgba(94,234,212,0.4)] disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
            >
              {isLoading ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>Verificar Código</span>
            </button>

            <button
              type="button"
              onClick={() => { setStep('password'); setError(''); }}
              className="text-center text-[11px] font-mono text-[#506c94] hover:text-[#3ba9ff] transition-colors py-1 cursor-pointer"
            >
              ← Voltar para senha
            </button>
          </form>
        )}
      </div>
    </div>
  );
};
