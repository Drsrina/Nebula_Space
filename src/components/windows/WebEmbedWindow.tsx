import React, { useState, useRef } from 'react';
import { Globe, RefreshCw, ChevronLeft, ChevronRight, X, ExternalLink, ShieldCheck, ShieldAlert } from 'lucide-react';

interface WebEmbedPayload {
  url?: string;
}

interface WebEmbedWindowProps {
  payload?: WebEmbedPayload;
}

export const WebEmbedWindow: React.FC<WebEmbedWindowProps> = ({ payload }) => {
  const [inputUrl, setInputUrl] = useState(payload?.url ?? '');
  const [activeUrl, setActiveUrl] = useState(payload?.url ?? '');
  const [useProxy, setUseProxy] = useState(true);
  const [history, setHistory] = useState<string[]>(payload?.url ? [payload.url] : []);
  const [historyIndex, setHistoryIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [hasError, setHasError] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const navigate = (url: string) => {
    let normalized = url.trim();
    if (!normalized) return;
    if (!normalized.startsWith('http://') && !normalized.startsWith('https://')) {
      // Se não parece um domínio com ponto ou tem espaço, usa busca amigável a embeds
      if (normalized.includes('.') && !normalized.includes(' ')) {
        normalized = 'https://' + normalized;
      } else {
        normalized = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(normalized)}`;
      }
    }
    setActiveUrl(normalized);
    setInputUrl(normalized);
    setHasError(false);
    const newHistory = [...history.slice(0, historyIndex + 1), normalized];
    setHistory(newHistory);
    setHistoryIndex(newHistory.length - 1);
    setIsLoading(true);
  };

  const goBack = () => {
    if (historyIndex > 0) {
      const newIdx = historyIndex - 1;
      setHistoryIndex(newIdx);
      setActiveUrl(history[newIdx]);
      setInputUrl(history[newIdx]);
      setIsLoading(true);
    }
  };

  const goForward = () => {
    if (historyIndex < history.length - 1) {
      const newIdx = historyIndex + 1;
      setHistoryIndex(newIdx);
      setActiveUrl(history[newIdx]);
      setInputUrl(history[newIdx]);
      setIsLoading(true);
    }
  };

  const reload = () => {
    if (iframeRef.current) {
      const target = useProxy ? `/api/proxy/web?url=${encodeURIComponent(activeUrl)}` : activeUrl;
      iframeRef.current.src = target;
      setIsLoading(true);
    }
  };

  const SHORTCUTS = [
    { label: 'DuckDuckGo', url: 'https://html.duckduckgo.com' },
    { label: 'DevDocs.io', url: 'https://devdocs.io' },
    { label: 'MDN Web Docs', url: 'https://developer.mozilla.org/pt-BR' },
    { label: 'Wikipedia', url: 'https://pt.wikipedia.org' },
    { label: 'GitHub', url: 'https://github.com' },
    { label: 'npm', url: 'https://npmjs.com' },
  ];

  return (
    <div className="flex flex-col h-full bg-[#060d1c]">
      {/* Browser Toolbar */}
      <div className="flex items-center gap-1.5 px-2 py-1.5 border-b border-[#1a2a4a] bg-[#080f1e]">
        <button
          onClick={goBack}
          disabled={historyIndex <= 0}
          className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all disabled:opacity-30"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={goForward}
          disabled={historyIndex >= history.length - 1}
          className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all disabled:opacity-30"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
        <button
          onClick={reload}
          className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
        </button>

        {/* URL Bar */}
        <div className="flex-1 flex items-center gap-1 bg-[#0a1628] border border-[#1a2a4a] rounded-full px-3 py-0.5">
          <Globe className="w-3 h-3 text-[#4a6080] shrink-0" />
          <input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') navigate(inputUrl); }}
            placeholder="URL ou pesquisa..."
            className="flex-1 bg-transparent text-xs text-[#e6f0ff] font-mono focus:outline-none"
          />
          {inputUrl && (
            <button onClick={() => { setInputUrl(''); }} className="text-[#4a6080] hover:text-[#e6f0ff]">
              <X className="w-3 h-3" />
            </button>
          )}
        </div>

        <button
          onClick={() => setUseProxy(!useProxy)}
          className={`flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-mono border transition-all ${
            useProxy
              ? 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/40 shadow-[0_0_10px_rgba(16,185,129,0.15)]'
              : 'bg-[#1a2a4a]/50 text-[#7a92b8] border-[#1a2a4a] hover:text-[#e6f0ff]'
          }`}
          title={useProxy ? "Modo Proxy Ativo: contorna bloqueios de X-Frame-Options (Google, GitHub)" : "Modo Direto: carrega URL pura"}
        >
          {useProxy ? <ShieldCheck className="w-3 h-3 text-[#34d399]" /> : <ShieldAlert className="w-3 h-3 text-[#7a92b8]" />}
          <span className="hidden sm:inline">{useProxy ? 'Proxy ON' : 'Proxy OFF'}</span>
        </button>

        <button
          onClick={() => activeUrl && window.open(activeUrl, '_blank')}
          className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all"
          title="Abrir no browser nativo"
        >
          <ExternalLink className="w-3 h-3" />
        </button>
      </div>

      {/* Quick Shortcuts */}
      {!activeUrl && (
        <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-[#1a2a4a] overflow-x-auto">
          {SHORTCUTS.map((s) => (
            <button
              key={s.url}
              onClick={() => navigate(s.url)}
              className="shrink-0 text-[10px] font-mono px-2 py-0.5 rounded border border-[#1a2a4a] text-[#4a6080] hover:text-[#34d399] hover:border-[#34d399]/30 transition-all"
            >
              {s.label}
            </button>
          ))}
        </div>
      )}

      {/* Iframe content */}
      <div className="flex-1 overflow-hidden bg-white relative">
        {activeUrl ? (
          <>
            <iframe
              ref={iframeRef}
              src={useProxy ? `/api/proxy/web?url=${encodeURIComponent(activeUrl)}` : activeUrl}
              className="w-full h-full border-0"
              onLoad={() => { setIsLoading(false); setHasError(false); }}
              onError={() => {
                setIsLoading(false);
                setHasError(true);
              }}
              title="Web Embed"
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-modals"
            />
            {/* Overlay hint — shown only when loading failed */}
            {hasError && (
              <div className="absolute bottom-2 right-2 flex items-center gap-2 bg-[#1a0a10]/95 backdrop-blur-md px-3 py-1 rounded-lg border border-[#ff5c7a]/30 text-[10px] text-[#ff9aaa]">
                <span>⚠ Falha ao carregar</span>
                <button
                  onClick={() => setUseProxy(!useProxy)}
                  className="text-[#3ba9ff] hover:underline"
                >
                  {useProxy ? 'Tentar Direto' : 'Ativar Proxy'}
                </button>
                <span>•</span>
                <button
                  onClick={() => window.open(activeUrl, '_blank')}
                  className="text-[#5eead4] hover:underline flex items-center gap-0.5"
                >
                  Nova Aba <ExternalLink className="w-2.5 h-2.5" />
                </button>
              </div>
            )}
          </>
        ) : (
          <div className="flex flex-col items-center justify-center h-full bg-[#060d1c] text-[#4a6080] gap-3">
            <Globe className="w-12 h-12 opacity-20" />
            <p className="text-xs font-mono">Digite uma URL ou pesquisa acima</p>
          </div>
        )}
      </div>
    </div>
  );
};
