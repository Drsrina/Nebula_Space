import React, { useRef, useState, useEffect, useCallback } from "react";
import { Terminal, Trash2, Copy, X } from "lucide-react";
import { authFetch } from "../../lib/api";

interface TerminalLine {
  id: string;
  type: "command" | "output" | "error" | "info";
  content: string;
}

const WELCOME: TerminalLine[] = [
  { id: "w1", type: "info", content: "╭──────────────────────────────────────────╮" },
  { id: "w2", type: "info", content: "│  Nebula Terminal  •  powered by Node.js  │" },
  { id: "w3", type: "info", content: "╰──────────────────────────────────────────╯" },
  { id: "w4", type: "info", content: 'Comandos: clear, echo, node -v, npm -v, date, pwd' },
];

export const TerminalWindow: React.FC = () => {
  const [lines, setLines] = useState<TerminalLine[]>(WELCOME);
  const [input, setInput] = useState("");
  const [isRunning, setIsRunning] = useState(false);
  const [cwd, setCwd] = useState("~");
  const [history, setHistory] = useState<string[]>([]);
  const [histIdx, setHistIdx] = useState(-1);
  const outputRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    outputRef.current?.scrollTo({ top: outputRef.current.scrollHeight, behavior: "smooth" });
  }, [lines]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const addLine = useCallback((l: Omit<TerminalLine, "id">) => {
    setLines((p) => [...p, { ...l, id: `l-${Date.now()}-${Math.random()}` }]);
  }, []);

  const simulate = (cmd: string) => {
    const p = cmd.split(" ");
    const base = p[0].toLowerCase();
    if (base === "echo") { addLine({ type: "output", content: p.slice(1).join(" ") }); return; }
    if (base === "pwd") { addLine({ type: "output", content: cwd }); return; }
    if (base === "date") { addLine({ type: "output", content: new Date().toString() }); return; }
    if (base === "node") { addLine({ type: "output", content: "v22.14.0" }); return; }
    if (base === "npm") { addLine({ type: "output", content: "10.9.0" }); return; }
    if (base === "help") {
      ["Comandos disponiveis:",
       "clear / cls  - Limpa a tela",
       "echo <texto> - Imprime texto",
       "pwd          - Diretorio atual",
       "date         - Data e hora atual"].forEach((l) => addLine({ type: "output", content: l }));
      return;
    }
    addLine({ type: "error", content: `comando "${base}" nao encontrado. Digite "help" para ajuda.` });
  };

  const runCmd = useCallback(async (cmd: string) => {
    const t = cmd.trim();
    if (!t) return;
    setHistory((p) => [t, ...p.slice(0, 49)]);
    setHistIdx(-1);
    addLine({ type: "command", content: t, cwd });
    if (t === "clear" || t === "cls") { setLines([]); return; }
    setIsRunning(true);
    try {
      const res = await authFetch("/api/terminal/exec", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: t, cwd }),
      });
      if (res.ok) {
        const d = await res.json();
        (d.stdout || "").split("\n").filter(Boolean).forEach((l: string) => addLine({ type: "output", content: l }));
        (d.stderr || "").split("\n").filter(Boolean).forEach((l: string) => addLine({ type: "error", content: l }));
        if (d.cwd) setCwd(d.cwd);
      } else { simulate(t); }
    } catch { simulate(t); }
    finally { setIsRunning(false); }
  }, [addLine, cwd]);

  const onKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") { runCmd(input); setInput(""); }
    else if (e.key === "ArrowUp") {
      e.preventDefault();
      const i = Math.min(histIdx + 1, history.length - 1);
      setHistIdx(i); setInput(history[i] || "");
    } else if (e.key === "ArrowDown") {
      e.preventDefault();
      const i = Math.max(histIdx - 1, -1);
      setHistIdx(i); setInput(i === -1 ? "" : history[i] || "");
    } else if (e.ctrlKey && e.key === "c") { setInput(""); addLine({ type: "info", content: "^C" }); }
    else if (e.ctrlKey && e.key === "l") { e.preventDefault(); setLines([]); }
  };

  const lineStyle = (t: TerminalLine["type"]) => ({
    command: "text-[#5eead4] font-semibold",
    error: "text-[#ff6b8a]",
    info: "text-[#3ba9ff]/60 italic",
    output: "text-[#c8d9f0]",
  }[t]);

  return (
    <div className="flex flex-col h-full bg-[#040810] text-[#c8d9f0] select-text" onClick={() => inputRef.current?.focus()}>
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#060d1c] border-b border-[#0f1e38] shrink-0">
        <div className="flex items-center gap-2">
          <Terminal className="w-3.5 h-3.5 text-[#5eead4]" />
          <span className="text-[11px] font-semibold text-[#a3b8d7]">Terminal</span>
          <span className="text-[10px] text-[#3ba9ff]/60 font-mono bg-[#0f1e38] px-1.5 py-0.5 rounded">{cwd}</span>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => { const t = lines.map((l) => (l.type === "command" ? "$ " + l.content : l.content)).join("\n"); navigator.clipboard.writeText(t); }} title="Copiar saída" className="p-1 rounded hover:bg-[#0f1e38] text-[#5e779d] hover:text-[#5eead4] transition-colors"><Copy className="w-3 h-3" /></button>
          <button onClick={() => setLines([])} title="Limpar (Ctrl+L)" className="p-1 rounded hover:bg-[#0f1e38] text-[#5e779d] hover:text-[#ff6b8a] transition-colors"><Trash2 className="w-3 h-3" /></button>
        </div>
      </div>

      <div ref={outputRef} className="flex-1 overflow-y-auto px-3 py-2 font-mono text-[12px] leading-relaxed" style={{ scrollbarWidth: "thin", scrollbarColor: "#1b2c4d transparent" }}>
        {lines.map((l) => (
          <div key={l.id} className={`whitespace-pre-wrap break-all ${lineStyle(l.type)}`}>
            {l.type === "command" ? <><span className="text-[#a78bfa] mr-1">❯</span>{l.content}</> : l.content}
          </div>
        ))}
        {isRunning && <div className="text-[#3ba9ff]/60 animate-pulse text-[11px]">⋯ executando...</div>}
      </div>

      <div className="flex items-center gap-2 px-3 py-2 bg-[#060d1c] border-t border-[#0f1e38] shrink-0">
        <span className="text-[#a78bfa] font-mono text-[12px] shrink-0">❯</span>
        <input ref={inputRef} type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKey} disabled={isRunning} placeholder={isRunning ? "aguardando..." : "Digite um comando... (help)"} className="flex-1 bg-transparent border-none outline-none font-mono text-[12px] text-[#e2edff] placeholder-[#2a3d5a] caret-[#5eead4]" spellCheck={false} autoComplete="off" />
        {input && <button onClick={() => setInput("")} className="text-[#2a3d5a] hover:text-[#5e779d] transition-colors"><X className="w-3 h-3" /></button>}
      </div>
    </div>
  );
};
