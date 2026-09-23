import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { DepthLevel } from '../types';
import { DEPTH_Z, getCameraZForLayer } from '../lib/depth';

interface CameraState {
  x: number;
  y: number;
  z: number; // 3D depth translation in pixels (0 for Degrau 0, 400 for Degrau 1, 800 for Degrau 2)
  zoom: number; // 0.4 to 2.2
  rotX: number; // -12 to +12 deg
  rotY: number; // -12 to +12 deg
}

interface CanvasStoreState {
  camera: CameraState;
  currentDepthPlane: DepthLevel; // 0, 1, or 2 (which plane the camera is focused on)
  activeLayer: DepthLevel; // 0, 1, or 2 (which layer is currently active for occlusion and interaction)
  isFocusMode: boolean;
  isDraggingCamera: boolean;
  isDraggingWindow: boolean;
  activeDepthFilter: DepthLevel | null; // null = all visible, or filter single depth
  mouseTiltStrength: number; // 0.0 = sem angulação, 1.0 = máximo, default 0.75
  isZToggleMode: boolean; // quando true, todos degraus colapsados para Z=0

  // Actions
  panCamera: (dx: number, dy: number) => void;
  zoomCamera: (
    delta: number,
    zoomFactor?: number,
    cursorScreenPos?: { x: number; y: number },
    viewportSize?: { width: number; height: number }
  ) => void;
  setMouseTilt: (rotX: number, rotY: number) => void;
  resetCamera: () => void;
  toggleFocusMode: () => void;
  toggleZMode: () => void;
  setIsDraggingCamera: (isDragging: boolean) => void;
  setIsDraggingWindow: (isDragging: boolean) => void;
  setActiveLayer: (layer: DepthLevel, syncCamera?: boolean) => void;
  jumpToDepthPlane: (depth: DepthLevel, autoCenter?: boolean) => void;
  nextDepthPlane: () => void;
  prevDepthPlane: () => void;
  setMouseTiltStrength: (v: number) => void;
}

const DEFAULT_CAMERA: CameraState = {
  x: 0,
  y: 0,
  z: 0,
  zoom: 1.0,
  rotX: 0,
  rotY: 0,
};

