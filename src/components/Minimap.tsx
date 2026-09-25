import React, { useCallback, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Maximize2, Minimize2, Navigation } from 'lucide-react';
import { useWindowsStore } from '../store/useWindowsStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { DepthLevel } from '../types';
import { worldBoundsToScreen, worldToScreen } from '../lib/coordinates';

const MAP_W = 160;
const MAP_H = 110;
const WORLD_W = 3000;
const WORLD_H = 2400;
const SCALE_X = MAP_W / WORLD_W;
const SCALE_Y = MAP_H / WORLD_H;

const depthColors: Record<number, string> = {
  0: '#3ba9ff',
  1: '#5eead4',
  2: '#a78bfa',
};

export const Minimap: React.FC = () => {
  const { windows } = useWindowsStore();
  const { camera, panCamera, setCameraPosition, activeLayer, setActiveLayer } = useCanvasStore();
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);
  const [isDragging, setIsDragging] = useState<boolean>(false);
  const svgRef = useRef<SVGSVGElement | null>(null);

  // Convert world coord to minimap coord (centered around 0,0)
  const toMap = (worldX: number, worldY: number) => ({
    x: MAP_W / 2 + worldX * SCALE_X,
    y: MAP_H / 2 + worldY * SCALE_Y,
  });

  // Viewport rect on minimap
  const vpW = Math.max(12, (window.innerWidth / (camera.zoom || 1)) * SCALE_X);
  const vpH = Math.max(8, (window.innerHeight / (camera.zoom || 1)) * SCALE_Y);
  const vpPos = toMap(-camera.x, -camera.y);

  const updateCameraFromMinimapPointer = useCallback(
    (clientX: number, clientY: number) => {
      if (!svgRef.current) return;
      const rect = svgRef.current.getBoundingClientRect();
      const mx = Math.max(0, Math.min(MAP_W, clientX - rect.left));
      const my = Math.max(0, Math.min(MAP_H, clientY - rect.top));

      // Convert minimap position → world position
      const worldX = (mx - MAP_W / 2) / SCALE_X;
      const worldY = (my - MAP_H / 2) / SCALE_Y;

      setCameraPosition(-worldX, -worldY);
    },
    [setCameraPosition]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      e.currentTarget.setPointerCapture(e.pointerId);
      setIsDragging(true);
      updateCameraFromMinimapPointer(e.clientX, e.clientY);
    },
    [updateCameraFromMinimapPointer]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      if (!isDragging) return;
      updateCameraFromMinimapPointer(e.clientX, e.clientY);
    },
    [isDragging, updateCameraFromMinimapPointer]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<SVGSVGElement>) => {
    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // ignore
    }
    setIsDragging(false);
  }, []);

  const activeWindowsCount = windows.filter((w) => !w.isMinimized && !w.isPopped).length;
  const zoomPct = Math.round((camera.zoom || 1) * 100);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: 76,
        right: 24,
        zIndex: 9990,
        background: 'rgba(5,13,26,0.92)',
        border: '1px solid rgba(59,169,255,0.2)',
        borderRadius: 10,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6), 0 0 0 1px rgba(59,169,255,0.1)',
        backdropFilter: 'blur(10px)',
        overflow: 'hidden',
        userSelect: 'none',
        transition: 'height 0.2s ease, width 0.2s ease',
      }}
    >
      {/* Header bar */}
      <div
        style={{
          padding: '4px 8px',
          borderBottom: isCollapsed ? 'none' : '1px solid rgba(59,169,255,0.1)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
          background: 'rgba(59,169,255,0.03)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Navigation size={10} style={{ color: '#3ba9ff' }} />
          <span style={{ fontSize: 9, fontFamily: 'monospace', fontWeight: 'bold', color: '#6fa0d2' }}>
            MINIMAP
          </span>
          <span
            style={{
              fontSize: 8,
              fontFamily: 'monospace',
              padding: '1px 4px',
              borderRadius: 3,
              background: `${depthColors[activeLayer] ?? '#3ba9ff'}22`,
              color: depthColors[activeLayer] ?? '#3ba9ff',
              border: `1px solid ${depthColors[activeLayer] ?? '#3ba9ff'}44`,
            }}
            title={`Plano Z Ativo: Degrau ${activeLayer}`}
          >
            D{activeLayer}
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#4a6080' }}>
            {zoomPct}%
          </span>
          <button
            type="button"
            onClick={() => setIsCollapsed(!isCollapsed)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              padding: 1,
              color: '#6fa0d2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
            title={isCollapsed ? 'Expandir Minimap' : 'Recolher Minimap'}
          >
            {isCollapsed ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
        </div>
      </div>

      {/* Expandable Body */}
      {!isCollapsed && (
        <>
          <svg
            ref={svgRef}
            width={MAP_W}
            height={MAP_H}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={handlePointerUp}
            onPointerCancel={handlePointerUp}
            style={{
              cursor: isDragging ? 'grabbing' : 'crosshair',
              display: 'block',
              touchAction: 'none',
            }}
          >
            {/* Background */}
            <rect width={MAP_W} height={MAP_H} fill="#050d1a" />

            {/* Grid lines */}
            <line x1={MAP_W / 2} y1={0} x2={MAP_W / 2} y2={MAP_H} stroke="#1a2a4a" strokeWidth={0.5} />
            <line x1={0} y1={MAP_H / 2} x2={MAP_W} y2={MAP_H / 2} stroke="#1a2a4a" strokeWidth={0.5} />

            {/* Window rectangles */}
            {windows
              .filter((w) => !w.isMinimized && !w.isPopped)
              .map((win) => {
                const pos = toMap(win.x, win.y);
                const w = Math.max(4, win.width * SCALE_X);
                const h = Math.max(3, win.height * SCALE_Y);
                const color = depthColors[win.depth] ?? '#3ba9ff';
                const isCurrentLayer = win.depth === activeLayer;
                return (
                  <rect
                    key={win.id}
                    x={pos.x}
                    y={pos.y}
                    width={w}
                    height={h}
                    fill={`${color}${isCurrentLayer ? '44' : '18'}`}
                    stroke={color}
                    strokeWidth={isCurrentLayer ? 1.2 : 0.6}
                    rx={1}
                    strokeOpacity={isCurrentLayer ? 0.9 : 0.4}
                  />
                );
              })}

            {/* Viewport indicator with grabbing cursor */}
            <rect
              x={vpPos.x - vpW / 2}
              y={vpPos.y - vpH / 2}
              width={vpW}
              height={vpH}
              fill="rgba(59,169,255,0.08)"
              stroke="#3ba9ff"
              strokeWidth={1.2}
              strokeDasharray={isDragging ? 'none' : '3,2'}
              rx={2}
              style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
            />

            {/* Viewport center point */}
            <circle
              cx={vpPos.x}
              cy={vpPos.y}
              r={1.5}
              fill="#5eead4"
            />
          </svg>

          {/* Footer Legend with interactive layer filters */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '3px 8px',
              borderTop: '1px solid rgba(59,169,255,0.1)',
            }}
          >
            <div style={{ display: 'flex', gap: 6 }}>
              {Object.entries(depthColors).map(([lvl, color]) => {
                const numLvl = Number(lvl) as DepthLevel;
                const isActive = activeLayer === numLvl;
                return (
                  <button
                    key={lvl}
                    type="button"
                    onClick={() => setActiveLayer(numLvl, true)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 3,
                      background: isActive ? `${color}22` : 'transparent',
                      border: isActive ? `1px solid ${color}66` : '1px solid transparent',
                      borderRadius: 3,
                      padding: '1px 3px',
                      cursor: 'pointer',
                    }}
                    title={`Degrau ${lvl} (Clique para focar)`}
                  >
                    <div
                      style={{
                        width: 5,
                        height: 5,
                        borderRadius: 1,
                        background: color,
                        opacity: isActive ? 1 : 0.5,
                      }}
                    />
                    <span
                      style={{
                        fontSize: 8,
                        fontFamily: 'monospace',
                        color: isActive ? color : '#3a5a7a',
                        fontWeight: isActive ? 'bold' : 'normal',
                      }}
                    >
                      D{lvl}
                    </span>
                  </button>
                );
              })}
            </div>

            <span style={{ fontSize: 8, fontFamily: 'monospace', color: '#4a6080' }}>
              {activeWindowsCount}w
            </span>
          </div>
        </>
      )}
    </div>
  );
};
