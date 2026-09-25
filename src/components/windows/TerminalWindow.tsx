import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Terminal, Trash2, Copy, X, CornerDownLeft, Play, Sparkles } from 'lucide-react';
import { authFetch } from '../../lib/api';

interface TerminalLine {
  id: string;
  type: 'command' | 'output' | 'error' | 'info';
  content: string;
  cwd?: string;
  timestamp?: number;
}

const WELCOME: TerminalLine[] = [
  { id: 'w1', type: 'info', content: '╭──────────────────────────────────────────────────╮' },
  { id: 'w2', type: 'info', content: '│  Nebula Interactive Cloud Terminal • v2.8.1       │' },
  { id: 'w3', type: 'info', content: '│  Shell Real no Container Docker (/bin/bash & sh)  │' },
  { id: 'w4', type: 'info', content: '╰──────────────────────────────────────────────────╯' },
  { id: 'w5', type: 'info', content: 'Comandos rápidos: ls -la, git status, pwd, cd, npm test' },
];

/**
 * Parses ANSI escape sequences and renders colored spans
 */
function renderAnsiContent(text: string) {
  // Simple & efficient ANSI parser for terminal colors
  const ansiRegex = /\x1b\[([0-9;]+)m/g;
  if (!text.includes('\x1b[')) {
    return text;
  }

  const parts: React.ReactNode[] = [];
  let lastIndex = 0;
  let currentColorClass = '';
  let match: RegExpExecArray | null;

  while ((match = ansiRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      const chunk = text.slice(lastIndex, match.index);
      parts.push(
        <span key={lastIndex} className={currentColorClass}>
          {chunk}
        </span>
      );
    }

    const code = match[1];
    switch (code) {
      case '0':
        currentColorClass = '';
        break;
      case '1':
        currentColorClass = 'font-bold';
        break;
      case '31':
      case '91':
        currentColorClass = 'text-[#ff5c7a]';
        break;
      case '32':
      case '92':
        currentColorClass = 'text-[#5eead4]';
        break;
      case '33':
      case '93':
        currentColorClass = 'text-[#fcd34d]';
        break;
      case '34':
      case '94':
        currentColorClass = 'text-[#60a5fa]';
        break;
      case '35':
      case '95':
        currentColorClass = 'text-[#c084fc]';
        break;
      case '36':
      case '96':
        currentColorClass = 'text-[#38bdf8]';
        break;
      default:
        break;
    }
    lastIndex = ansiRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(
      <span key={lastIndex} className={currentColorClass}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return <>{parts}</>;
}

export const TerminalWindow: React.FC = () => {
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [cwd, setCwd] = useState('~');
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-scroll on lines change
  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: 'smooth' });
  }, [lines, isRunning]);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const addLine = useCallback((l: Omit<TerminalLine, 'id'>) => {
    setLines((p) => [...p, { ...l, id: `l-${Date.now()}-${Math.random()}`, timestamp: Date.now() }]);
  }, []);

  const simulate = (cmd: string) => {
    const p = cmd.split(' ');
    const base = p[0].toLowerCase();
    if (base === 'echo') {
      addLine({ type: 'output', content: p.slice(1).join(' ') });
      return;
    }
    if (base === 'pwd') {
      addLine({ type: 'output', content: cwd });
      return;
    }
    if (base === 'date') {
      addLine({ type: 'output', content: new Date().toString() });
      return;
    }
    if (base === 'node') {
      addLine({ type: 'output', content: 'v22.14.0' });
      return;
    }
    if (base === 'npm') {
      addLine({ type: 'output', content: '10.9.0' });
      return;
    }
    if (base === 'help') {
      [
        'Comandos disponíveis:',
        'clear / cls  - Limpa a tela',
        'echo <texto> - Imprime texto',
        'pwd          - Diretório atual',
        'cd <pasta>   - Navega entre pastas no container',
        'date         - Data e hora atual',
        'ls -la       - Lista arquivos detalhados',
      ].forEach((l) => addLine({ type: 'output', content: l }));
      return;
    }
    addLine({
      type: 'error',
      content: `comando "${base}" não encontrado. Digite "help" para ajuda.`,
    });
  };

  const runCmd = useCallback(
    async (cmd: string) => {
      const t = cmd.trim();
      if (!t) return;

      setHistory((p) => [t, ...p.filter((h) => h !== t).slice(0, 49)]);
      setHistIdx(-1);
      addLine({ type: 'command', content: t, cwd });

      if (t === 'clear' || t === 'cls') {
        setLines([]);
        return;
      }

      setIsRunning(true);
      try {
        const res = await authFetch('/api/terminal/exec', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ command: t, cwd }),
        });

        if (res.ok) {
          const d = await res.json();
          if (d.stdout) {
            d.stdout
              .split('\n')
              .filter((l: string, idx: number, arr: string[]) => idx < arr.length - 1 || l.length > 0)
              .forEach((l: string) => addLine({ type: 'output', content: l }));
          }
          if (d.stderr) {
            d.stderr
              .split('\n')
              .filter((l: string, idx: number, arr: string[]) => idx < arr.length - 1 || l.length > 0)
              .forEach((l: string) => addLine({ type: 'error', content: l }));
          }
          if (d.cwd) {
            setCwd(d.cwd);
          }
        } else {
          simulate(t);
        }
      } catch {
        simulate(t);
      } finally {
        setIsRunning(false);
      }
    },
    [addLine, cwd]
  );

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      runCmd(input);
      setInput('');
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const i = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(i);
      setInput(history[i] || '');
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i);
      setInput(i === -1 ? '' : history[i] || '');
    } else if (e.ctrlKey && e.key === 'c') {
      setInput('');
      addLine({ type: 'info', content: '^C' });
    } else if (e.ctrlKey && e.key === 'l') {
      e.preventDefault();
      setLines([]);
    }
  };

  const lineStyle = (t: TerminalLine['type']) =>
    ({
      command: 'text-[#5eead4] font-semibold',
      error: 'text-[#ff6b8a]',
      info: 'text-[#3ba9ff]/70 italic',
      output: 'text-[#c8d9f0]',
    }[t]);

  const QUICK_COMMANDS = ['ls -la', 'pwd', 'git status', 'node -v', 'git log --oneline -5'];

  return (
    <div
      className="flex flex-col h-full bg-[#040810] text-[#c8d9f0] select-text"
      onClick={() => inputRef.current?.focus()}
    >
      {/* Terminal Title Bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#060d1c] border-b border-[#0f1e38] shrink-0 select-none">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#5eead4]" />
          <span className="text-[11px] font-semibold text-[#a3b8d7]">Terminal Real</span>
          <span
            className="text-[10px] text-[#3ba9ff] font-mono bg-[#0f1e38] px-2 py-0.5 rounded border border-[#1d3257] truncate max-w-[260px]"
            title={cwd}
          >
            {cwd}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const t = lines
                .map((l) => (l.type === 'command' ? '$ ' + l.content : l.content))
                .join('\n');
              navigator.clipboard.writeText(t);
            }}
            title="Copiar saída"
            className="p-1 rounded hover:bg-[#0f1e38] text-[#5e779d] hover:text-[#5eead4] transition-colors cursor-pointer"
          >
            <Copy className="w-3 h-3" />
          </button>
          <button
            onClick={() => setLines([])}
            title="Limpar (Ctrl+L)"
            className="p-1 rounded hover:bg-[#0f1e38] text-[#5e779d] hover:text-[#ff6b8a] transition-colors cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>
      </div>

      {/* Quick Command Chips */}
      <div className="flex items-center gap-1 px-3 py-1 bg-[#050a17] border-b border-[#0f1e38] overflow-x-auto shrink-0 select-none">
        <span className="text-[10px] text-[#506c94] font-mono mr-1">Rápido:</span>
        {QUICK_COMMANDS.map((qc) => (
          <button
            key={qc}
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              runCmd(qc);
            }}
            className="px-2 py-0.5 rounded bg-[#0b172e] hover:bg-[#152a4f] text-[10px] font-mono text-[#8ea8cc] hover:text-[#5eead4] border border-[#1b345e] transition-colors cursor-pointer"
          >
            {qc}
          </button>
        ))}
      </div>

      {/* Output Console Area */}
      <div
        ref={outputRef}
        className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed"
        style={{ scrollbarWidth: 'thin', scrollbarColor: '#1b2c4d transparent' }}
      >
        {lines.map((l) => (
          <div key={l.id} className={`whitespace-pre-wrap break-all ${lineStyle(l.type)}`}>
            {l.type === 'command' ? (
              <>
                <span className="text-[#a78bfa] mr-1.5 font-bold">❯</span>
                <span>{l.content}</span>
              </>
            ) : (
              renderAnsiContent(l.content)
            )}
          </div>
        ))}
        {isRunning && (
          <div className="text-[#3ba9ff] animate-pulse text-[11px] flex items-center gap-1.5 py-1">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4]" />
            <span>Executando no container...</span>
          </div>
        )}
      </div>

      {/* Input Prompt */}
      <div className="flex items-center gap-2 px-3 py-2 bg-[#060d1c] border-t border-[#0f1e38] shrink-0">
        <span className="text-[#a78bfa] font-mono text-[12px] font-bold shrink-0">❯</span>
        <input
          ref={inputRef}
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={onKey}
          disabled={isRunning}
          placeholder={isRunning ? 'aguardando execução...' : 'Digite um comando... (ex: ls -la)'}
          className="flex-1 bg-transparent border-none outline-none font-mono text-[12px] text-[#e2edff] placeholder-[#2a3d5a] caret-[#5eead4]"
          spellCheck={false}
          autoComplete="off"
        />
        {input && (
          <button
            onClick={() => setInput('')}
            className="text-[#2a3d5a] hover:text-[#5e779d] transition-colors cursor-pointer"
          >
            <X className="w-3 h-3" />
          </button>
        )}
      </div>
    </div>
  );
};
