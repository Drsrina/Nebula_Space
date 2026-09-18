import { get, set, del } from 'idb-keyval';
import { SavedNote, WindowData } from '../types';

const STORAGE_KEYS = {
  WINDOWS: 'nebula_windows_state_v2',
  WINDOWS_LEGACY: 'nebula_windows_state_v1',
  NOTES: 'nebula_notes_collection_v1',
  DIR_HANDLE: 'nebula_saved_dir_handle_v1',
  CAMERA: 'nebula_camera_state_v1',
};

let saveWindowsTimeout: number | undefined;

export function saveWindowsToStorage(windows: WindowData[]): void {
  if (saveWindowsTimeout !== undefined) {
    clearTimeout(saveWindowsTimeout);
  }
  saveWindowsTimeout = window.setTimeout(async () => {
    try {
      // Sanitize and avoid saving non-serializable objects in window payload
      const serializable = windows.map((w, idx) => {
        const depthNum = Number(w.depth);
        const depth = (depthNum === 0 || depthNum === 1 || depthNum === 2 ? depthNum : 1);
        return {
          ...w,
          depth,
          x: typeof w.x === 'number' && !isNaN(w.x) ? w.x : 0,
          y: typeof w.y === 'number' && !isNaN(w.y) ? w.y : 0,
          width: typeof w.width === 'number' && !isNaN(w.width) && w.width >= 240 ? w.width : 460,
          height: typeof w.height === 'number' && !isNaN(w.height) && w.height >= 160 ? w.height : 480,
          zIndex: typeof w.zIndex === 'number' && !isNaN(w.zIndex) ? w.zIndex : 10 + idx,
          isMinimized: Boolean(w.isMinimized),
          payload: w.payload ? JSON.parse(JSON.stringify(w.payload)) : undefined,
        };
      });
      await set(STORAGE_KEYS.WINDOWS, serializable);
    } catch (err) {
      console.warn('Failed to save windows to IndexedDB:', err);
    }
  }, 350);
}

export async function clearAllWindowsStorage(): Promise<void> {
  try {
    await del(STORAGE_KEYS.WINDOWS);
    await del(STORAGE_KEYS.WINDOWS_LEGACY);
  } catch (err) {
    console.warn('Failed to clear windows storage:', err);
  }
}

export async function loadWindowsFromStorage(): Promise<WindowData[] | null> {
  try {
    let data = await get<any[]>(STORAGE_KEYS.WINDOWS);
    if (!data || !Array.isArray(data) || data.length === 0) {
      // Check legacy v1
      const legacyData = await get<any[]>(STORAGE_KEYS.WINDOWS_LEGACY);
      if (legacyData && Array.isArray(legacyData) && legacyData.length > 0) {
        data = legacyData;
      }
    }
    if (!data || !Array.isArray(data) || data.length === 0) return null;

    // Sanitize and normalize all windows so no stale/string values freeze the app
    const sanitized: WindowData[] = data.map((w, idx) => {
      const depthNum = Number(w.depth);
      const depth = (depthNum === 0 || depthNum === 1 || depthNum === 2 ? depthNum : 1);
      return {
        id: String(w.id || `win-${w.type || 'window'}-${Date.now()}-${idx}`),
        title: String(w.title || 'Janela'),
        type: w.type || 'note',
        depth,
        x: typeof w.x === 'number' && !isNaN(w.x) ? w.x : 0,
        y: typeof w.y === 'number' && !isNaN(w.y) ? w.y : 0,
        width: typeof w.width === 'number' && !isNaN(w.width) && w.width >= 240 ? w.width : 460,
        height: typeof w.height === 'number' && !isNaN(w.height) && w.height >= 160 ? w.height : 480,
        zIndex: typeof w.zIndex === 'number' && !isNaN(w.zIndex) ? w.zIndex : 10 + idx,
        isMinimized: Boolean(w.isMinimized),
        payload: w.payload && typeof w.payload === 'object' ? w.payload : {},
      };
    });

    // Save back the sanitized data to v2 and clean legacy key
    await set(STORAGE_KEYS.WINDOWS, sanitized);
    await del(STORAGE_KEYS.WINDOWS_LEGACY);

    return sanitized;
  } catch (err) {
    console.warn('Failed to load windows from IndexedDB:', err);
    return null;
  }
}

export async function saveNotesToStorage(notes: SavedNote[]): Promise<void> {
  try {
    await set(STORAGE_KEYS.NOTES, notes);
  } catch (err) {
    console.warn('Failed to save notes to IndexedDB:', err);
  }
}

export async function loadNotesFromStorage(): Promise<SavedNote[]> {
  try {
    const data = await get<SavedNote[]>(STORAGE_KEYS.NOTES);
    return data || [];
  } catch (err) {
    console.warn('Failed to load notes from IndexedDB:', err);
    return [];
  }
}

export async function saveDirectoryHandle(handle: FileSystemDirectoryHandle): Promise<void> {
  try {
    await set(STORAGE_KEYS.DIR_HANDLE, handle);
  } catch (err) {
    console.warn('Failed to save directory handle:', err);
  }
}

export async function loadDirectoryHandle(): Promise<FileSystemDirectoryHandle | null> {
  try {
    const handle = await get<FileSystemDirectoryHandle>(STORAGE_KEYS.DIR_HANDLE);
    return handle || null;
  } catch (err) {
    console.warn('Failed to retrieve directory handle:', err);
    return null;
  }
}

export async function clearDirectoryHandle(): Promise<void> {
  try {
    await del(STORAGE_KEYS.DIR_HANDLE);
  } catch (err) {
    console.warn('Failed to clear directory handle:', err);
  }
}
