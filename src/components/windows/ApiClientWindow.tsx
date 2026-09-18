import React, { useState } from 'react';
import {
  Play,
  Clock,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  Copy,
  ChevronDown,
  Layers,
  Sparkles,
} from 'lucide-react';

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD';

interface HeaderItem {
  id: string;
  key: string;
  value: string;
  enabled: boolean;
}

interface SavedRequest {
  id: string;
  name: string;
  method: HttpMethod;
  url: string;
  headers: HeaderItem[];
  body: string;
}

const PRESET_REQUESTS: SavedRequest[] = [
  {
    id: 'health',
    name: 'Nebula Health Check',
    method: 'GET',
    url: '/api/health',
    headers: [],
    body: '',
  },
  {
    id: 'workflows',
    name: 'Listar Workflows',
    method: 'GET',
    url: '/api/workflows',
    headers: [],
    body: '',
  },
  {
    id: 'cron-jobs',
    name: 'Listar Cron Jobs',
    method: 'GET',
    url: '/api/cron/jobs',
    headers: [],
    body: '',
  },
  {
    id: 'public-api',
    name: 'JSONPlaceholder API',
    method: 'GET',
    url: 'https://jsonplaceholder.typicode.com/posts/1',
    headers: [],
    body: '',
  },
];

const METHOD_COLORS: Record<HttpMethod, string> = {
  GET: '#22c55e',
  POST: '#3ba9ff',
  PUT: '#fbbf24',
  DELETE: '#ef4444',
  PATCH: '#a855f7',
  HEAD: '#64748b',
};

