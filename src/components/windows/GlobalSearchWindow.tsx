import React, { useState } from 'react';
import {
  Search,
  FileCode,
  ArrowRight,
  Loader2,
  ChevronRight,
  ChevronDown,
  Sparkles,
} from 'lucide-react';
import { useEditorStore } from '../../store/useEditorStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useFSStore } from '../../store/useFSStore';

interface GrepMatchItem {
  filePath: string;
  fileName: string;
  line: number;
  lineContent: string;
}

interface GroupedMatches {
  filePath: string;
  fileName: string;
  items: GrepMatchItem[];
}

export const GlobalSearchWindow: React.FC = () => {
  const [query, setQuery] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [results, setResults] = useState<GroupedMatches[]>([]);
  const [totalMatches, setTotalMatches] = useState(0);
  const [collapsedFiles, setCollapsedFiles] = useState<Record<string, boolean>>({});

  const { openFileInEditor } = useEditorStore();
  const { bringToFront } = useWindowsStore();
  const { jumpToDepthPlane } = useCanvasStore();

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!query.trim()) return;

    setIsSearching(true);
    try {
      const res = await fetch(`/api/fs/grep?q=${encodeURIComponent(query.trim())}`);
      if (!res.ok) throw new Error('Falha na busca.');
      const data = await res.json();

      const matches: GrepMatchItem[] = data.matches || [];
      setTotalMatches(data.totalMatches || matches.length);

      // Group matches by file
      const groupsMap = new Map<string, GroupedMatches>();
      matches.forEach((m) => {
        if (!groupsMap.has(m.filePath)) {
          groupsMap.set(m.filePath, {
            filePath: m.filePath,
            fileName: m.fileName,
            items: [],
          });
        }
        groupsMap.get(m.filePath)!.items.push(m);
      });

      setResults(Array.from(groupsMap.values()));
    } catch (err) {
      console.error('Search error:', err);
    } finally {
      setIsSearching(false);
    }
  };

  const handleOpenMatch = async (filePath: string, fileName: string, line: number) => {
    try {
      const res = await useFSStore.getState().getFileContent({ path: filePath, name: fileName });
      openFileInEditor({
        path: filePath,
        name: fileName,
        content: res.content || '',
      });

      // Bring editor window to front and focus Degrau 0
      const editorWin = useWindowsStore.getState().windows.find((w) => w.type === 'editor');
      if (editorWin) {
        bringToFront(editorWin.id);
      }
      jumpToDepthPlane(0);
    } catch (err) {
      console.warn('Could not open file from search match:', err);
    }
  };

  const toggleCollapse = (filePath: string) => {
    setCollapsedFiles((prev) => ({
      ...prev,
      [filePath]: !prev[filePath],
    }));
  };

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/90 text-[#e6f0ff] font-mono text-xs select-none overflow-hidden">
      {/* Search Input Bar */}
      <form
        onSubmit={handleSearch}
        className="p-3 border-b border-[#162744] bg-[#091325] flex items-center gap-2 shrink-0"
      >
        <div className="relative flex-1">
          <Search className="w-4 h-4 text-[#3ba9ff] absolute left-2.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar em todos os arquivos... (Enter)"
            className="w-full pl-8 pr-3 py-1.5 rounded-lg bg-[#050914] border border-[#3ba9ff]/30 focus:border-[#5eead4] text-[#e6f0ff] placeholder-[#506c94] text-xs outline-none transition-all"
            autoFocus
          />
        </div>
        <button
          type="submit"
          disabled={isSearching || !query.trim()}
          className="px-3 py-1.5 rounded-lg bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#5eead4] border border-[#3ba9ff]/40 disabled:opacity-30 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 cursor-pointer font-semibold"
        >
          {isSearching ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Sparkles className="w-3.5 h-3.5 text-[#3ba9ff]" />
          )}
          <span>Buscar</span>
        </button>
      </form>

      {/* Summary Header */}
      <div className="px-3 py-1.5 bg-[#050810] border-b border-[#14233d] flex items-center justify-between text-[11px] text-[#7a92b8]">
        <span>
          {results.length > 0
            ? `${totalMatches} ocorrência(s) em ${results.length} arquivo(s)`
            : isSearching
            ? 'Pesquisando arquivos...'
            : 'Digite um termo e pressione Buscar'}
        </span>
        <span className="text-[10px] text-[#3ba9ff]">Degrau 1: Contexto</span>
      </div>

      {/* Results List */}
      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {results.length === 0 && !isSearching && query.trim() !== '' && (
          <div className="p-8 text-center text-[#506c94]">
            Nenhuma ocorrência encontrada para "{query}".
          </div>
        )}

        {results.map((group) => {
          const isCollapsed = collapsedFiles[group.filePath];
          return (
            <div
              key={group.filePath}
              className="rounded-xl border border-[#162744] bg-[#0a1529]/60 overflow-hidden"
            >
              {/* File Header */}
              <div
                onClick={() => toggleCollapse(group.filePath)}
                className="flex items-center justify-between px-2.5 py-1.5 bg-[#0c1a33]/80 hover:bg-[#122547] cursor-pointer transition-colors"
              >
                <div className="flex items-center gap-2 truncate">
                  {isCollapsed ? (
                    <ChevronRight className="w-3.5 h-3.5 text-[#7a92b8]" />
                  ) : (
                    <ChevronDown className="w-3.5 h-3.5 text-[#5eead4]" />
                  )}
                  <FileCode className="w-3.5 h-3.5 text-[#3ba9ff] shrink-0" />
                  <span className="font-semibold text-[#e2edff] truncate">
                    {group.fileName}
                  </span>
                  <span className="text-[10px] text-[#506c94] truncate max-w-[180px]">
                    {group.filePath}
                  </span>
                </div>
                <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-[#3ba9ff]/15 text-[#3ba9ff] border border-[#3ba9ff]/30 shrink-0">
                  {group.items.length}
                </span>
              </div>

              {/* Matching Lines */}
              {!isCollapsed && (
                <div className="divide-y divide-[#162744]/40">
                  {group.items.map((item, idx) => (
                    <button
                      key={idx}
                      onClick={() => handleOpenMatch(item.filePath, item.fileName, item.line)}
                      className="w-full flex items-start gap-2 px-3 py-1.5 hover:bg-[#3ba9ff]/10 text-left transition-colors group cursor-pointer"
                    >
                      <span className="text-[10px] font-mono text-[#5eead4] shrink-0 pt-0.5 w-8">
                        :{item.line}
                      </span>
                      <span className="text-[#94a3b8] group-hover:text-[#e2edff] truncate flex-1 font-mono text-[11px]">
                        {item.lineContent}
                      </span>
                      <ArrowRight className="w-3 h-3 text-[#3ba9ff] opacity-0 group-hover:opacity-100 shrink-0 transition-opacity mt-0.5" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
