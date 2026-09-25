import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  FileEdit,
  Eye,
  CheckCircle2,
  Bold,
  Italic,
  List,
  Code,
  Heading,
  Save,
  FilePlus,
  FolderOpen,
  FileText,
  Download,
  X,
  Copy,
  Folder,
} from 'lucide-react';
import { NotePayload } from '../../types';
import { useWindowsStore } from '../../store/useWindowsStore';
import { saveNotesToStorage, loadNotesFromStorage } from '../../lib/idb';
import { EditorHeader, MenuGroup } from '../EditorHeader';

interface NoteWindowProps {
  windowId: string;
  payload?: NotePayload;
}

export const NoteWindow: React.FC<NoteWindowProps> = ({ windowId, payload }) => {
  const [title, setTitle] = useState(payload?.title || 'Nova Nota');
  const [content, setContent] = useState(payload?.markdownContent || '');
  const [mode, setMode] = useState<'edit' | 'preview'>('edit');
  const [isSaved, setIsSaved] = useState(true);

  // Dialog states for Save As and Rename
  const [showSaveAsDialog, setShowSaveAsDialog] = useState(false);
  const [showRenameDialog, setShowRenameDialog] = useState(false);
  const [dialogInput, setDialogInput] = useState('');

  const { updateWindowPayload, closeWindow, openWindow, bringToFront, windows } = useWindowsStore();
  const titleInputRef = useRef<HTMLInputElement>(null);
  const dialogInputRef = useRef<HTMLInputElement>(null);

  // Manual save handler
  const saveNoteImmediately = useCallback(async () => {
    updateWindowPayload(windowId, {
      title,
      markdownContent: content,
      noteId: payload?.noteId || `note-${windowId}`,
    });

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
      console.warn('Erro ao salvar nota:', err);
    }
  }, [content, payload?.noteId, title, updateWindowPayload, windowId]);

  // Auto-save effect with debounce — skips the initial mount
  const isFirstRender = React.useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    setIsSaved(false);
    const timeout = setTimeout(() => {
      saveNoteImmediately();
    }, 400);

    return () => clearTimeout(timeout);
  }, [title, content, saveNoteImmediately]);

  // Keyboard shortcuts (Ctrl+S, Ctrl+Shift+S, Ctrl+W)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.key.toLowerCase() === 's' && e.shiftKey) {
        e.preventDefault();
        setDialogInput(`${title} (Cópia)`);
        setShowSaveAsDialog(true);
      } else if (modKey && e.key.toLowerCase() === 's' && !e.shiftKey) {
        e.preventDefault();
        saveNoteImmediately();
      } else if (modKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        closeWindow(windowId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [closeWindow, saveNoteImmediately, title, windowId]);

  // Auto-focus dialog inputs
  useEffect(() => {
    if (showSaveAsDialog || showRenameDialog) {
      setTimeout(() => {
        dialogInputRef.current?.focus();
        dialogInputRef.current?.select();
      }, 50);
    }
  }, [showSaveAsDialog, showRenameDialog]);

  const insertSnippet = (before: string, after = '') => {
    setContent((prev) => `${prev}\n${before}${after}`);
  };

  // Export handlers
  const exportAsMarkdown = () => {
    const blob = new Blob([content], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.trim() || 'nota'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsHTML = () => {
    const htmlContent = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; line-height: 1.6; color: #1e293b; background: #fff; }
    h1 { color: #0284c7; border-bottom: 2px solid #e2e8f0; padding-bottom: 8px; }
    h2 { color: #0369a1; }
    pre { background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; overflow-x: auto; font-family: monospace; }
    code { font-family: monospace; background: #f1f5f9; padding: 2px 4px; border-radius: 4px; }
    ul { padding-left: 24px; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div>${content.replace(/\n/g, '<br/>')}</div>
</body>
</html>`;
    const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${title.trim() || 'nota'}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const exportAsPDF = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>${title}</title>
  <style>
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 750px; margin: 30px auto; line-height: 1.6; color: #000; }
    h1 { border-bottom: 1px solid #ccc; padding-bottom: 6px; }
    pre { background: #eee; padding: 10px; border-radius: 4px; font-family: monospace; }
  </style>
</head>
<body>
  <h1>${title}</h1>
  <div style="white-space: pre-wrap;">${content}</div>
</body>
</html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  const handleSaveAsConfirm = () => {
    if (!dialogInput.trim()) return;
    const newTitle = dialogInput.trim();
    const newNoteId = `note-${Date.now()}`;
    openWindow('note', {
      title: newTitle,
      markdownContent: content,
      noteId: newNoteId,
    }, 0);
    setShowSaveAsDialog(false);
  };

  const handleRenameConfirm = () => {
    if (!dialogInput.trim()) return;
    const newTitle = dialogInput.trim();
    setTitle(newTitle);
    updateWindowPayload(windowId, {
      title: newTitle,
      markdownContent: content,
      noteId: payload?.noteId || `note-${windowId}`,
    });
    setShowRenameDialog(false);
  };

  const handleShowInExplorer = () => {
    const existing = windows.find((w) => w.type === 'file-browser');
    if (existing) {
      bringToFront(existing.id);
    } else {
      openWindow('file-browser', {}, 0);
    }
  };

  const handleCloseAllNotes = () => {
    windows.filter((w) => w.type === 'note').forEach((w) => closeWindow(w.id));
  };

  // Header menus
  const headerMenus: MenuGroup[] = [
    {
      id: 'arquivo',
      label: 'Arquivo',
      items: [
        {
          id: 'save',
          label: 'Salvar',
          icon: <Save className="w-3.5 h-3.5 text-[#34d399]" />,
          shortcut: 'Ctrl+S',
          onClick: saveNoteImmediately,
        },
        {
          id: 'save-as',
          label: 'Salvar como...',
          icon: <FilePlus className="w-3.5 h-3.5 text-[#5eead4]" />,
          shortcut: 'Ctrl+Shift+S',
          onClick: () => {
            setDialogInput(`${title} (Cópia)`);
            setShowSaveAsDialog(true);
          },
        },
        {
          id: 'rename',
          label: 'Renomear Nota...',
          icon: <FileEdit className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => {
            setDialogInput(title);
            setShowRenameDialog(true);
          },
        },
        {
          id: 'export-md',
          label: 'Exportar Markdown (.md)',
          icon: <Download className="w-3.5 h-3.5 text-[#f59e0b]" />,
          separator: true,
          onClick: exportAsMarkdown,
        },
        {
          id: 'export-html',
          label: 'Exportar como HTML (.html)',
          icon: <Download className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: exportAsHTML,
        },
        {
          id: 'export-pdf',
          label: 'Exportar como PDF (.pdf)',
          icon: <Download className="w-3.5 h-3.5 text-[#a78bfa]" />,
          onClick: exportAsPDF,
        },
        {
          id: 'show-in-explorer',
          label: 'Mostrar no explorador',
          icon: <Folder className="w-3.5 h-3.5 text-[#38bdf8]" />,
          separator: true,
          onClick: handleShowInExplorer,
        },
        {
          id: 'close',
          label: 'Fechar Nota',
          icon: <X className="w-3.5 h-3.5" />,
          shortcut: 'Ctrl+W',
          danger: true,
          separator: true,
          onClick: () => closeWindow(windowId),
        },
        {
          id: 'close-all',
          label: 'Fechar Todas as Notas',
          icon: <X className="w-3.5 h-3.5" />,
          danger: true,
          onClick: handleCloseAllNotes,
        },
      ],
    },
    {
      id: 'editar',
      label: 'Editar',
      items: [
        {
          id: 'toggle-mode',
          label: mode === 'edit' ? 'Visualizar Preview' : 'Editar Markdown',
          icon: mode === 'edit' ? <Eye className="w-3.5 h-3.5 text-[#5eead4]" /> : <FileEdit className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => setMode((m) => (m === 'edit' ? 'preview' : 'edit')),
        },
        {
          id: 'ins-heading',
          label: 'Inserir Título',
          icon: <Heading className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          separator: true,
          onClick: () => insertSnippet('### '),
        },
        {
          id: 'ins-bold',
          label: 'Texto em Negrito',
          icon: <Bold className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => insertSnippet('**', '**'),
        },
        {
          id: 'ins-italic',
          label: 'Texto em Itálico',
          icon: <Italic className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => insertSnippet('*', '*'),
        },
        {
          id: 'ins-list',
          label: 'Item de Lista',
          icon: <List className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => insertSnippet('- '),
        },
        {
          id: 'ins-code',
          label: 'Bloco de Código',
          icon: <Code className="w-3.5 h-3.5 text-[#5eead4]" />,
          onClick: () => insertSnippet('```typescript\n// código\n```'),
        },
      ],
    },
  ];

  const wordCount = content.trim() ? content.trim().split(/\s+/).length : 0;
  const charCount = content.length;

  return (
    <div className="flex flex-col h-full bg-[#070e1c]/80 text-[#e6f0ff] select-text relative">
      {/* ── Standardized EditorHeader Component ── */}
      <EditorHeader menus={headerMenus}>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => setMode('edit')}
            className={`px-2 py-0.5 text-[11px] rounded flex items-center gap-1 transition-all ${
              mode === 'edit'
                ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/30'
                : 'text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
          >
            <FileEdit className="w-3 h-3" />
            <span>Editar</span>
          </button>
          <button
            type="button"
            onClick={() => setMode('preview')}
            className={`px-2 py-0.5 text-[11px] rounded flex items-center gap-1 transition-all ${
              mode === 'preview'
                ? 'bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/30'
                : 'text-[#7a92b8] hover:text-[#e6f0ff]'
            }`}
          >
            <Eye className="w-3 h-3" />
            <span>Preview</span>
          </button>
        </div>
      </EditorHeader>

      {/* Top note title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 bg-[#0a1628]/60 border-b border-[#3ba9ff]/15">
        <input
          ref={titleInputRef}
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Título da nota..."
          className="bg-transparent text-sm font-semibold text-[#5eead4] border-none focus:outline-none focus:ring-1 focus:ring-[#3ba9ff]/30 rounded px-1.5 py-0.5 flex-1 mr-2"
        />
      </div>

      {/* Toolbar for edit mode */}
      {mode === 'edit' && (
        <div className="flex items-center gap-1 px-3 py-1 bg-[#050810]/40 border-b border-[#3ba9ff]/10 text-xs text-[#7a92b8]">
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

      {/* ── Dialog: Salvar Como ── */}
      {showSaveAsDialog && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[360px] bg-[#091122] border border-[#3ba9ff]/40 rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5eead4] font-mono flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-[#3ba9ff]" /> Salvar Nota Como
              </span>
              <button
                type="button"
                onClick={() => setShowSaveAsDialog(false)}
                className="text-[#7a92b8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#7a92b8]">
              Informe o novo título para criar uma cópia desta nota:
            </p>
            <input
              ref={dialogInputRef}
              type="text"
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAsConfirm();
                if (e.key === 'Escape') setShowSaveAsDialog(false);
              }}
              className="bg-[#050810] border border-[#3ba9ff]/30 rounded-lg px-2.5 py-1.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSaveAsDialog(false)}
                className="px-3 py-1 text-xs text-[#7a92b8] hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSaveAsConfirm}
                className="px-3 py-1 text-xs bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40 hover:bg-[#3ba9ff]/30 rounded-lg transition-colors"
              >
                Salvar Cópia
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Dialog: Renomear Nota ── */}
      {showRenameDialog && (
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="w-[360px] bg-[#091122] border border-[#3ba9ff]/40 rounded-xl p-4 shadow-2xl flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-[#5eead4] font-mono flex items-center gap-2">
                <FileEdit className="w-4 h-4 text-[#3ba9ff]" /> Renomear Nota
              </span>
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className="text-[#7a92b8] hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#7a92b8]">
              Digite o novo título da nota (o conteúdo será mantido intacto):
            </p>
            <input
              ref={dialogInputRef}
              type="text"
              value={dialogInput}
              onChange={(e) => setDialogInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRenameConfirm();
                if (e.key === 'Escape') setShowRenameDialog(false);
              }}
              className="bg-[#050810] border border-[#3ba9ff]/30 rounded-lg px-2.5 py-1.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRenameDialog(false)}
                className="px-3 py-1 text-xs text-[#7a92b8] hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRenameConfirm}
                className="px-3 py-1 text-xs bg-[#5eead4]/20 text-[#5eead4] border border-[#5eead4]/40 hover:bg-[#5eead4]/30 rounded-lg transition-colors"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
