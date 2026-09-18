import React, { useState, useEffect, useRef } from 'react';
import { Play, RotateCcw, Trash2, Terminal as TerminalIcon, Sparkles, CheckCircle2, AlertCircle, Loader2, Code2 } from 'lucide-react';

const MonacoEditor = React.lazy(() => import('@monaco-editor/react'));

type Language = 'javascript' | 'python';

interface OutputLine {
  type: 'stdout' | 'stderr' | 'result' | 'system';
  content: string;
  timestamp: string;
}

const TEMPLATES: Record<Language, { name: string; code: string }[]> = {
  javascript: [
    {
      name: 'Hello & Math',
      code: `// Nebula JavaScript Sandbox\nconsole.log("Olá do Code Sandbox no Nebula v2.7!");\n\nconst items = [10, 25, 45, 80, 120];\nconst total = items.reduce((acc, curr) => acc + curr, 0);\nconsole.log("Total calculado:", total);\n\nreturn { total, count: items.length, average: total / items.length };`,
    },
    {
      name: 'Async Simulation',
      code: `// Async Promise Simulation\nconsole.log("Iniciando tarefa assíncrona...");\n\nawait new Promise(resolve => setTimeout(resolve, 600));\nconsole.log("Processamento concluído!");\n\nreturn { status: "success", timestamp: Date.now() };`,
    },
    {
      name: 'Data Transformation',
      code: `const users = [\n  { id: 1, name: "Alice", role: "admin" },\n  { id: 2, name: "Bob", role: "developer" },\n  { id: 3, name: "Carol", role: "designer" }\n];\n\nconst roles = users.map(u => \`\${u.name} (\${u.role})\`);\nconsole.log("Usuários mapeados:", roles);\n\nreturn roles;`,
    },
  ],
  python: [
    {
      name: 'Hello & List Comprehension',
      code: `# Nebula Python Sandbox (Pyodide WebAssembly)\nimport sys\n\nprint("Olá do Python no navegador!")\nprint(f"Versão Python: {sys.version.split()[0]}")\n\nnumbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]\nsquares = [x**2 for x in numbers if x % 2 == 0]\nprint(f"Quadrados dos pares: {squares}")\n\n{"even_squares": squares, "sum": sum(squares)}`,
    },
    {
      name: 'Data Aggregation & Dicts',
      code: `# Processamento de Dicionários\norders = [\n    {"id": "A1", "price": 49.90, "qty": 3},\n    {"id": "A2", "price": 120.00, "qty": 1},\n    {"id": "A3", "price": 15.50, "qty": 5},\n]\n\ntotal_revenue = sum(o["price"] * o["qty"] for o in orders)\nprint(f"Faturamento Total: R$ {total_revenue:.2f}")\n\nfor order in orders:\n    subtotal = order["price"] * order["qty"]\n    print(f"Pedido {order['id']}: R$ {subtotal:.2f}")\n\ntotal_revenue`,
    },
    {
      name: 'Fibonacci Sequence',
      code: `# Sequência de Fibonacci recursiva com memoization\ndef fibonacci(n, memo={}):\n    if n in memo: return memo[n]\n    if n <= 1: return n\n    memo[n] = fibonacci(n - 1, memo) + fibonacci(n - 2, memo)\n    return memo[n]\n\nterms = [fibonacci(i) for i in range(15)]\nprint("Primeiros 15 termos de Fibonacci:")\nprint(terms)\n\nterms`,
    },
  ],
};

declare global {
  interface Window {
    loadPyodide?: (config: { indexURL: string }) => Promise<any>;
    __nebula_pyodide?: any;
    __nebula_pyodide_loading?: Promise<any>;
  }
}