export const useCanvasStore = create<CanvasStoreState>()(
  persist(
    (set, get) => ({
      camera: DEFAULT_CAMERA,
      currentDepthPlane: 0 as DepthLevel,
      activeLayer: 0 as DepthLevel,
      isFocusMode: false,
      isDraggingCamera: false,
      isDraggingWindow: false,
      activeDepthFilter: null,
      mouseTiltStrength: 0.75, // 25% menos que o máximo original
      isZToggleMode: false,

      panCamera: (dx, dy) =>
        set((state) => ({
          camera: {
            ...state.camera,
            x: state.camera.x + dx,
            y: state.camera.y + dy,
          },
        })),

      zoomCamera: (delta, zoomFactor = 0.001, cursorScreenPos, viewportSize) =>
        set((state) => {
          const oldZoom = state.camera.zoom;
          const newZoom = Number(
            Math.min(Math.max(oldZoom - delta * zoomFactor, 0.45), 2.2).toFixed(3)
          );

          if (newZoom === oldZoom) return state;

          if (cursorScreenPos && viewportSize && viewportSize.width > 0 && viewportSize.height > 0) {
            const centerX = viewportSize.width / 2;
            const centerY = viewportSize.height / 2;
            const offsetX = cursorScreenPos.x - centerX;
            const offsetY = cursorScreenPos.y - centerY;

            const factor = 1 / newZoom - 1 / oldZoom;
            const newX = Number((state.camera.x + offsetX * factor).toFixed(2));
            const newY = Number((state.camera.y + offsetY * factor).toFixed(2));

            return {
              camera: {
                ...state.camera,
                x: newX,
                y: newY,
                zoom: newZoom,
              },
            };
          }

          return {
            camera: {
              ...state.camera,
              zoom: newZoom,
            },
          };
        }),

      setMouseTilt: (rotX, rotY) =>
        set((state) => {
          const str = state.mouseTiltStrength;
          return {
            camera: {
              ...state.camera,
              rotX: str > 0 ? Math.max(-12, Math.min(12, rotX * str)) : 0,
              rotY: str > 0 ? Math.max(-12, Math.min(12, rotY * str)) : 0,
            },
          };
        }),

      setMouseTiltStrength: (v) =>
        set({ mouseTiltStrength: Math.max(0, Math.min(1, v)) }),

      resetCamera: () =>
        set({
          camera: { ...DEFAULT_CAMERA },
          currentDepthPlane: 0 as DepthLevel,
          activeLayer: 0 as DepthLevel,
          isFocusMode: false,
          isZToggleMode: false,
        }),

      toggleFocusMode: () =>
        set((state) => ({
          isFocusMode: !state.isFocusMode,
          currentDepthPlane: 0 as DepthLevel,
          activeLayer: 0 as DepthLevel,
          camera: {
            ...state.camera,
            z: 0,
          },
        })),

      toggleZMode: () =>
        set((state) => {
          const turning_on = !state.isZToggleMode;
          return {
            isZToggleMode: turning_on,
            // quando ativa, câmera vai para Z=0 (Degrau 0)
            camera: turning_on
              ? { ...state.camera, z: 0 }
              : state.camera,
            currentDepthPlane: turning_on ? (0 as DepthLevel) : state.currentDepthPlane,
            activeLayer: turning_on ? (0 as DepthLevel) : state.activeLayer,
          };
        }),

      setIsDraggingCamera: (isDragging) =>
        set({ isDraggingCamera: isDragging }),

      setIsDraggingWindow: (isDragging) =>
        set({ isDraggingWindow: isDragging }),

      setActiveLayer: (layer, syncCamera = true) =>
        set((state) => {
          const numLayer = (Number(layer) === 0 ? 0 : Number(layer) === 2 ? 2 : 1) as DepthLevel;
          const targetZ = getCameraZForLayer(numLayer);
          const planeXOffsets: Record<DepthLevel, number> = {
            0: 0,
            1: 180,
            2: -120,
          };

          return {
            activeLayer: numLayer,
            currentDepthPlane: numLayer,
            isFocusMode: numLayer !== 0 ? false : state.isFocusMode,
            camera: syncCamera
              ? {
                  ...state.camera,
                  z: targetZ,
                  x: planeXOffsets[numLayer],
                  zoom: 1.0,
                }
              : state.camera,
          };
        }),

      jumpToDepthPlane: (depth, autoCenter = true) =>
        set((state) => {
          const numDepth = (Number(depth) === 0 ? 0 : Number(depth) === 2 ? 2 : 1) as DepthLevel;
          const targetZ = getCameraZForLayer(numDepth);

          const planeXOffsets: Record<DepthLevel, number> = {
            0: 0,
            1: 180,
            2: -120,
          };

          return {
            currentDepthPlane: numDepth,
            activeLayer: numDepth,
            isFocusMode: numDepth !== 0 ? false : state.isFocusMode,
            camera: {
              ...state.camera,
              z: targetZ,
              x: autoCenter ? planeXOffsets[numDepth] : state.camera.x,
              zoom: 1.0,
            },
          };
        }),

      nextDepthPlane: () =>
        set((state) => {
          const next = ((state.currentDepthPlane + 1) % 3) as DepthLevel;
          const targetZ = getCameraZForLayer(next);
          return {
            currentDepthPlane: next,
            activeLayer: next,
            camera: {
              ...state.camera,
              z: targetZ,
              zoom: 1.0,
            },
          };
        }),

      prevDepthPlane: () =>
        set((state) => {
          const prev = ((state.currentDepthPlane + 2) % 3) as DepthLevel;
          const targetZ = getCameraZForLayer(prev);
          return {
            currentDepthPlane: prev,
            activeLayer: prev,
            camera: {
              ...state.camera,
              z: targetZ,
              zoom: 1.0,
            },
          };
        }),
    }),
    {
      name: 'nebula-canvas-settings',
      partialize: (state) => ({
        mouseTiltStrength: state.mouseTiltStrength,
      }),
    }
  )
);


