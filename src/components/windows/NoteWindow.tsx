import React, { useState, useEffect } from 'react';
import {
  FileEdit,
  Eye,
  CheckCircle2,
  Bold,
  Italic,
  List,
  Code,
  Heading,
} from 'lucide-react';
import { NotePayload } from '../../types';
import { useWindowsStore } from '../../store/useWindowsStore';
import { saveNotesToStorage, loadNotesFromStorage } from '../../lib/idb';

interface NoteWindowProps {
  windowId: string;
  payload?: NotePayload;
}

export const NoteWindow: React.FC<NoteWindowProps> = ({ windowId, payload }) => {
  const [title, setTitle] = useState(payload?.title || 'Nova Nota');
  const [content, setContent] = useState(payload?.markdownContent || '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState(true);

  const { updateWindowPayload } = useWindowsStore();

  // Auto-save effect
  useEffect(() => {
    setIsSaved(false);
    const timeout = setTimeout(async () => {
      // Update window state payload
      updateWindowPayload(windowId, {
        title,
        markdownContent: content,
        noteId: payload?.noteId || `note-${windowId}`,
      });

      // Persist to indexedDB notes collection
      try {
        const existingNotes = await loadNotesFromStorage();
        const noteId = payload?.noteId || `note-${windowId}`;
        const updated = existingNotes.filter((n) => n.id !== noteId);
        updated.push({
          id: noteId,
          title,
          content,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
        await saveNotesToStorage(updated);
        setIsSaved(true);
      } catch (err) {
        console.warn('Error saving note:', err);
      }
    }, 400);

    return () => clearTimeout(timeout);
  }, [title, content, windowId, payload?.noteId, updateWindowPayload]);

  const insertSnippet = (before: string, after = '') => {
    setContent((prev) => `${prev}\n${before}${after}`);
  };

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/80 text-[#e6f0ff] select-text">
      {/* Top note header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628]/60 border-b border-[#3ba9ff]/15">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da nota..."
          className="bg-transparent text-sm font-semibold text-[#5eead4] border-none focus:outline-none focus:ring-1 focus:ring-[#3ba9ff]/30 rounded px-1.5 py-0.5 flex-1 mr-2"
        />

        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-all ${
              mode === 'edit'
                ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/30'
                : 'text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
          >
            <FileEdit className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-2 py-1 text-xs rounded flex items-center gap-1 transition-all ${
              mode === 'preview'
                ? 'bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/30'
                : 'text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Preview</span>
          </button>
        </div>
      </div>

      {/* Toolbar for edit mode */}
      {mode === 'edit' && (
        <div className="flex items-center gap-1 px-3 py-1.5 bg-[#050810]/40 border-b border-[#3ba9ff]/10 text-xs text-[#7a92b8]">
          <button
            type="button"
            onClick={() => insertSnippet('### ')}
            className="p-1 hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/10 rounded"
            title="Título"
          >
            <Heading className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('**', '**')}
            className="p-1 hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/10 rounded"
            title="Negrito"
          >
            <Bold className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('*', '*')}
            className="p-1 hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/10 rounded"
            title="Itálico"
          >
            <Italic className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('- ')}
            className="p-1 hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/10 rounded"
            title="Lista com marcadores"
          >
            <List className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => insertSnippet('```typescript\n// código\n```')}
            className="p-1 hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/10 rounded"
            title="Bloco de código"
          >
            <Code className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Note Body */}
      <div className="flex-1 overflow-auto p-3">
        {mode === 'edit' ? (
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder="Digite em markdown... (Ex: # Ideia, - Tarefa, `código`)"
            className="w-full h-full bg-transparent text-[#e6f0ff] text-xs font-mono resize-none focus:outline-none leading-relaxed placeholder-[#7a92b8]/50"
          />
        ) : (
          <div className="text-xs text-[#d1e4ff] leading-relaxed space-y-3 font-sans">
            {content.split('\n\n').map((paragraph, index) => {
              if (paragraph.startsWith('# ')) {
                return (
                  <h1 key={index} className="text-base font-bold text-[#5eead4] border-b border-[#3ba9ff]/20 pb-1">
                    {paragraph.replace('# ', '')}
                  </h1>
                );
              }
              if (paragraph.startsWith('## ')) {
                return (
                  <h2 key={index} className="text-sm font-semibold text-[#3ba9ff]">
                    {paragraph.replace('## ', '')}
                  </h2>
                );
              }
              if (paragraph.startsWith('### ')) {
                return (
                  <h3 key={index} className="text-xs font-semibold text-[#6ea8ff]">
                    {paragraph.replace('### ', '')}
                  </h3>
                );
              }
              if (paragraph.startsWith('- ')) {
                const items = paragraph.split('\n');
                return (
                  <ul key={index} className="list-disc pl-4 space-y-1 text-[#e6f0ff]/90">
                    {items.map((item, itemIdx) => (
                      <li key={itemIdx}>{item.replace(/^- (\[[ x]\] )?/, '')}</li>
                    ))}
                  </ul>
                );
              }
              if (paragraph.startsWith('```')) {
                const lines = paragraph.split('\n');
                const codeBody = lines.slice(1, -1).join('\n');
                return (
                  <pre key={index} className="bg-[#050810]/90 p-2 rounded-lg font-mono text-[11px] text-[#5eead4] overflow-x-auto border border-[#3ba9ff]/20">
                    <code>{codeBody || paragraph}</code>
                  </pre>
                );
              }
              return <p key={index}>{paragraph}</p>;
            })}
          </div>
        )}
      </div>

      {/* Status footer */}
      <div className="px-3 py-1.5 bg-[#081222]/80 border-t border-[#3ba9ff]/15 flex items-center justify-between text-[10px] text-[#7a92b8] font-mono">
        <div className="flex items-center gap-3">
          <span>{wordCount} palavras</span>
          <span>{charCount} caracteres</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 className={`w-3 h-3 ${isSaved ? 'text-[#5eead4]' : 'text-[#7a92b8]'}`} />
          <span>{isSaved ? 'Salvo no IndexedDB' : 'Salvando...'}</span>
        </div>
      </div>
    </div>
  );
};
