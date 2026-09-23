import { create } from 'zustand';
import { useWindowsStore } from './useWindowsStore';

export type PaletteMode = 'files' | 'commands';

interface PaletteStoreState {
  isOpen: boolean;
  mode: PaletteMode;
  previousActiveWindowId: string | null;
  openPalette: (mode?: PaletteMode) => void;
  closePalette: () => void;
  togglePalette: (mode?: PaletteMode) => void;
}

export const usePaletteStore = create<PaletteStoreState>((set, get) => ({
  isOpen: false,
  mode: 'files',
  previousActiveWindowId: null,

  openPalette: (mode = 'files') => {
    const currentActiveId = useWindowsStore.getState().activeWindowId;
    set({
      isOpen: true,
      mode,
      previousActiveWindowId: currentActiveId,
    });
  },

  closePalette: () => {
    const prevId = get().previousActiveWindowId;
    set({ isOpen: false, previousActiveWindowId: null });

    if (prevId) {
      const winExists = useWindowsStore.getState().windows.some((w) => w.id === prevId);
      if (winExists) {
        useWindowsStore.getState().bringToFront(prevId);
      }
    }
  },

  togglePalette: (mode = 'files') => {
    if (get().isOpen) {
      get().closePalette();
    } else {
      get().openPalette(mode);
    }
  },
}));
