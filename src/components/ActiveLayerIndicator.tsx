import React from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { DepthLevel } from '../types';
import { DEPTH_CONFIGS } from '../lib/depth';

export const ActiveLayerIndicator: React.FC = () => {
  const { activeLayer, setActiveLayer } = useCanvasStore();

  const layers: { level: DepthLevel; label: string; shortcut: string; color: string; glow: string }[] = [
    {
      level: 0,
      label: 'Degrau 0 — Foco',
      shortcut: '1',
      color: '#3ba9ff',
      glow: 'rgba(59,169,255,0.85)',
    },
    {
      level: 1,
      label: 'Degrau 1 — Contexto',
      shortcut: '2',
      color: '#5eead4',
      glow: 'rgba(94,234,212,0.85)',
    },
    {
      level: 2,
      label: 'Degrau 2 — Arquivo',
      shortcut: '3',
      color: '#6ea8ff',
      glow: 'rgba(110,168,255,0.85)',
    },
  ];

  return (
    <div
      className="absolute top-20 right-4 z-40 flex flex-col items-center gap-2 p-2 bg-[#070e1c]/80 backdrop-blur-xl border border-[#3ba9ff]/25 rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.6)] select-none pointer-events-auto"
      title="Camada Ativa (Oclusão inteligente): Teclas 1, 2, 3 ou clique para focar"
    >
      <span className="text-[9px] font-mono uppercase text-[#7a92b8] tracking-widest px-1">
        Degrau
      </span>

      {/* 3 pontinhos verticais neon clicáveis */}
      <div className="flex flex-col items-center gap-2.5 py-1">
        {layers.map(({ level, label, shortcut, color, glow }) => {
          const isActive = activeLayer === level;
          return (
            <button
              key={level}
              type="button"
              onClick={() => setActiveLayer(level)}
              className="group relative flex items-center justify-center p-1 cursor-pointer focus:outline-none"
              title={`${label} [Atalho: ${shortcut}]`}
            >
              {/* Tooltip flutuante para a esquerda */}
              <div className="absolute right-full mr-3 px-2 py-1 rounded-md bg-[#0a1628]/95 border border-[#3ba9ff]/30 text-[10px] font-mono text-[#e6f0ff] whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-lg z-50 flex items-center gap-1.5">
                <span style={{ color }}>{label}</span>
                <kbd className="px-1 py-0.2 bg-[#050810] border border-[#3ba9ff]/20 rounded text-[9px] text-[#5eead4]">
                  {shortcut}
                </kbd>
              </div>

              {/* Dot neon */}
              <div
                className="w-3.5 h-3.5 rounded-full transition-all duration-300 flex items-center justify-center"
                style={{
                  backgroundColor: isActive ? color : 'transparent',
                  border: `2px solid ${isActive ? color : `${color}60`}`,
                  boxShadow: isActive ? `0 0 12px ${glow}, 0 0 4px ${color}` : 'none',
                  transform: isActive ? 'scale(1.15)' : 'scale(1)',
                }}
              >
                {isActive && (
                  <div className="w-1.5 h-1.5 rounded-full bg-[#050810]" />
                )}
              </div>
            </button>
          );
        })}
      </div>

      <span className="text-[9px] font-mono text-[#5eead4] font-semibold">
        D{activeLayer}
      </span>
    </div>
  );
};
