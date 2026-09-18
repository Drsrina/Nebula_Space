import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCw, Eye, Code, Split, Terminal, Check } from 'lucide-react';

const DEFAULT_HTML = `<!DOCTYPE html>
<html>
<head>
  <style>
    body {
      font-family: system-ui, sans-serif;
      background: #0d1527;
      color: #e6f0ff;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      min-height: 90vh;
      margin: 0;
      text-align: center;
    }
    .card {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid rgba(59, 169, 255, 0.3);
      padding: 24px;
      border-radius: 16px;
      box-shadow: 0 8px 32px rgba(0,0,0,0.4);
      max-width: 400px;
    }
    h1 { color: #5eead4; margin-top: 0; }
    button {
      background: #3ba9ff;
      color: #050d1a;
      border: none;
      padding: 8px 16px;
      border-radius: 8px;
      font-weight: bold;
      cursor: pointer;
      transition: transform 0.1s;
    }
    button:active { transform: scale(0.96); }
  </style>
</head>
<body>
  <div class="card">
    <h1>🚀 Nebula Live Preview</h1>
    <p>Edite o código à esquerda para ver atualizações instantâneas aqui!</p>
    <button onclick="count++">Cliques: <span id="counter">0</span></button>
  </div>
  <script>
    let count = 0;
    const btn = document.querySelector('button');
    const span = document.getElementById('counter');
    btn.onclick = () => {
      count++;
      span.innerText = count;
      console.log('Botão clicado! Contador:', count);
    };
  </script>
</body>
</html>`;

export const LivePreviewSplitWindow: React.FC = () => {
  const [code, setCode] = useState(DEFAULT_HTML);
  const [previewSrc, setPreviewSrc] = useState('');
  const [logs, setLogs] = useState<string[]>([]);
  const [autoRun, setAutoRun] = useState(true);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  const updatePreview = () => {
    // Inject console capture into preview
    const injectedCode = code.replace(
      '</body>',
      `<script>
        (function() {
          const _log = console.log;
          const _err = console.error;
          console.log = function(...args) {
            window.parent.postMessage({ type: 'NEBULA_LIVE_LOG', text: args.join(' ') }, '*');
            _log.apply(console, args);
          };
          console.error = function(...args) {
            window.parent.postMessage({ type: 'NEBULA_LIVE_ERR', text: args.join(' ') }, '*');
            _err.apply(console, args);
          };
        })();
      </script></body>`
    );
    setPreviewSrc(injectedCode);
  };

  useEffect(() => {
    updatePreview();
  }, []);

  useEffect(() => {
    if (!autoRun) return;
    const timer = setTimeout(() => {
      updatePreview();
    }, 600);
    return () => clearTimeout(timer);
  }, [code, autoRun]);

  useEffect(() => {
    const handleMsg = (e: MessageEvent) => {
      if (e.data?.type === 'NEBULA_LIVE_LOG') {
        setLogs((prev) => [...prev.slice(-40), `[LOG] ${e.data.text}`]);
      } else if (e.data?.type === 'NEBULA_LIVE_ERR') {
        setLogs((prev) => [...prev.slice(-40), `[ERR] ${e.data.text}`]);
      }
    };
    window.addEventListener('message', handleMsg);
    return () => window.removeEventListener('message', handleMsg);
  }, []);

  return (
    <div className="flex flex-col h-full w-full bg-[#050d1a] text-[#e6f0ff] select-none font-mono text-xs">
      {/* Top Bar */}
      <div className="px-3 py-1.5 bg-[#09152a] border-b border-[#142340] flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Split className="w-3.5 h-3.5 text-[#5eead4]" />
          <span className="font-bold text-[#e6f0ff] text-xs">Live Split Preview</span>
        </div>

        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 text-[10px] text-[#7a92b8] cursor-pointer">
            <input
              type="checkbox"
              checked={autoRun}
              onChange={(e) => setAutoRun(e.target.checked)}
              className="rounded bg-[#050d1a] border-[#1e355e] text-[#5eead4] focus:ring-0"
            />
            <span>Auto Atualizar</span>
          </label>

          <button
            onClick={updatePreview}
            className="flex items-center gap-1 px-2 py-0.5 rounded bg-[#3ba9ff]/20 text-[#3ba9ff] hover:bg-[#3ba9ff]/30 transition-colors cursor-pointer"
          >
            <RotateCw className="w-3 h-3" />
            <span>Atualizar</span>
          </button>
        </div>
      </div>

      {/* Split Pane: Code vs Preview */}
      <div className="flex-1 flex min-h-0">
        {/* Left: Code Editor */}
        <div className="w-1/2 flex flex-col border-r border-[#142340]">
          <div className="px-2.5 py-1 bg-[#071020] border-b border-[#142340] text-[10px] text-[#7a92b8] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Code className="w-3 h-3 text-[#3ba9ff]" /> Código HTML / JS
            </span>
            <span>{code.split('\n').length} linhas</span>
          </div>
          <textarea
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="flex-1 w-full bg-[#050d1a] p-3 text-xs text-[#a5f3fc] font-mono focus:outline-none resize-none"
            spellCheck={false}
          />
        </div>

        {/* Right: Live Preview Iframe */}
        <div className="w-1/2 flex flex-col min-h-0 bg-[#071020]">
          <div className="px-2.5 py-1 bg-[#071020] border-b border-[#142340] text-[10px] text-[#7a92b8] flex items-center justify-between">
            <span className="flex items-center gap-1">
              <Eye className="w-3 h-3 text-[#5eead4]" /> Renderização Iframe
            </span>
            <span className="text-[#22c55e] flex items-center gap-1">
              <Check className="w-2.5 h-2.5" /> Sandbox ativo
            </span>
          </div>

          <div className="flex-1 relative bg-white min-h-0">
            <iframe
              ref={iframeRef}
              srcDoc={previewSrc}
              sandbox="allow-scripts allow-modals"
              title="Nebula Live Preview"
              className="w-full h-full border-none"
            />
          </div>

          {/* Bottom Console logs */}
          {logs.length > 0 && (
            <div className="h-24 bg-[#050a14] border-t border-[#142340] p-1.5 overflow-y-auto font-mono text-[10px]">
              <div className="text-[9px] text-[#7a92b8] pb-1 flex items-center gap-1 border-b border-[#142340] mb-1">
                <Terminal className="w-2.5 h-2.5" /> Console do Preview
              </div>
              {logs.map((l, i) => (
                <div
                  key={i}
                  className={l.startsWith('[ERR]') ? 'text-[#ef4444]' : 'text-[#38bdf8]'}
                >
                  {l}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
