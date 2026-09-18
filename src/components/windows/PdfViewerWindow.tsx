import React, { useState } from 'react';
import { FileImage, ZoomIn, ZoomOut, RotateCcw } from 'lucide-react';

interface PdfViewerPayload {
  filePath?: string;
  fileName?: string;
  content?: string;
  fileExtension?: string;
}

interface PdfViewerWindowProps {
  payload?: PdfViewerPayload;
}

const IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico', 'avif']);
const PDF_EXTS = new Set(['pdf']);

export const PdfViewerWindow: React.FC<PdfViewerWindowProps> = ({ payload }) => {
  const [zoom, setZoom] = useState(1);
  const [inputUrl, setInputUrl] = useState(payload?.filePath ?? '');
  const [activeUrl, setActiveUrl] = useState(payload?.filePath ?? '');

  const ext = (payload?.fileExtension ?? payload?.fileName?.split('.').pop() ?? '').toLowerCase();
  const isImage = IMAGE_EXTS.has(ext);
  const isPdf = PDF_EXTS.has(ext);
  const hasContent = Boolean(activeUrl || payload?.content);

  const zoomIn = () => setZoom((z) => Math.min(z + 0.25, 4));
  const zoomOut = () => setZoom((z) => Math.max(z - 0.25, 0.25));
  const reset = () => setZoom(1);

  const renderContent = () => {
    if (!hasContent) {
      return (
        <div className="flex flex-col items-center justify-center h-full text-[#4a6080] gap-3">
          <FileImage className="w-12 h-12 opacity-20" />
          <p className="text-xs font-mono">Nenhum arquivo aberto</p>
          <p className="text-[10px] text-[#3a5a7a] font-mono">Abra um PDF ou imagem pelo Explorador de Arquivos</p>
        </div>
      );
    }

    if (isPdf) {
      // Use iframe com URL direta para o arquivo no servidor
      const src = activeUrl ? `/api/fs/raw?path=${encodeURIComponent(activeUrl)}` : '';
      return (
        <iframe
          src={src}
          className="w-full h-full border-0"
          title={payload?.fileName ?? 'PDF'}
        />
      );
    }

    if (isImage) {
      const src = activeUrl
        ? `/api/fs/raw?path=${encodeURIComponent(activeUrl)}`
        : payload?.content
        ? `data:image/${ext};base64,${payload.content}`
        : '';

      return (
        <div className="flex items-center justify-center w-full h-full overflow-auto bg-[#060d1c]">
          <img
            src={src}
            alt={payload?.fileName ?? 'image'}
            style={{ transform: `scale(${zoom})`, transformOrigin: 'center center', transition: 'transform 0.15s', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }}
          />
        </div>
      );
    }

    // Generic iframe fallback (HTML preview etc)
    return (
      <iframe
        src={activeUrl}
        className="w-full h-full border-0 bg-white"
        title={payload?.fileName ?? 'Preview'}
        sandbox="allow-scripts allow-same-origin"
      />
    );
  };

  return (
    <div className="flex flex-col h-full bg-[#060d1c]">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#1a2a4a] bg-[#080f1e]">
        <FileImage className="w-3.5 h-3.5 text-[#fb7185] shrink-0" />
        <input
          value={inputUrl}
          onChange={(e) => setInputUrl(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') setActiveUrl(inputUrl); }}
          placeholder="Caminho do arquivo ou URL..."
          className="flex-1 bg-[#0a1628] border border-[#1a2a4a] rounded px-2 py-0.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#fb7185]/40"
        />
        {isImage && (
          <div className="flex items-center gap-1">
            <button onClick={zoomOut} className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all">
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] font-mono text-[#4a6080] w-10 text-center">{Math.round(zoom * 100)}%</span>
            <button onClick={zoomIn} className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all">
              <ZoomIn className="w-3 h-3" />
            </button>
            <button onClick={reset} className="w-6 h-6 flex items-center justify-center rounded text-[#7a92b8] hover:bg-[#1a2a4a] hover:text-[#e6f0ff] transition-all">
              <RotateCcw className="w-3 h-3" />
            </button>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-hidden">
        {renderContent()}
      </div>
    </div>
  );
};