export const ApiClientWindow: React.FC = () => {
  const [method, setMethod] = useState<HttpMethod>('GET');
  const [url, setUrl] = useState('/api/health');
  const [headers, setHeaders] = useState<HeaderItem[]>([
    { id: '1', key: 'Content-Type', value: 'application/json', enabled: true },
  ]);
  const [body, setBody] = useState('{\n  "name": "Nebula API Test"\n}');
  const [activeTab, setActiveTab] = useState<'params' | 'headers' | 'body'>('headers');
  const [useProxy, setUseProxy] = useState(true);

  // Response state
  const [isLoading, setIsLoading] = useState(false);
  const [statusCode, setStatusCode] = useState<number | null>(null);
  const [statusText, setStatusText] = useState('');
  const [latencyMs, setLatencyMs] = useState<number | null>(null);
  const [responseHeaders, setResponseHeaders] = useState<Record<string, string>>({});
  const [responseBody, setResponseBody] = useState<string>('');
  const [responseTab, setResponseTab] = useState<'body' | 'headers'>('body');
  const [copied, setCopied] = useState(false);

  // Saved requests
  const [savedRequests, setSavedRequests] = useState<SavedRequest[]>(() => {
    try {
      const stored = localStorage.getItem('nebula-api-client-saved');
      return stored ? JSON.parse(stored) : PRESET_REQUESTS;
    } catch {
      return PRESET_REQUESTS;
    }
  });

  const loadRequest = (req: SavedRequest) => {
    setMethod(req.method);
    setUrl(req.url);
    setHeaders(req.headers);
    setBody(req.body);
  };

  const saveCurrentRequest = () => {
    const name = prompt('Nome para esta requisição:', `${method} ${url}`);
    if (!name) return;
    const newReq: SavedRequest = {
      id: `req-${Date.now()}`,
      name,
      method,
      url,
      headers,
      body,
    };
    const updated = [newReq, ...savedRequests];
    setSavedRequests(updated);
    localStorage.setItem('nebula-api-client-saved', JSON.stringify(updated));
  };

  const handleSend = async () => {
    if (!url.trim()) return;
    setIsLoading(true);
    setStatusCode(null);
    setResponseBody('');
    setLatencyMs(null);

    const token = sessionStorage.getItem('nebula_token') || '';
    const headersObj: Record<string, string> = {};
    headers.filter((h) => h.enabled && h.key).forEach((h) => {
      headersObj[h.key] = h.value;
    });

    if (url.startsWith('/api/') && token) {
      headersObj['Authorization'] = `Bearer ${token}`;
    }

    const start = performance.now();

    try {
      if (useProxy && url.startsWith('http')) {
        // Send via Nebula Backend Proxy to avoid CORS
        const proxyResp = await fetch('/api/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            url,
            method,
            headers: headersObj,
            body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
          }),
        });

        const data = await proxyResp.json();
        setStatusCode(data.status || proxyResp.status);
        setStatusText(data.statusText || '');
        setLatencyMs(data.durationMs || Math.round(performance.now() - start));
        setResponseHeaders(data.headers || {});
        setResponseBody(
          typeof data.data === 'object'
            ? JSON.stringify(data.data, null, 2)
            : String(data.data || data.error || '')
        );
      } else {
        // Direct fetch
        const resp = await fetch(url, {
          method,
          headers: headersObj,
          body: ['POST', 'PUT', 'PATCH'].includes(method) ? body : undefined,
        });

        const duration = Math.round(performance.now() - start);
        setStatusCode(resp.status);
        setStatusText(resp.statusText);
        setLatencyMs(duration);

        const rHeaders: Record<string, string> = {};
        resp.headers.forEach((v, k) => {
          rHeaders[k] = v;
        });
        setResponseHeaders(rHeaders);

        const text = await resp.text();
        try {
          const json = JSON.parse(text);
          setResponseBody(JSON.stringify(json, null, 2));
        } catch {
          setResponseBody(text);
        }
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      setStatusCode(0);
      setStatusText('Network Error');
      setResponseBody(`Erro de conexão ou CORS:\n${message}\n\nDica: Mantenha a opção "Via Proxy Nebula" ativada para ignorar CORS em APIs externas.`);
    } finally {
      setIsLoading(false);
    }
  };

  const copyResponse = () => {
    navigator.clipboard.writeText(responseBody);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="flex h-full w-full bg-[#050d1a] text-[#e6f0ff] select-none text-xs font-mono">
      {/* Sidebar: Presets / History */}
      <div className="w-48 shrink-0 border-r border-[#142340] bg-[#071020] flex flex-col">
        <div className="p-2.5 border-b border-[#142340] flex items-center justify-between">
          <span className="text-[11px] font-bold text-[#3ba9ff] flex items-center gap-1">
            <Layers className="w-3.5 h-3.5" /> Coleções
          </span>
          <button
            onClick={saveCurrentRequest}
            title="Salvar requisição atual"
            className="p-1 hover:bg-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff] rounded"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-1.5 space-y-1">
          {savedRequests.map((req) => (
            <button
              key={req.id}
              onClick={() => loadRequest(req)}
              className="w-full text-left p-1.5 rounded hover:bg-[#142340] transition-colors group flex items-center gap-1.5"
            >
              <span
                className="text-[9px] font-bold px-1 rounded"
                style={{
                  color: METHOD_COLORS[req.method],
                  backgroundColor: `${METHOD_COLORS[req.method]}20`,
                }}
              >
                {req.method}
              </span>
              <span className="text-[10px] text-[#7a92b8] group-hover:text-[#e6f0ff] truncate flex-1">
                {req.name}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Main Request / Response Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* URL Bar */}
        <div className="p-2.5 bg-[#09152a] border-b border-[#142340] flex items-center gap-2">
          <div className="relative">
            <select
              value={method}
              onChange={(e) => setMethod(e.target.value as HttpMethod)}
              className="bg-[#0f1f3d] border border-[#1e355e] text-xs font-bold rounded px-2 py-1.5 pr-6 appearance-none cursor-pointer focus:outline-none"
              style={{ color: METHOD_COLORS[method] }}
            >
              {(['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD'] as HttpMethod[]).map((m) => (
                <option key={m} value={m} className="bg-[#09152a] text-white">
                  {m}
                </option>
              ))}
            </select>
            <ChevronDown className="w-3 h-3 absolute right-1.5 top-2.5 pointer-events-none text-[#7a92b8]" />
          </div>

          <input
            type="text"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="https://api.example.com/v1/resource ou /api/health"
            className="flex-1 bg-[#050d1a] border border-[#1e355e] rounded px-3 py-1.5 text-xs text-[#e6f0ff] focus:outline-none focus:border-[#3ba9ff]"
          />

          <label className="flex items-center gap-1.5 text-[10px] text-[#7a92b8] cursor-pointer shrink-0">
            <input
              type="checkbox"
              checked={useProxy}
              onChange={(e) => setUseProxy(e.target.checked)}
              className="rounded bg-[#050d1a] border-[#1e355e] text-[#3ba9ff] focus:ring-0"
            />
            <span>Via Proxy</span>
          </label>

          <button
            onClick={handleSend}
            disabled={isLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-[#3ba9ff] hover:bg-[#3ba9ff]/80 text-[#050d1a] font-bold rounded transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Play className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
            <span>{isLoading ? 'Enviando...' : 'Enviar'}</span>
          </button>
        </div>

        {/* Request Tabs & Content */}
        <div className="flex-1 flex flex-col min-h-0 border-b border-[#142340]">
          <div className="flex items-center gap-4 px-3 bg-[#071020] border-b border-[#142340] text-[11px]">
            <button
              onClick={() => setActiveTab('headers')}
              className={`py-2 border-b-2 transition-colors ${
                activeTab === 'headers'
                  ? 'border-[#3ba9ff] text-[#3ba9ff] font-bold'
                  : 'border-transparent text-[#7a92b8] hover:text-[#e6f0ff]'
              }`}
            >
              Headers ({headers.filter((h) => h.enabled).length})
            </button>
            <button
              onClick={() => setActiveTab('body')}
              className={`py-2 border-b-2 transition-colors ${
                activeTab === 'body'
                  ? 'border-[#3ba9ff] text-[#3ba9ff] font-bold'
                  : 'border-transparent text-[#7a92b8] hover:text-[#e6f0ff]'
              }`}
            >
              Body (JSON)
            </button>
          </div>

          <div className="flex-1 p-2 overflow-y-auto bg-[#050d1a]">
            {activeTab === 'headers' && (
              <div className="space-y-1.5">
                {headers.map((h, i) => (
                  <div key={h.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={h.enabled}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].enabled = e.target.checked;
                        setHeaders(next);
                      }}
                      className="rounded text-[#3ba9ff] bg-[#09152a] border-[#1e355e]"
                    />
                    <input
                      placeholder="Header"
                      value={h.key}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].key = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-[#09152a] border border-[#142340] rounded px-2 py-1 text-xs text-[#e6f0ff] focus:outline-none focus:border-[#3ba9ff]"
                    />
                    <input
                      placeholder="Valor"
                      value={h.value}
                      onChange={(e) => {
                        const next = [...headers];
                        next[i].value = e.target.value;
                        setHeaders(next);
                      }}
                      className="flex-1 bg-[#09152a] border border-[#142340] rounded px-2 py-1 text-xs text-[#e6f0ff] focus:outline-none focus:border-[#3ba9ff]"
                    />
                    <button
                      onClick={() => setHeaders(headers.filter((_, idx) => idx !== i))}
                      className="p-1 text-[#7a92b8] hover:text-[#ef4444]"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                ))}
                <button
                  onClick={() =>
                    setHeaders([
                      ...headers,
                      { id: String(Date.now()), key: '', value: '', enabled: true },
                    ])
                  }
                  className="flex items-center gap-1 text-[10px] text-[#3ba9ff] hover:underline mt-2"
                >
                  <Plus className="w-3 h-3" /> Adicionar Header
                </button>
              </div>
            )}

            {activeTab === 'body' && (
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                rows={7}
                placeholder="Insira o payload JSON..."
                className="w-full h-full bg-[#071020] border border-[#142340] rounded p-2 text-xs font-mono text-[#38bdf8] focus:outline-none focus:border-[#3ba9ff] resize-none"
              />
            )}
          </div>
        </div>

        {/* Response Panel */}
        <div className="flex-1 flex flex-col min-h-0 bg-[#071020]">
          <div className="flex items-center justify-between px-3 py-1.5 bg-[#09152a] border-b border-[#142340]">
            <div className="flex items-center gap-3">
              <span className="text-[11px] font-bold text-[#7a92b8]">Resposta:</span>
              {statusCode !== null && (
                <div className="flex items-center gap-1.5">
                  <span
                    className="text-[10px] font-bold px-1.5 py-0.5 rounded"
                    style={{
                      backgroundColor:
                        statusCode >= 200 && statusCode < 300
                          ? '#22c55e25'
                          : statusCode >= 400
                          ? '#ef444425'
                          : '#fbbf2425',
                      color:
                        statusCode >= 200 && statusCode < 300
                          ? '#22c55e'
                          : statusCode >= 400
                          ? '#ef4444'
                          : '#fbbf24',
                    }}
                  >
                    {statusCode} {statusText}
                  </span>
                  {latencyMs !== null && (
                    <span className="text-[10px] text-[#7a92b8] flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {latencyMs}ms
                    </span>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <div className="flex bg-[#050d1a] rounded p-0.5 border border-[#142340]">
                <button
                  onClick={() => setResponseTab('body')}
                  className={`px-2 py-0.5 text-[10px] rounded ${
                    responseTab === 'body'
                      ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] font-bold'
                      : 'text-[#7a92b8]'
                  }`}
                >
                  Corpo
                </button>
                <button
                  onClick={() => setResponseTab('headers')}
                  className={`px-2 py-0.5 text-[10px] rounded ${
                    responseTab === 'headers'
                      ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] font-bold'
                      : 'text-[#7a92b8]'
                  }`}
                >
                  Headers ({Object.keys(responseHeaders).length})
                </button>
              </div>

              {responseBody && (
                <button
                  onClick={copyResponse}
                  title="Copiar resposta"
                  className="p-1 hover:bg-[#3ba9ff]/20 text-[#7a92b8] hover:text-[#e6f0ff] rounded transition-colors"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <div className="flex-1 p-2 overflow-auto bg-[#050d1a]">
            {responseTab === 'body' ? (
              responseBody ? (
                <pre className="text-xs text-[#a5f3fc] font-mono whitespace-pre-wrap">
                  {responseBody}
                </pre>
              ) : (
                <div className="flex items-center justify-center h-full text-[#4a6080] text-xs">
                  Nenhuma resposta ainda. Clique em "Enviar" para disparar a requisição.
                </div>
              )
            ) : (
              <div className="space-y-1">
                {Object.entries(responseHeaders).map(([k, v]) => (
                  <div key={k} className="flex gap-2 text-xs font-mono">
                    <span className="text-[#3ba9ff] font-semibold">{k}:</span>
                    <span className="text-[#7a92b8] break-all">{v}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
