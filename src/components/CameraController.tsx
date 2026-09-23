import React from 'react';
import {
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Layers,
  Compass,
  Focus,
  Eye,
  ArrowRightLeft,
} from 'lucide-react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useWindowsStore } from '../store/useWindowsStore';
import { DepthLevel } from '../types';

export const CameraController: React.FC = () => {
  const {
    camera,
    currentDepthPlane,
    activeLayer,
    setActiveLayer,
    zoomCamera,
    resetCamera,
    jumpToDepthPlane,
    isFocusMode,
    toggleFocusMode,
  } = useCanvasStore();

  const { windows, activeWindowId, setWindowDepth } = useWindowsStore();
  const activeWin = windows.find((w) => w.id === activeWindowId);

  return (
    <div className="absolute bottom-6 right-6 z-50 flex flex-wrap items-center gap-2 select-none pointer-events-auto">
      {/* Active Window Depth Controller (If a window is focused) */}
      {activeWin && (
        <div className="hidden sm:flex items-center gap-1.5 bg-[#070e1c]/90 backdrop-blur-xl border border-[#3ba9ff]/30 rounded-xl px-2.5 py-1.5 shadow-[0_4px_25px_rgba(0,0,0,0.6)] text-xs">
          <div className="flex items-center gap-1.5 max-w-[140px] truncate">
            <span className="w-2 h-2 rounded-full bg-[#5eead4] shrink-0 animate-pulse" />
            <span className="text-[#e6f0ff] font-mono text-[11px] truncate font-medium" title={activeWin.title}>
              {activeWin.title}
            </span>
          </div>

          <div className="w-[1px] h-3.5 bg-[#3ba9ff]/25 mx-1" />

          <span className="text-[10px] text-[#7a92b8] font-mono">Mover:</span>
          <div className="flex items-center gap-1">
            {([0, 1, 2] as DepthLevel[]).map((lvl) => {
              const isWinOnLevel = activeWin.depth === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => {
                    setWindowDepth(activeWin.id, lvl);
                    setActiveLayer(lvl);
                  }}
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-semibold transition-all cursor-pointer ${
                    isWinOnLevel
                      ? lvl === 0
                        ? 'bg-[#3ba9ff] text-[#050810] shadow-[0_0_8px_rgba(59,169,255,0.7)]'
                        : lvl === 1
                        ? 'bg-[#5eead4] text-[#050810] shadow-[0_0_8px_rgba(94,234,212,0.7)]'
                        : 'bg-[#6ea8ff] text-[#050810] shadow-[0_0_8px_rgba(110,168,255,0.7)]'
                      : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/20'
                  }`}
                  title={`Mover "${activeWin.title}" para Degrau ${lvl}`}
                >
                  D{lvl}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* 3D Spatial Plane Jump Selector */}
      <div className="flex items-center bg-[#070e1c]/90 backdrop-blur-xl border border-[#3ba9ff]/30 rounded-xl p-1 shadow-[0_4px_25px_rgba(0,0,0,0.6)] text-xs text-[#7a92b8]">
        <div className="hidden md:flex items-center gap-1 px-2 text-[10px] font-mono text-[#7a92b8] border-r border-[#3ba9ff]/20 mr-1">
          <Eye className="w-3 h-3 text-[#3ba9ff]" />
          <span>Plano:</span>
        </div>

        {([0, 1, 2] as DepthLevel[]).map((depth) => {
          const isCurrent = currentDepthPlane === depth;
          const labels = ['0 Foco', '1 Contexto', '2 Arquivo'];
          const zDesc = ['Z = 0px', 'Z = -400px', 'Z = -800px'];
          return (
            <button
              key={depth}
              type="button"
              onClick={() => jumpToDepthPlane(depth)}
              className={`px-2.5 py-1 rounded-lg font-mono text-[11px] font-semibold transition-all cursor-pointer flex items-center gap-1.5 ${
                isCurrent
                  ? depth === 0
                    ? 'bg-[#3ba9ff] text-[#050810] shadow-[0_0_15px_rgba(59,169,255,0.6)] font-bold'
                    : depth === 1
                    ? 'bg-[#5eead4] text-[#050810] shadow-[0_0_15px_rgba(94,234,212,0.6)] font-bold'
                    : 'bg-[#6ea8ff] text-[#050810] shadow-[0_0_15px_rgba(110,168,255,0.6)] font-bold'
                  : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15'
              }`}
              title={`Focar câmera no Degrau ${depth} (${labels[depth]}, ${zDesc[depth]})`}
            >
              <span
                className={`w-1.5 h-1.5 rounded-full ${
                  isCurrent ? 'bg-[#050810]' : 'bg-[#3ba9ff]/40'
                }`}
              />
              <span>{labels[depth]}</span>
            </button>
          );
        })}
      </div>

      {/* Camera Tools Widget */}
      <div className="flex items-center gap-1 bg-[#070e1c]/80 backdrop-blur-xl border border-[#3ba9ff]/20 rounded-xl p-1 shadow-[0_4px_20px_rgba(0,0,0,0.5)]">
        <button
          type="button"
          onClick={() => zoomCamera(-120)}
          className="p-2 text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/15 rounded-lg transition-colors cursor-pointer"
          title="Aproximar Câmera (Zoom In)"
        >
          <ZoomIn className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={() => zoomCamera(120)}
          className="p-2 text-[#7a92b8] hover:text-[#5eead4] hover:bg-[#3ba9ff]/15 rounded-lg transition-colors cursor-pointer"
          title="Afastar Câmera (Zoom Out)"
        >
          <ZoomOut className="w-4 h-4" />
        </button>

        <button
          type="button"
          onClick={resetCamera}
          className="p-2 text-[#7a92b8] hover:text-[#3ba9ff] hover:bg-[#3ba9ff]/15 rounded-lg transition-colors cursor-pointer"
          title="Resetar Câmera e Centralizar no Degrau 0"
        >
          <RotateCcw className="w-4 h-4" />
        </button>

        <div className="w-[1px] h-5 bg-[#3ba9ff]/20 mx-0.5" />

        <button
          type="button"
          onClick={toggleFocusMode}
          className={`p-2 rounded-lg transition-all cursor-pointer ${
            isFocusMode
              ? 'bg-[#3ba9ff]/30 text-[#5eead4] border border-[#5eead4]/40 shadow-[0_0_12px_rgba(94,234,212,0.3)]'
              : 'text-[#7a92b8] hover:text-[#e6f0ff] hover:bg-[#3ba9ff]/15'
          }`}
          title={isFocusMode ? 'Desativar Modo Foco' : 'Ativar Modo Foco (Z = 0)'}
        >
          <Focus className="w-4 h-4" />
        </button>
      </div>

      {/* Coordinate HUD (Minimalist) */}
      <div className="hidden md:flex items-center gap-2 px-3 py-1.5 bg-[#050810]/70 backdrop-blur-md border border-[#3ba9ff]/15 rounded-xl text-[10px] font-mono text-[#7a92b8]">
        <Compass className="w-3 h-3 text-[#3ba9ff]" />
        <span>{(camera.zoom * 100).toFixed(0)}%</span>
        <span>•</span>
        <span>Z: {camera.z}px</span>
      </div>
    </div>
  );
};