export const CodeSandboxWindow: React.FC = () => {
  const [language, setLanguage] = useState<Language>('javascript');
  const [code, setCode] = useState<string>(TEMPLATES.javascript[0].code);
  const [outputs, setOutputs] = useState<OutputLine[]>([]);
  const [isRunning, setIsRunning] = useState(false);
  const [pyodideStatus, setPyodideStatus] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [executionTime, setExecutionTime] = useState<number | null>(null);

  const consoleEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    consoleEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [outputs]);

  const addOutput = (type: OutputLine['type'], content: string) => {
    const timestamp = new Date().toLocaleTimeString();
    setOutputs((prev) => [...prev, { type, content, timestamp }]);
  };

  const handleLanguageChange = (newLang: Language) => {
    if (newLang === language) return;
    setLanguage(newLang);
    setCode(TEMPLATES[newLang][0].code);
    addOutput('system', `Linguagem alterada para ${newLang === 'javascript' ? 'JavaScript' : 'Python (Pyodide WASM)'}.`);
  };

  // Inicializador seguro do Pyodide via CDN
  const initPyodide = async (): Promise<any> => {
    if (window.__nebula_pyodide) {
      return window.__nebula_pyodide;
    }

    if (window.__nebula_pyodide_loading) {
      return window.__nebula_pyodide_loading;
    }

    setPyodideStatus('loading');
    addOutput('system', 'Carregando runtime Python WebAssembly (Pyodide 0.27)...');

    const loaderPromise = new Promise(async (resolve, reject) => {
      try {
        if (!window.loadPyodide) {
          const script = document.createElement('script');
          script.src = 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/pyodide.js';
          script.async = true;
          await new Promise((res, rej) => {
            script.onload = res;
            script.onerror = () => rej(new Error('Falha ao carregar script do Pyodide via CDN'));
            document.head.appendChild(script);
          });
        }

        const pyodide = await window.loadPyodide!({
          indexURL: 'https://cdn.jsdelivr.net/pyodide/v0.27.2/full/',
        });

        window.__nebula_pyodide = pyodide;
        setPyodideStatus('ready');
        addOutput('system', 'Runtime Python inicializado com sucesso.');
        resolve(pyodide);
      } catch (err: any) {
        setPyodideStatus('error');
        addOutput('stderr', `Erro ao inicializar Pyodide: ${err.message}`);
        reject(err);
      } finally {
        window.__nebula_pyodide_loading = undefined;
      }
    });

    window.__nebula_pyodide_loading = loaderPromise;
    return loaderPromise;
  };

  // Execução do código
  const handleRun = async () => {
    if (isRunning) return;
    setIsRunning(true);
    setExecutionTime(null);
    const start = performance.now();

    try {
      if (language === 'javascript') {
        const capturedLogs: string[] = [];
        const customConsole = {
          log: (...args: any[]) => {
            capturedLogs.push(args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
          },
          warn: (...args: any[]) => {
            capturedLogs.push(`[WARN] ` + args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
          },
          error: (...args: any[]) => {
            capturedLogs.push(`[ERROR] ` + args.map((a) => (typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a))).join(' '));
          },
        };

        // Async Function Wrapper
        const AsyncFunction = Object.getPrototypeOf(async function () {}).constructor;
        const runFn = new AsyncFunction('console', code);
        const result = await runFn(customConsole);

        for (const log of capturedLogs) {
          addOutput('stdout', log);
        }

        if (result !== undefined) {
          const resStr = typeof result === 'object' ? JSON.stringify(result, null, 2) : String(result);
          addOutput('result', `=> ${resStr}`);
        }
      } else {
        // Python execution via Pyodide
        const pyodide = await initPyodide();

        const stdoutList: string[] = [];
        const stderrList: string[] = [];

        pyodide.setStdout({ batched: (msg: string) => stdoutList.push(msg) });
        pyodide.setStderr({ batched: (msg: string) => stderrList.push(msg) });

        const result = await pyodide.runPythonAsync(code);

        for (const out of stdoutList) {
          addOutput('stdout', out);
        }
        for (const err of stderrList) {
          addOutput('stderr', err);
        }

        if (result !== undefined) {
          const resStr = String(result);
          addOutput('result', `=> ${resStr}`);
        }
      }
    } catch (err: any) {
      addOutput('stderr', err.message || String(err));
    } finally {
      const duration = Math.round(performance.now() - start);
      setExecutionTime(duration);
      setIsRunning(false);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#1e1e2e] text-slate-200 select-text">
      {/* Top Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-white/10 bg-slate-900/60 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Language Toggle */}
          <div className="flex items-center bg-black/40 p-0.5 rounded-lg border border-white/10">
            <button
              onClick={() => handleLanguageChange('javascript')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                language === 'javascript'
                  ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              JavaScript
            </button>
            <button
              onClick={() => handleLanguageChange('python')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all flex items-center gap-1.5 ${
                language === 'python'
                  ? 'bg-sky-500/20 text-sky-300 border border-sky-500/40'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              Python
              {pyodideStatus === 'loading' && <Loader2 className="w-3 h-3 animate-spin text-sky-400" />}
            </button>
          </div>

          {/* Templates Dropdown */}
          <select
            onChange={(e) => {
              const selected = TEMPLATES[language].find((t) => t.name === e.target.value);
              if (selected) {
                setCode(selected.code);
                addOutput('system', `Exemplo "${selected.name}" carregado.`);
              }
            }}
            className="text-xs bg-slate-800/80 border border-white/10 rounded-md px-2 py-1 text-slate-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">Carregar Exemplo...</option>
            {TEMPLATES[language].map((t) => (
              <option key={t.name} value={t.name}>
                {t.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center gap-2">
          {executionTime !== null && (
            <span className="text-[11px] text-emerald-400 font-mono bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" />
              {executionTime}ms
            </span>
          )}

          <button
            onClick={() => setOutputs([])}
            title="Limpar Console"
            className="p-1.5 text-slate-400 hover:text-white hover:bg-white/10 rounded-md transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>

          <button
            onClick={handleRun}
            disabled={isRunning}
            className="flex items-center gap-1.5 px-3 py-1 bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white text-xs font-semibold rounded-md shadow-md shadow-emerald-900/30 transition-all cursor-pointer"
          >
            {isRunning ? (
              <>
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
                <span>Executando...</span>
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5 fill-current" />
                <span>Executar (Ctrl+Enter)</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Editor & Console Split View */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Editor Half */}
        <div className="flex-1 min-h-[160px] relative border-b border-white/10" onKeyDown={(e) => {
          if (e.ctrlKey && e.key === 'Enter') {
            e.preventDefault();
            handleRun();
          }
        }}>
          <React.Suspense
            fallback={
              <div className="flex items-center justify-center h-full text-slate-400 gap-2 bg-[#1e1e2e]">
                <Loader2 className="w-5 h-5 animate-spin text-indigo-400" />
                <span className="text-xs">Carregando editor...</span>
              </div>
            }
          >
            <MonacoEditor
              height="100%"
              language={language}
              theme="vs-dark"
              value={code}
              onChange={(val) => setCode(val || '')}
              options={{
                fontSize: 13,
                fontFamily: "'Fira Code', 'Cascadia Code', Consolas, monospace",
                minimap: { enabled: false },
                lineNumbers: 'on',
                scrollBeyondLastLine: false,
                automaticLayout: true,
                padding: { top: 8, bottom: 8 },
              }}
            />
          </React.Suspense>
        </div>

        {/* Output Console Half */}
        <div className="h-44 flex flex-col bg-[#12121e]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-black/40 border-b border-white/5 text-[11px] text-slate-400">
            <span className="flex items-center gap-1.5 font-semibold text-slate-300">
              <TerminalIcon className="w-3.5 h-3.5 text-indigo-400" />
              Console & Output
            </span>
            <span>{outputs.length} linhas</span>
          </div>

          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-1 select-text">
            {outputs.length === 0 ? (
              <div className="text-slate-500 italic py-4 text-center">
                Nenhuma saída no console. Pressione "Executar" para ver os resultados.
              </div>
            ) : (
              outputs.map((out, idx) => (
                <div
                  key={idx}
                  className={`flex items-start gap-2 leading-relaxed ${
                    out.type === 'stderr'
                      ? 'text-rose-400 bg-rose-950/20 px-1.5 py-0.5 rounded'
                      : out.type === 'result'
                      ? 'text-cyan-300 font-semibold'
                      : out.type === 'system'
                      ? 'text-slate-500 italic'
                      : 'text-slate-200'
                  }`}
                >
                  <span className="text-[10px] text-slate-600 select-none">[{out.timestamp}]</span>
                  <pre className="whitespace-pre-wrap break-all font-mono">{out.content}</pre>
                </div>
              ))
            )}
            <div ref={consoleEndRef} />
          </div>
        </div>
      </div>
    </div>
  );
};
