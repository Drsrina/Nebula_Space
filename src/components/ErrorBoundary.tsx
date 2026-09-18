import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[Nebula ErrorBoundary] Uncaught error:', error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen bg-[#050810] flex flex-col items-center justify-center p-6 text-center select-none font-sans">
          <div className="w-16 h-16 rounded-2xl bg-[#ff5c7a]/15 border border-[#ff5c7a]/30 flex items-center justify-center text-[#ff5c7a] mb-4 shadow-[0_0_30px_rgba(255,92,122,0.2)]">
            <AlertTriangle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-[#e6f0ff] mb-2 font-mono">
            Nebula Workspace — Recuperação do Canvas
          </h2>
          <p className="text-xs text-[#7a92b8] max-w-md mb-4 font-mono">
            Ocorreu uma falha inesperada na renderização de um componente espacial:
          </p>
          <pre className="max-w-lg p-3 rounded-xl bg-[#0a1426] border border-[#ff5c7a]/20 text-[11px] font-mono text-[#ff8ba7] overflow-auto mb-6 text-left">
            {this.state.error?.message || 'Erro desconhecido'}
          </pre>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => {
                try {
                  localStorage.clear();
                  indexedDB.deleteDatabase('nebula-db');
                } catch {
                  // ignore
                }
                window.location.reload();
              }}
              className="px-4 py-2 rounded-xl bg-[#ff5c7a]/20 hover:bg-[#ff5c7a]/30 text-[#ff8ba7] border border-[#ff5c7a]/40 text-xs font-mono font-bold transition-all cursor-pointer"
            >
              Resetar Layout & Recarregar
            </button>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="px-4 py-2 rounded-xl bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#5eead4] border border-[#3ba9ff]/40 text-xs font-mono font-bold transition-all cursor-pointer flex items-center gap-1.5"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Tentar Novamente</span>
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
