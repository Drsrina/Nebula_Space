/**
 * workspaceBackup.ts — v2.7.6
 * 
 * Gerencia a exportação e importação completa do estado do workspace Nebula (.nebula.json).
 * Permite migrar entre navegadores sem perder janelas 3D, notas salvas no IndexedDB,
 * abas de código abertas e configurações do usuário.
 */

import { useWindowsStore } from '../store/useWindowsStore';
import { useCanvasStore } from '../store/useCanvasStore';
import { useEditorStore } from '../store/useEditorStore';
import { loadNotesFromStorage, saveNotesToStorage, saveWindowsToStorage } from './idb';
import { WindowData, SavedNote, EditorTab, DepthLevel } from '../types';

export interface NebulaBackupData {
  app: 'nebula-workspace';
  version: string;
  exportedAt: string;
  workspace: {
    windows: WindowData[];
    notes: SavedNote[];
    editor?: {
      tabs: EditorTab[];
      activeTabPath: string | null;
    };
    canvas?: {
      camera: {
        x: number;
        y: number;
        z: number;
        zoom: number;
        rotX: number;
        rotY: number;
      };
      activeLayer: DepthLevel;
    };
    settings?: {
      snapEnabled: boolean;
      resMode: string;
    };
  };
}

/**
 * Exporta o estado atual do workspace como um arquivo .nebula.json baixado diretamente.
 */
export async function exportWorkspaceBackup(): Promise<boolean> {
  try {
    const windows = useWindowsStore.getState().windows;
    const notes = await loadNotesFromStorage();
    const { tabs, activeTabPath } = useEditorStore.getState();
    const { camera, activeLayer } = useCanvasStore.getState();
    const snapEnabled = useWindowsStore.getState().snapEnabled;
    const resMode =
      typeof localStorage !== 'undefined'
        ? localStorage.getItem('nebula_res_mode') || 'ultra'
        : 'ultra';

    const backupData: NebulaBackupData = {
      app: 'nebula-workspace',
      version: '2.8.1',
      exportedAt: new Date().toISOString(),
      workspace: {
        windows,
        notes,
        editor: {
          tabs: tabs.map((t) => ({
            filePath: t.filePath,
            fileName: t.fileName,
            content: t.content,
            savedContent: t.savedContent,
            isDirty: t.isDirty,
            language: t.language,
          })),
          activeTabPath,
        },
        canvas: {
          camera,
          activeLayer,
        },
        settings: {
          snapEnabled,
          resMode,
        },
      },
    };

    const jsonString = JSON.stringify(backupData, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStr = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nebula-backup-${dateStr}.nebula.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  } catch (err) {
    console.error('[Backup] Falha ao exportar workspace:', err);
    return false;
  }
}

/**
 * Importa e restaura o workspace a partir do conteúdo de um arquivo .nebula.json.
 */
export async function importWorkspaceBackup(
  jsonText: string
): Promise<{ success: boolean; message: string; windowCount?: number; notesCount?: number }> {
  try {
    const data = JSON.parse(jsonText);

    if (!data || !data.workspace || !Array.isArray(data.workspace.windows)) {
      return {
        success: false,
        message: 'Arquivo inválido: formato .nebula.json não reconhecido.',
      };
    }

    const { windows, notes, editor, canvas, settings } = data.workspace;

    // 1. Restaurar Janelas
    useWindowsStore.setState({
      windows,
      activeWindowId: windows[0]?.id || null,
    });
    saveWindowsToStorage(windows);

    // 2. Restaurar Notas no IndexedDB
    if (Array.isArray(notes)) {
      await saveNotesToStorage(notes);
    }

    // 3. Restaurar Abas do Editor
    if (editor && Array.isArray(editor.tabs)) {
      useEditorStore.setState({
        tabs: editor.tabs,
        activeTabPath: editor.activeTabPath || (editor.tabs[0]?.filePath ?? null),
      });
    }

    // 4. Restaurar Câmera e Plano Ativo
    if (canvas?.camera) {
      useCanvasStore.setState({
        camera: canvas.camera,
        activeLayer: canvas.activeLayer ?? 0,
        currentDepthPlane: canvas.activeLayer ?? 0,
      });
    }

    // 5. Restaurar Configurações (Snapping & Resolução)
    if (settings) {
      if (typeof settings.snapEnabled === 'boolean') {
        useWindowsStore.getState().setSnapEnabled(settings.snapEnabled);
      }
      if (settings.resMode && typeof localStorage !== 'undefined') {
        localStorage.setItem('nebula_res_mode', settings.resMode);
        if (typeof document !== 'undefined') {
          document.body.classList.remove('res-ultra-sharp', 'res-retina');
          if (settings.resMode === 'ultra') document.body.classList.add('res-ultra-sharp');
          if (settings.resMode === 'retina') document.body.classList.add('res-retina');
        }
      }
    }

    return {
      success: true,
      message: `Workspace restaurado com sucesso! (${windows.length} janelas, ${notes?.length || 0} notas)`,
      windowCount: windows.length,
      notesCount: notes?.length || 0,
    };
  } catch (err: any) {
    console.error('[Backup] Falha ao importar workspace:', err);
    return {
      success: false,
      message: `Erro ao processar arquivo: ${err?.message || 'JSON inválido'}`,
    };
  }
}
