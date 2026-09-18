import React, { useRef, useEffect, useCallback, useMemo } from 'react';
import { useCanvasStore } from '../store/useCanvasStore';
import { useWindowsStore } from '../store/useWindowsStore';
import { DepthGrid } from './DepthGrid';
import { Window } from './Window';

export const Canvas3D: React.FC = () => {
  const containerRef = useRef<HTMLDivElement>(null);
  const isDraggingCanvasRef = useRef(false);
  const dragStartRef = useRef({ x: 0, y: 0 });

  const {
    camera,
    panCamera,
    zoomCamera,
    setMouseTilt,
    setIsDraggingCamera,
    isDraggingWindow,
    isFocusMode,
    activeLayer,
    setActiveLayer,
    jumpToDepthPlane,
  } = useCanvasStore();

  const { windows, initWindows, isInitialized, activeWindowId, setWindowDepth } = useWindowsStore();

  // Initialize windows on mount
  useEffect(() => {
    if (!isInitialized) {
      initWindows();
    }
  }, [initWindows, isInitialized]);

  // Global keyboard shortcuts for switching activeLayer directly (1, 2, 3 and Escape)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't intercept if user is typing in a textarea, input or Monaco editor
      const target = e.target as HTMLElement;
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('input') ||
        target.closest('textarea') ||
        target.closest('.monaco-editor')
      ) {
        return;
      }

      // Atalhos de teclado: 1, 2, 3 trocam activeLayer diretamente
      // Escape volta para activeLayer = 0
      if (e.key === '1' || e.code === 'Digit1' || e.code === 'Numpad1') {
        e.preventDefault();
        setActiveLayer(0);
      } else if (e.key === '2' || e.code === 'Digit2' || e.code === 'Numpad2') {
        e.preventDefault();
        setActiveLayer(1);
      } else if (e.key === '3' || e.code === 'Digit3' || e.code === 'Numpad3') {
        e.preventDefault();
        setActiveLayer(2);
      } else if (e.key === 'Escape' || e.key === '0' || e.code === 'Digit0' || e.code === 'Numpad0') {
        e.preventDefault();
        setActiveLayer(0);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveLayer]);

  // ── WASD Camera Navigation ────────────────────────────────────────────────
  // Ativo apenas quando nenhuma janela está focada (activeWindowId === null ou
  // o alvo não é input/textarea/editor)
  useEffect(() => {
    const keysHeld = new Set<string>();
    let rafId: number | null = null;

    const SPEED = 10; // pixels por frame base (+25%)
    const SPEED_SHIFT = 25; // pixels por frame com Shift (+25%)

    const tick = () => {
      if (keysHeld.size === 0) {
        rafId = null;
        return;
      }
      const speed = keysHeld.has('ShiftLeft') || keysHeld.has('ShiftRight') ? SPEED_SHIFT : SPEED;
      let dx = 0;
      let dy = 0;
      if (keysHeld.has('KeyW') || keysHeld.has('ArrowUp')) dy += speed;
      if (keysHeld.has('KeyS') || keysHeld.has('ArrowDown')) dy -= speed;
      if (keysHeld.has('KeyA') || keysHeld.has('ArrowLeft')) dx += speed;
      if (keysHeld.has('KeyD') || keysHeld.has('ArrowRight')) dx -= speed;
      if (dx !== 0 || dy !== 0) {
        useCanvasStore.getState().panCamera(dx, dy);
      }
      rafId = requestAnimationFrame(tick);
    };

    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      // Ignorar se estiver digitando em input, textarea, editor Monaco
      if (
        target.tagName === 'INPUT' ||
        target.tagName === 'TEXTAREA' ||
        target.isContentEditable ||
        target.closest('.monaco-editor') ||
        target.closest('[contenteditable]')
      ) return;

      const wasdKeys = ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'];
      if (!wasdKeys.includes(e.code)) return;

      // Não interceptar se a janela ativa tem foco (pode estar em um terminal)
      const activeWin = useWindowsStore.getState().activeWindowId;
      if (activeWin) {
        const winEl = document.querySelector(`[data-window-id="${activeWin}"]`);
        if (winEl?.contains(target)) return;
      }

      keysHeld.add(e.code);
      if (!rafId) rafId = requestAnimationFrame(tick);
    };

    const onKeyUp = (e: KeyboardEvent) => {
      keysHeld.delete(e.code);
      if (keysHeld.size === 0 && rafId) {
        cancelAnimationFrame(rafId);
        rafId = null;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, []);

  // Handle subtle mouse tilt (±10° on X/Y based on cursor distance from screen center)
  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // If user is panning, don't jerk the tilt
      const rect = containerRef.current?.getBoundingClientRect();
      if (!rect) return;

      const centerX = rect.width / 2;
      const centerY = rect.height / 2;

      // Normalized coordinates from -1 to 1
      const normX = (e.clientX - centerX) / centerX;
      const normY = (e.clientY - centerY) / centerY;

      // Gentle rotation: rotX reacts to vertical move (up to 8°), rotY reacts to horizontal move (up to 10°)
      const targetRotX = -normY * 7;
      const targetRotY = normX * 9;

      setMouseTilt(targetRotX, targetRotY);
    },
    [setMouseTilt]
  );

  // Wheel to Zoom
  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLDivElement>) => {
      // Don't zoom if scrolling inside any window body (editor, tree, diff, etc.)
      const target = e.target as HTMLElement;
      if (
        !target ||
        target.closest('[data-window]') ||
        target.closest('[data-window-id]') ||
        target.closest('.window-container') ||
        target.closest('.window-body') ||
        target.closest('.window-header') ||
        target.closest('textarea') ||
        target.closest('input') ||
        target.closest('select') ||
        target.closest('.monaco-editor') ||
        target.closest('.overflow-y-auto') ||
        target.closest('.overflow-auto') ||
        target.closest('.overflow-x-auto') ||
        target.closest('[data-prevent-canvas-scroll]') ||
        target.closest('.hud-element')
      ) {
        return;
      }

      e.preventDefault();
      zoomCamera(e.deltaY, 0.0008);
    },
    [zoomCamera]
  );

  // Pan canvas on empty space drag
  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Only pan with primary left mouse button
    if (e.button !== 0) return;

    // Never pan if a window drag or resize is in progress
    if (isDraggingWindow) return;

    // Only pan if clicking on empty background, not on windows, buttons or HUD
    const target = e.target as HTMLElement;
    if (
      !target ||
      target.closest('[data-window]') ||
      target.closest('[data-window-id]') ||
      target.closest('.window-container') ||
      target.closest('.window-header') ||
      target.closest('button') ||
      target.closest('input') ||
      target.closest('textarea') ||
      target.closest('header') ||
      target.closest('.hud-element') ||
      target.closest('[data-prevent-canvas-pan]')
    ) {
      return;
    }

    isDraggingCanvasRef.current = true;
    setIsDraggingCamera(true);
    dragStartRef.current = { x: e.clientX, y: e.clientY };

    const handlePointerMove = (ev: PointerEvent) => {
      if (!isDraggingCanvasRef.current) return;
      const dx = ev.clientX - dragStartRef.current.x;
      const dy = ev.clientY - dragStartRef.current.y;
      dragStartRef.current = { x: ev.clientX, y: ev.clientY };
      panCamera(dx, dy);
    };

    const handlePointerUp = () => {
      isDraggingCanvasRef.current = false;
      setIsDraggingCamera(false);
      document.removeEventListener('pointermove', handlePointerMove);
      document.removeEventListener('pointerup', handlePointerUp);
    };

    document.addEventListener('pointermove', handlePointerMove);
    document.addEventListener('pointerup', handlePointerUp);
  };

  // Sort windows stably by depth plane (2 -> 1 -> 0) so background planes render first in DOM,
  // but keep stable ordering within the same plane (using window id) to avoid DOM churn
  // that breaks pointer-events and pointer-capture during drag
  const sortedWindows = useMemo(() => {
    return [...windows].sort((a, b) => {
      if (b.depth !== a.depth) {
        return b.depth - a.depth; // 2 first, then 1, then 0
      }
      return a.id.localeCompare(b.id);
    });
  }, [windows]);

  return (
    <div
      ref={containerRef}
      onMouseMove={handleMouseMove}
      onWheel={handleWheel}
      onPointerDown={handlePointerDown}
      className="relative w-full h-full overflow-hidden select-none cursor-crosshair"
      style={{
        perspective: '3000px', // Necessário para hit-testing do degrau 2 — ver v0.1.3 para não regredir
        backgroundColor: '#050810',
        backgroundImage: `radial-gradient(circle at 50% 50%, #0d1a33 0%, #070e1c 55%, #050810 100%)`,
      }}
    >
      {/* Dynamic atmospheric nebula lighting glow in the backdrop */}
      <div
        className="absolute w-[900px] h-[900px] rounded-full pointer-events-none transition-all duration-700 blur-[130px] opacity-20"
        style={{
          left: 'calc(50% - 450px)',
          top: 'calc(50% - 450px)',
          background: isFocusMode
            ? 'radial-gradient(circle, #3ba9ff 0%, #050810 70%)'
            : 'radial-gradient(circle, #5eead4 0%, #3ba9ff 40%, transparent 70%)',
          transform: `translate3d(${camera.x * 0.15}px, ${camera.y * 0.15}px, -1200px)`,
        }}
      />

      {/* 3D Transform Space Stage */}
      <div
        className="w-full h-full relative will-change-transform pointer-events-none"
        style={{
          transformStyle: 'preserve-3d',
          pointerEvents: 'none',
          transform: `
            translate3d(${camera.x}px, ${camera.y}px, ${camera.z}px)
            scale(${camera.zoom})
            rotateX(${camera.rotX}deg)
            rotateY(${camera.rotY}deg)
          `,
          transition: isDraggingCanvasRef.current || isDraggingWindow
            ? 'none'
            : 'transform 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        {/* Parallax 3D Depth Grid across the 3 planes */}
        <DepthGrid />

        {/* Floating 3D Windows (Rendered back-to-front: Degrau 2 -> 1 -> 0) */}
        {sortedWindows.map((win) => (
          <Window key={win.id} window={win} />
        ))}
      </div>
    </div>
  );
};
