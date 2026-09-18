import React, { useMemo, useState } from 'react';
import hljs from 'highlight.js';
import { Copy, Check, FileText, BookmarkPlus, Edit3, Hash, Calendar } from 'lucide-react';
import { FilePreviewPayload } from '../../types';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useEditorStore } from '../../store/useEditorStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { formatBytes } from '../../lib/fs';

interface FilePreviewWindowProps {
  payload?: FilePreviewPayload;
}

export const FilePreviewWindow: React.FC<FilePreviewWindowProps> = ({ payload }) => {
  const [copied, setCopied] = useState(false);
  const { createNote } = useWindowsStore();

  const content = payload?.content || '// Nenhum arquivo selecionado.\n// Abra um arquivo na janela Árvore de Arquivos.';
  const fileName = payload?.fileName || 'Sem título';
  const filePath = payload?.filePath || '';
  const fileExt = payload?.fileExtension || fileName.split('.').pop() || 'text';

  // Syntax highlighting via highlight.js
  const highlightedCode = useMemo(() => {
    if (payload?.isBinary) {
      return null;
    }
    try {
      const validLang = hljs.getLanguage(fileExt) ? fileExt : 'plaintext';
      return hljs.highlight(content, { language: validLang }).value;
    } catch {
      return hljs.highlightAuto(content).value;
    }
  }, [content, fileExt, payload?.isBinary]);

  // Generate line numbers
  const lines = useMemo(() => {
    return content.split('\n');
  }, [content]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      console.warn('Copy failed:', e);
    }
  };

  const handleConvertToNote = () => {
    createNote(
      2,
      `Nota: ${fileName}`,
      `# Notas sobre \`${fileName}\`\n\n\`\`\`${fileExt}\n${content.slice(0, 500)}${content.length > 500 ? '\n// ...' : ''}\n\`\`\`\n\n### Anotações:`
    );
  };

  const handleOpenInEditor = () => {
    useEditorStore.getState().openFileInEditor({
      path: filePath || fileName,
      name: fileName,
      content,
    });
    const { windows, bringToFront, openWindow, setWindowDepth, updateWindowPosition } = useWindowsStore.getState();
    const { camera, currentDepthPlane } = useCanvasStore.getState();
    const existing = windows.find((w) => w.type === 'editor');
    if (existing) {
      setWindowDepth(existing.id, currentDepthPlane);
      updateWindowPosition(
        existing.id,
        Math.round(-camera.x - existing.width / 2),
        Math.round(-camera.y - existing.height / 2 + 28)
      );
      bringToFront(existing.id);
    } else {
      openWindow('editor', {}, currentDepthPlane);
    }
  };

  return (
    <div className="flex flex-col h-full bg-[#060c18]/80 text-[#e6f0ff] select-text">
      {/* Action Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#0a1628]/70 border-b border-[#3ba9ff]/20 text-xs">
        <div className="flex items-center gap-2 overflow-hidden mr-2">
          <FileText className="w-4 h-4 text-[#3ba9ff] shrink-0" />
          <span className="font-mono text-[#5eead4] truncate text-[11px]" title={filePath}>
            {filePath || fileName}
          </span>
          {payload?.size !== undefined && (
            <span className="text-[10px] text-[#7a92b8] font-mono shrink-0 px-1.5 py-0.5 bg-[#050810]/50 rounded">
              {formatBytes(payload.size)}
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <button
            type="button"
            onClick={handleOpenInEditor}
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] rounded bg-[#5eead4]/15 hover:bg-[#5eead4]/25 text-[#5eead4] border border-[#5eead4]/30 font-medium transition-all cursor-pointer shadow-[0_0_10px_rgba(94,234,212,0.15)]"
            title="Abrir e editar no Monaco Editor"
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Editar</span>
          </button>

          <button
            type="button"
            onClick={handleConvertToNote}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/20 text-[#3ba9ff] hover:text-[#5eead4] border border-[#3ba9ff]/20 transition-all cursor-pointer"
            title="Criar uma nota a partir deste arquivo"
          >
            <BookmarkPlus className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Criar Nota</span>
          </button>

          <button
            type="button"
            onClick={handleCopy}
            className="flex items-center gap-1 px-2 py-1 text-[11px] rounded bg-[#3ba9ff]/10 hover:bg-[#3ba9ff]/20 text-[#e6f0ff] border border-[#3ba9ff]/20 transition-all cursor-pointer"
            title="Copiar conteúdo"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#5eead4]" />
                <span className="text-[#5eead4]">Copiado!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-[#7a92b8]" />
                <span>Copiar</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Code / Content Area */}
      <div className="flex-1 overflow-auto p-3 font-mono text-xs leading-relaxed bg-[#050810]/60">
        {payload?.isBinary ? (
          <div className="flex flex-col items-center justify-center h-full text-[#7a92b8] gap-3">
            <div className="p-4 rounded-xl bg-[#0a1628]/60 border border-[#3ba9ff]/20 text-center max-w-sm">
              <p className="text-sm text-[#e6f0ff] mb-1 font-sans font-medium">{fileName}</p>
              <p className="text-xs text-[#7a92b8] mb-3">{content}</p>
              <div className="text-[11px] text-[#5eead4] font-mono">
                {payload.size ? formatBytes(payload.size) : 'Tamanho desconhecido'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex">
            {/* Line numbers column */}
            <div className="select-none pr-3 mr-3 text-right text-[#627d9e]/60 border-r border-[#3ba9ff]/10 shrink-0 font-mono text-[11px]">
              {lines.map((_, i) => (
                <div key={i} className="leading-5">
                  {i + 1}
                </div>
              ))}
            </div>

            {/* Syntax highlighted code */}
            <pre className="flex-1 overflow-x-auto text-[12px] leading-5 font-mono m-0 p-0 text-[#d1e4ff]">
              {highlightedCode ? (
                <code
                  className={`language-${fileExt}`}
                  dangerouslySetInnerHTML={{ __html: highlightedCode }}
                />
              ) : (
                <code>{content}</code>
              )}
            </pre>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="px-3 py-1.5 bg-[#081222]/80 border-t border-[#3ba9ff]/15 flex items-center justify-between text-[10px] text-[#7a92b8] font-mono">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1">
            <Hash className="w-3 h-3 text-[#3ba9ff]" />
            {lines.length} linhas
          </span>
          <span className="text-[#5eead4] uppercase">{fileExt}</span>
        </div>
        {payload?.lastModified && (
          <span className="flex items-center gap-1 opacity-70">
            <Calendar className="w-3 h-3" />
            {new Date(payload.lastModified).toLocaleTimeString()}
          </span>
        )}
      </div>
    </div>
  );
};
