import React, { useState, useMemo } from 'react';
import { DiffPayload } from '../../types';
import { calculateDiff } from '../../lib/git';
import { Columns, AlignJustify, GitCommit, FileCode, Check } from 'lucide-react';

interface DiffWindowProps {
  payload?: DiffPayload;
}

export const DiffWindow: React.FC<DiffWindowProps> = ({ payload }) => {
  const [viewMode, setViewMode] = useState<'unified' | 'split'>('unified');

  const filePath = payload?.filePath || 'arquivo.txt';
  const oldContent = payload?.oldContent || '';
  const newContent = payload?.newContent || '';

  const diffResult = useMemo(() => {
    return calculateDiff(oldContent, newContent, filePath);
  }, [oldContent, newContent, filePath]);

  return (
    <div className="flex flex-col h-full bg-[#050914] text-[#d1e0f5] font-mono text-xs select-text">
      {/* Header bar with Stats and Toggles */}
      <div className="flex items-center justify-between px-3 py-2 bg-[#081022] border-b border-[#14233e] shrink-0">
        <div className="flex items-center gap-2">
          <FileCode className="w-4 h-4 text-[#3ba9ff]" />
          <span className="font-semibold text-sm text-[#e2edff]">{filePath}</span>
          <div className="flex items-center gap-1.5 ml-2">
            <span className="px-1.5 py-0.5 rounded bg-[#10b981]/20 text-[#5eead4] text-[11px] font-bold border border-[#5eead4]/30">
              +{diffResult.additions}
            </span>
            <span className="px-1.5 py-0.5 rounded bg-[#ef4444]/20 text-[#ff5c7a] text-[11px] font-bold border border-[#ff5c7a]/30">
              -{diffResult.deletions}
            </span>
          </div>
        </div>

        {/* View mode toggle */}
        <div className="flex items-center gap-1 bg-[#091224] p-0.5 rounded border border-[#172746]">
          <button
            onClick={() => setViewMode('unified')}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-all ${
              viewMode === 'unified'
                ? 'bg-[#3ba9ff]/25 text-[#3ba9ff] border border-[#3ba9ff]/40 shadow-sm'
                : 'text-[#7a92b8] hover:text-[#d1e0f5]'
            }`}
          >
            <AlignJustify className="w-3.5 h-3.5" />
            <span>Unificado</span>
          </button>
          <button
            onClick={() => setViewMode('split')}
            className={`px-2 py-1 rounded flex items-center gap-1 text-[11px] font-medium transition-all ${
              viewMode === 'split'
                ? 'bg-[#3ba9ff]/25 text-[#3ba9ff] border border-[#3ba9ff]/40 shadow-sm'
                : 'text-[#7a92b8] hover:text-[#d1e0f5]'
            }`}
          >
            <Columns className="w-3.5 h-3.5" />
            <span>Lado a Lado</span>
          </button>
        </div>
      </div>

      {/* Subheader info */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#070d1c] border-b border-[#111f38] text-[10px] text-[#6b84a9]">
        <span>Original: {payload?.oldHeader || 'HEAD'}</span>
        <span>Modificado: {payload?.newHeader || 'Working Tree'}</span>
      </div>

      {/* Diff Content View */}
      <div className="flex-1 overflow-auto p-2 bg-[#060a17]">
        {diffResult.lines.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-[#7a92b8]">
            <Check className="w-8 h-8 text-[#5eead4] mb-2" />
            <p>Nenhuma diferença detectada. O arquivo é idêntico ao original.</p>
          </div>
        ) : viewMode === 'unified' ? (
          <div className="space-y-0.5">
            {diffResult.lines.map((line, idx) => {
              const isAdded = line.type === 'added';
              const isRemoved = line.type === 'removed';

              let bgClass = 'hover:bg-[#0c162b]/50';
              let textClass = 'text-[#9cb3d3]';
              let lineStyle: React.CSSProperties = {};

              if (isAdded) {
                bgClass = 'border-l-2';
                textClass = 'text-[#5eead4]';
                lineStyle = {
                  backgroundColor: '#1a3d2e',
                  borderColor: '#5eead4',
                };
              } else if (isRemoved) {
                bgClass = 'border-l-2';
                textClass = 'text-[#ff5c7a]';
                lineStyle = {
                  backgroundColor: '#3d1a22',
                  borderColor: '#ff5c7a',
                };
              }

              return (
                <div
                  key={idx}
                  style={lineStyle}
                  className={`flex items-stretch px-2 py-0.5 rounded-sm ${bgClass}`}
                >
                  {/* Old line number */}
                  <span className="w-8 shrink-0 text-right pr-2 text-[#465f85] select-none font-mono text-[10px]">
                    {line.oldLineNumber || ''}
                  </span>
                  {/* New line number */}
                  <span className="w-8 shrink-0 text-right pr-3 text-[#465f85] select-none font-mono text-[10px]">
                    {line.newLineNumber || ''}
                  </span>
                  {/* Diff marker */}
                  <span className="w-4 shrink-0 font-bold select-none text-[11px] text-center">
                    {isAdded ? '+' : isRemoved ? '-' : ' '}
                  </span>
                  {/* Line code */}
                  <pre className={`flex-1 whitespace-pre font-mono text-[12px] ${textClass}`}>
                    {line.text}
                  </pre>
                </div>
              );
            })}
          </div>
        ) : (
          /* Split View */
          <div className="grid grid-cols-2 gap-2 h-full">
            {/* Left side: Original */}
            <div className="border border-[#14233e] rounded bg-[#070d1a] p-2 overflow-auto">
              <div className="text-[10px] text-[#ff5c7a] font-semibold border-b border-[#1a2d4f] pb-1 mb-2">
                Original (Antes)
              </div>
              <div className="space-y-0.5">
                {diffResult.lines
                  .filter((l) => l.type !== 'added')
                  .map((line, idx) => (
                    <div
                      key={idx}
                      style={
                        line.type === 'removed'
                          ? { backgroundColor: '#3d1a22', borderColor: '#ff5c7a' }
                          : undefined
                      }
                      className={`flex px-1 py-0.5 rounded text-[11px] ${
                        line.type === 'removed'
                          ? 'border-l-2 text-[#ff5c7a]'
                          : 'text-[#8ba2c4]'
                      }`}
                    >
                      <span className="w-6 text-right pr-2 text-[#465f85] select-none">
                        {line.oldLineNumber}
                      </span>
                      <pre className="flex-1 whitespace-pre">{line.text}</pre>
                    </div>
                  ))}
              </div>
            </div>

            {/* Right side: Modified */}
            <div className="border border-[#14233e] rounded bg-[#070d1a] p-2 overflow-auto">
              <div className="text-[10px] text-[#5eead4] font-semibold border-b border-[#1a2d4f] pb-1 mb-2">
                Modificado (Depois)
              </div>
              <div className="space-y-0.5">
                {diffResult.lines
                  .filter((l) => l.type !== 'removed')
                  .map((line, idx) => (
                    <div
                      key={idx}
                      style={
                        line.type === 'added'
                          ? { backgroundColor: '#1a3d2e', borderColor: '#5eead4' }
                          : undefined
                      }
                      className={`flex px-1 py-0.5 rounded text-[11px] ${
                        line.type === 'added'
                          ? 'border-l-2 text-[#5eead4]'
                          : 'text-[#8ba2c4]'
                      }`}
                    >
                      <span className="w-6 text-right pr-2 text-[#465f85] select-none">
                        {line.newLineNumber}
                      </span>
                      <pre className="flex-1 whitespace-pre">{line.text}</pre>
                    </div>
                  ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
