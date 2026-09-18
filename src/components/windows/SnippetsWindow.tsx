import React, { useState, useEffect } from 'react';
import { Plus, Trash2, Search, Copy, Code2, Tag, FileCode } from 'lucide-react';

interface Snippet {
  id: string;
  name: string;
  language: string;
  tags: string[];
  code: string;
  createdAt: number;
}

const LANGUAGES = ['javascript', 'typescript', 'python', 'bash', 'json', 'sql', 'html', 'css', 'yaml', 'markdown', 'outros'];

const DB_KEY = 'nebula-snippets-v1';

function loadSnippets(): Snippet[] {
  try { return JSON.parse(localStorage.getItem(DB_KEY) ?? '[]'); } catch { return []; }
}
function saveSnippets(s: Snippet[]) {
  localStorage.setItem(DB_KEY, JSON.stringify(s));
}

export const SnippetsWindow: React.FC = () => {
  const [snippets, setSnippets] = useState<Snippet[]>(loadSnippets);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Form
  const [fName, setFName] = useState('');
  const [fLang, setFLang] = useState('javascript');
  const [fTags, setFTags] = useState('');
  const [fCode, setFCode] = useState('');

  const persist = (s: Snippet[]) => { setSnippets(s); saveSnippets(s); };

  const filtered = snippets.filter((s) =>
    !search ||
    s.name.toLowerCase().includes(search.toLowerCase()) ||
    s.tags.some((t) => t.includes(search.toLowerCase())) ||
    s.language.includes(search.toLowerCase())
  );

  const selected = snippets.find((s) => s.id === selectedId) ?? null;

  const handleCreate = () => {
    if (!fName.trim() || !fCode.trim()) return;
    const ns: Snippet = {
      id: `snip-${Date.now()}`,
      name: fName.trim(),
      language: fLang,
      tags: fTags.split(',').map((t) => t.trim()).filter(Boolean),
      code: fCode,
      createdAt: Date.now(),
    };
    persist([ns, ...snippets]);
    setSelectedId(ns.id);
    setIsCreating(false);
    setFName(''); setFLang('javascript'); setFTags(''); setFCode('');
  };

  const handleDelete = (id: string) => {
    if (!confirm('Remover snippet?')) return;
    persist(snippets.filter((s) => s.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const handleCopy = (snippet: Snippet) => {
    navigator.clipboard.writeText(snippet.code).then(() => {
      setCopiedId(snippet.id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  const insertInEditor = (snippet: Snippet) => {
    // Dispatch custom event — EditorWindow listens for this
    window.dispatchEvent(new CustomEvent('nebula:insert-snippet', { detail: { code: snippet.code } }));
  };

  const langColor: Record<string, string> = {
    javascript: '#f59e0b',
    typescript: '#3b82f6',
    python: '#34d399',
    bash: '#a78bfa',
    json: '#fb923c',
    sql: '#38bdf8',
    html: '#f87171',
    css: '#818cf8',
    yaml: '#6ee7b7',
    markdown: '#94a3b8',
    outros: '#64748b',
  };

  return (
    <div className="flex h-full bg-[#060d1c] font-mono text-xs">
      {/* Left: List */}
      <div className="w-52 flex flex-col border-r border-[#1a2a4a]">
        <div className="p-2 border-b border-[#1a2a4a] bg-[#080f1e]">
          <div className="flex items-center gap-1 bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1">
            <Search className="w-3 h-3 text-[#4a6080]" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Buscar snippets..."
              className="flex-1 bg-transparent text-[#e6f0ff] focus:outline-none text-xs"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {filtered.length === 0 && !isCreating && (
            <div className="flex flex-col items-center justify-center h-full text-[#4a6080] gap-2 p-4">
              <Code2 className="w-6 h-6 opacity-30" />
              <p className="text-center text-[10px]">Nenhum snippet encontrado</p>
            </div>
          )}
          {filtered.map((s) => (
            <div
              key={s.id}
              onClick={() => setSelectedId(s.id)}
              className={`px-3 py-2 cursor-pointer border-b border-[#0f1e30] transition-colors hover:bg-[#0a1628]/70 ${selectedId === s.id ? 'bg-[#0a1628] border-l-2 border-l-[#3ba9ff]' : ''}`}
            >
              <div className="flex items-center gap-1.5">
                <span style={{ width: 6, height: 6, borderRadius: 2, background: langColor[s.language] ?? '#64748b', flexShrink: 0, display: 'inline-block' }} />
                <span className="text-[#e6f0ff] truncate text-[11px]">{s.name}</span>
              </div>
              <div className="flex items-center gap-1 mt-0.5 flex-wrap">
                <span className="text-[9px] text-[#4a6080]">{s.language}</span>
                {s.tags.slice(0, 2).map((t) => (
                  <span key={t} className="text-[8px] px-1 rounded border border-[#1a2a4a] text-[#4a6080]">{t}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
        <div className="p-2 border-t border-[#1a2a4a]">
          <button
            onClick={() => { setIsCreating(true); setSelectedId(null); }}
            className="w-full flex items-center justify-center gap-1 py-1 rounded bg-[#1a2a4a] hover:bg-[#1e3253] text-[#5eead4] transition-all text-xs"
          >
            <Plus className="w-3.5 h-3.5" /> Novo Snippet
          </button>
        </div>
      </div>

      {/* Right: Editor or Create Form */}
      <div className="flex-1 flex flex-col min-w-0">
        {isCreating ? (
          <div className="p-3 flex flex-col h-full gap-2">
            <div className="text-[#5eead4] text-[11px] font-semibold mb-1">NOVO SNIPPET</div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-[9px] text-[#4a6080] mb-0.5">NOME</label>
                <input value={fName} onChange={(e) => setFName(e.target.value)} className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]/40" />
              </div>
              <div>
                <label className="block text-[9px] text-[#4a6080] mb-0.5">LINGUAGEM</label>
                <select value={fLang} onChange={(e) => setFLang(e.target.value)} className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none">
                  {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
                </select>
              </div>
            </div>
            <div>
              <label className="block text-[9px] text-[#4a6080] mb-0.5">TAGS (separadas por vírgula)</label>
              <input value={fTags} onChange={(e) => setFTags(e.target.value)} placeholder="util, api, react" className="w-full bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-1 text-[#e6f0ff] focus:outline-none" />
            </div>
            <div className="flex-1 flex flex-col">
              <label className="block text-[9px] text-[#4a6080] mb-0.5">CÓDIGO</label>
              <textarea
                value={fCode}
                onChange={(e) => setFCode(e.target.value)}
                className="flex-1 bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-2 text-[#e6f0ff] focus:outline-none focus:border-[#5eead4]/40 resize-none"
                placeholder="// seu código aqui"
                style={{ fontFamily: 'monospace' }}
              />
            </div>
            <div className="flex gap-2">
              <button onClick={() => setIsCreating(false)} className="px-3 py-1 rounded text-[#7a92b8] hover:bg-[#1a2a4a] transition-all">Cancelar</button>
              <button onClick={handleCreate} disabled={!fName.trim() || !fCode.trim()} className="px-3 py-1 rounded bg-[#5eead4]/10 hover:bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/20 transition-all disabled:opacity-40">
                Salvar snippet
              </button>
            </div>
          </div>
        ) : selected ? (
          <div className="flex flex-col h-full">
            <div className="flex items-center justify-between px-3 py-2 border-b border-[#1a2a4a] bg-[#080f1e]">
              <div className="flex items-center gap-2">
                <span style={{ width: 8, height: 8, borderRadius: 2, background: langColor[selected.language] ?? '#64748b', display: 'inline-block' }} />
                <span className="text-[#e6f0ff] text-[11px]">{selected.name}</span>
                <span className="text-[9px] text-[#4a6080]">{selected.language}</span>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleCopy(selected)}
                  className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-all ${copiedId === selected.id ? 'text-[#22c55e] bg-[#22c55e]/10' : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#1a2a4a]'}`}
                  title="Copiar código"
                >
                  <Copy className="w-3 h-3" />
                  {copiedId === selected.id ? 'Copiado!' : 'Copiar'}
                </button>
                <button
                  onClick={() => insertInEditor(selected)}
                  className="flex items-center gap-1 px-2 py-0.5 rounded text-xs text-[#5eead4] hover:bg-[#5eead4]/10 transition-all"
                  title="Inserir no Editor ativo"
                >
                  <FileCode className="w-3 h-3" />
                  Inserir
                </button>
                <button
                  onClick={() => handleDelete(selected.id)}
                  className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:text-[#ef4444] hover:bg-[#ef4444]/10 transition-all"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            </div>
            <div className="flex items-center gap-1 px-3 py-1 border-b border-[#0f1e30]">
              {selected.tags.map((t) => (
                <span key={t} className="flex items-center gap-0.5 text-[8px] px-1.5 py-0.5 rounded border border-[#1a2a4a] text-[#4a6080]">
                  <Tag className="w-2 h-2" />{t}
                </span>
              ))}
            </div>
            <pre className="flex-1 overflow-auto p-3 text-[11px] text-[#c8daf5] leading-relaxed" style={{ fontFamily: 'monospace', whiteSpace: 'pre-wrap', wordBreak: 'break-all' }}>
              {selected.code}
            </pre>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center h-full text-[#4a6080] gap-2">
            <Code2 className="w-10 h-10 opacity-20" />
            <p className="text-[10px]">Selecione um snippet</p>
          </div>
        )}
      </div>
    </div>
  );
};
