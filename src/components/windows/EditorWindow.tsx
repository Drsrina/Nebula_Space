import React, { useRef, useEffect, useState, useMemo, Suspense, lazy } from 'react';
import type { OnMount, BeforeMount } from '@monaco-editor/react';

const MonacoEditor = lazy(() => import('@monaco-editor/react'));
import {
  Save,
  Split,
  FileCode,
  Plus,
  X,
  WrapText,
  MapPin,
  ZoomIn,
  ZoomOut,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Palette,
  ChevronRight,
  ListTree,
  Code2,
  Box,
  Layers,
  Undo2,
  Redo2,
  Search,
  Download,
  HelpCircle,
  Magnet,
  Maximize2,
  Copy,
  FilePlus,
  RotateCcw,
  Folder,
  AlignLeft,
  Hash,
} from 'lucide-react';
import { EditorHeader, MenuGroup } from '../EditorHeader';
import { useEditorStore, detectLanguage } from '../../store/useEditorStore';
import { useWindowsStore } from '../../store/useWindowsStore';
import { useCanvasStore } from '../../store/useCanvasStore';
import { useGitStore } from '../../store/useGitStore';
import { useFSStore } from '../../store/useFSStore';
import { EDITOR_THEMES } from '../../lib/editorThemes';
import { computeGutterChanges, createMonacoGutterDecorations } from '../../lib/gitGutter';
import { writeFileContent } from '../../lib/fs';
import { adapterManager } from '../../lib/adapters';
import { EditorTab } from '../../types';

interface CodeSymbol {
  name: string;
  kind: 'function' | 'class' | 'interface' | 'variable';
  line: number;
}

interface EditorWindowProps {
  windowId?: string;
  payload?: {
    tabs?: EditorTab[];
    activeTabPath?: string;
    filePath?: string;
    fileName?: string;
    content?: string;
  };
}

export const EditorWindow: React.FC<EditorWindowProps> = ({ windowId, payload }) => {
  const isCustomInstance = Boolean(windowId && windowId !== 'win-editor-main');

  // Global Editor store
  const globalStore = useEditorStore();
  const { openWindow, windows, unsnapWindow, bringToFront } = useWindowsStore();
  const { currentBranch, getFileBaseContent } = useGitStore();

  // Local independent state if this is a duplicated or secondary editor instance
  const [localTabs, setLocalTabs] = useState<EditorTab[]>(() => {
    if (payload?.tabs && payload.tabs.length > 0) {
      return payload.tabs;
    }
    if (payload?.filePath) {
      return [
        {
          filePath: payload.filePath,
          fileName: payload.fileName || payload.filePath.split('/').pop() || 'arquivo',
          content: payload.content || '',
          savedContent: payload.content || '',
          isDirty: false,
          language: detectLanguage(payload.fileName || payload.filePath),
        },
      ];
    }
    if (isCustomInstance) {
      const draftName = `rascunho-${windowId?.slice(-4) || Date.now().toString().slice(-4)}.ts`;
      return [
        {
          filePath: draftName,
          fileName: draftName,
          content: '// Editor Independente Nebula\n// Alterações aqui não afetam outros editores\n\nexport const instance = "ready";\n',
          savedContent: '// Editor Independente Nebula\n// Alterações aqui não afetam outros editores\n\nexport const instance = "ready";\n',
          isDirty: false,
          language: 'typescript',
        },
      ];
    }
    return globalStore.tabs;
  });

  const [localActiveTabPath, setLocalActiveTabPath] = useState<string | null>(() => {
    if (payload?.activeTabPath) return payload.activeTabPath;
    if (payload?.filePath) return payload.filePath;
    if (isCustomInstance && localTabs[0]) return localTabs[0].filePath;
    return globalStore.activeTabPath;
  });

  // Decide active tabs and handlers
  const tabs = isCustomInstance ? localTabs : globalStore.tabs;
  const activeTabPath = isCustomInstance ? localActiveTabPath : globalStore.activeTabPath;
  const activeTab = tabs.find((t) => t.filePath === activeTabPath) || tabs[0];

  const [saveFeedback, setSaveFeedback] = useState(false);
  const [showThemePicker, setShowThemePicker] = useState(false);
  const [showHelpModal, setShowHelpModal] = useState(false);
  const [showSaveAsModal, setShowSaveAsModal] = useState(false);
  const [saveAsPath, setSaveAsPath] = useState('');
  const [showRevertModal, setShowRevertModal] = useState(false);
  const [showGotoLineModal, setShowGotoLineModal] = useState(false);
  const [gotoLineInput, setGotoLineInput] = useState('1');
  const [lineEnding, setLineEnding] = useState<'LF' | 'CRLF'>('LF');
  const [encoding, setEncoding] = useState<'UTF-8' | 'Latin-1'>('UTF-8');

  const editorRef = useRef<any>(null);
  const monacoRef = useRef<any>(null);
  const decorationsRef = useRef<string[]>([]);
  const saveAsInputRef = useRef<HTMLInputElement>(null);
  const gotoLineInputRef = useRef<HTMLInputElement>(null);

  // Auto-focus dialog inputs
  useEffect(() => {
    if (showSaveAsModal) {
      setTimeout(() => {
        saveAsInputRef.current?.focus();
        saveAsInputRef.current?.select();
      }, 50);
    }
  }, [showSaveAsModal]);

  useEffect(() => {
    if (showGotoLineModal) {
      setTimeout(() => {
        gotoLineInputRef.current?.focus();
        gotoLineInputRef.current?.select();
      }, 50);
    }
  }, [showGotoLineModal]);

  // Setup Monaco Themes before mount
  const handleEditorBeforeMount: BeforeMount = (monaco) => {
    monacoRef.current = monaco;
    EDITOR_THEMES.forEach((t) => {
      monaco.editor.defineTheme(t.id, t.definition);
    });
  };

  const handleEditorOnMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;
    monacoRef.current = monaco;

    monaco.editor.setTheme(globalStore.theme || 'nebula-dark');

    editor.onDidChangeCursorPosition((e) => {
      globalStore.setCursorPosition(e.position.lineNumber, e.position.column);
    });

    // Monaco Keybindings
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, async () => {
      await handleSave();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyS, () => {
      handleOpenSaveAsDialog();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyW, () => {
      handleCloseCurrentTab();
    });

    editor.addCommand(monaco.KeyMod.Alt | monaco.KeyCode.KeyZ, () => {
      handleToggleWordWrap();
    });

    editor.addCommand(monaco.KeyMod.Shift | monaco.KeyMod.Alt | monaco.KeyCode.KeyF, () => {
      handleFormatDocument();
    });

    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyG, () => {
      handleGotoLine();
    });

    updateGutterDecorations();
  };

  // Switch theme
  useEffect(() => {
    if (monacoRef.current) {
      monacoRef.current.editor.setTheme(globalStore.theme);
    }
  }, [globalStore.theme]);

  // Git Gutter
  const updateGutterDecorations = () => {
    if (!editorRef.current || !monacoRef.current || !activeTab) return;
    const baseContent = getFileBaseContent(activeTab.filePath);
    if (!baseContent) {
      decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, []);
      return;
    }
    const gutterChanges = computeGutterChanges(baseContent, activeTab.content);
    const decorations = createMonacoGutterDecorations(gutterChanges, monacoRef.current);
    decorationsRef.current = editorRef.current.deltaDecorations(decorationsRef.current, decorations);
  };

  useEffect(() => {
    updateGutterDecorations();
  }, [activeTab?.content, activeTab?.filePath]);

  // Tab Operations
  const handleSetActiveTab = (path: string) => {
    if (isCustomInstance) {
      setLocalActiveTabPath(path);
    } else {
      globalStore.setActiveTab(path);
    }
  };

  const handleCloseTab = (path: string) => {
    if (isCustomInstance) {
      const remaining = localTabs.filter((t) => t.filePath !== path);
      let next = localActiveTabPath;
      if (localActiveTabPath === path) {
        next = remaining.length > 0 ? remaining[remaining.length - 1].filePath : null;
      }
      setLocalTabs(remaining);
      setLocalActiveTabPath(next);
    } else {
      globalStore.closeTab(path);
    }
  };

  const handleUpdateContent = (path: string, content: string) => {
    if (isCustomInstance) {
      setLocalTabs((prev) =>
        prev.map((t) =>
          t.filePath === path ? { ...t, content, isDirty: content !== t.savedContent } : t
        )
      );
    } else {
      globalStore.updateTabContent(path, content);
    }
  };

  const handleOpenLocalFile = async () => {
    try {
      if ('showOpenFilePicker' in window) {
        // @ts-expect-error showOpenFilePicker is standard in Chrome/Edge
        const [handle] = await window.showOpenFilePicker({
          types: [
            {
              description: 'Arquivos de Código e Texto',
              accept: {
                'text/*': ['.ts', '.tsx', '.js', '.jsx', '.json', '.css', '.html', '.md', '.py', '.rs', '.go', '.sql', '.yaml', '.yml', '.txt'],
              },
            },
          ],
        });
        if (!handle) return;
        const file = await handle.getFile();
        const content = await file.text();
        const newTab: EditorTab = {
          filePath: file.name,
          fileName: file.name,
          content,
          savedContent: content,
          isDirty: false,
          language: detectLanguage(file.name),
          handle,
        };

        if (isCustomInstance) {
          setLocalTabs((prev) => [...prev.filter((t) => t.filePath !== file.name), newTab]);
          setLocalActiveTabPath(file.name);
        } else {
          globalStore.openFileInEditor({
            path: file.name,
            name: file.name,
            content,
            handle,
          });
        }
      } else {
        const input = document.createElement('input');
        input.type = 'file';
        input.onchange = async (e: any) => {
          const file = e.target?.files?.[0];
          if (file) {
            const content = await file.text();
            const newTab: EditorTab = {
              filePath: file.name,
              fileName: file.name,
              content,
              savedContent: content,
              isDirty: false,
              language: detectLanguage(file.name),
            };
            if (isCustomInstance) {
              setLocalTabs((prev) => [...prev.filter((t) => t.filePath !== file.name), newTab]);
              setLocalActiveTabPath(file.name);
            } else {
              globalStore.openFileInEditor({
                path: file.name,
                name: file.name,
                content,
              });
            }
          }
        };
        input.click();
      }
    } catch (err: any) {
      if (err.name !== 'AbortError') {
        console.warn('Erro ao abrir arquivo local:', err);
      }
    }
  };

  const handleCreateNewTab = () => {
    const newFileName = `rascunho-${Date.now().toString().slice(-4)}.txt`;
    const newTab: EditorTab = {
      filePath: newFileName,
      fileName: newFileName,
      content: '// Novo rascunho em branco no Nebula Workspace\n',
      savedContent: '// Novo rascunho em branco no Nebula Workspace\n',
      isDirty: false,
      language: 'plaintext',
    };
    if (isCustomInstance) {
      setLocalTabs((prev) => [...prev, newTab]);
      setLocalActiveTabPath(newFileName);
    } else {
      globalStore.openFileInEditor({
        path: newFileName,
        name: newFileName,
        content: newTab.content,
      });
    }
  };

  const handleSave = async () => {
    if (!activeTab) return;
    if (isCustomInstance) {
      try {
        if (activeTab.handle) {
          await writeFileContent(activeTab.handle, activeTab.content);
        } else {
          const adapter = adapterManager.getAdapter();
          await adapter.writeFile(activeTab.filePath, activeTab.content);
        }
        setLocalTabs((prev) =>
          prev.map((t) =>
            t.filePath === activeTab.filePath ? { ...t, savedContent: t.content, isDirty: false } : t
          )
        );
        setSaveFeedback(true);
        setTimeout(() => setSaveFeedback(false), 1200);

        // Refresh trees
        const fsStore = useFSStore.getState();
        await fsStore.refreshTree();
      } catch (err) {
        console.error('Falha ao salvar no editor customizado:', err);
      }
    } else {
      const success = await globalStore.saveActiveFile();
      if (success) {
        setSaveFeedback(true);
        setTimeout(() => setSaveFeedback(false), 1200);
      }
    }
  };

  const handleDownloadFile = () => {
    if (!activeTab) return;
    const blob = new Blob([activeTab.content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = activeTab.fileName || 'arquivo.txt';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleOpenNewIndependentEditor = () => {
    const draftId = Date.now().toString().slice(-4);
    openWindow('editor', {
      tabs: [
        {
          filePath: `editor-${draftId}.ts`,
          fileName: `editor-${draftId}.ts`,
          content: `// Editor Independente #${draftId}\n// Instância desvinculada totalmente independente\n\n`,
          savedContent: '',
          isDirty: false,
          language: 'typescript',
        },
      ],
    });
  };

  // Find snap state for window
  const currentWindowData = windowId ? windows.find((w) => w.id === windowId) : null;
  const isSnapped = Boolean(currentWindowData?.snapGroup);

  const handleUnsnapThis = () => {
    if (windowId) unsnapWindow(windowId);
  };

  const handleOpenDiff = () => {
    if (!activeTab) return;
    const oldContent = getFileBaseContent(activeTab.filePath);
    openWindow(
      'diff',
      {
        filePath: activeTab.filePath,
        oldContent,
        newContent: activeTab.content,
        oldHeader: 'HEAD (último commit)',
        newHeader: 'Working Tree (atual)',
      },
      useCanvasStore.getState().currentDepthPlane
    );
  };

  const handleOpenSaveAsDialog = () => {
    setSaveAsPath(activeTab?.filePath ? `${activeTab.filePath}.copy` : 'novo-arquivo.ts');
    setShowSaveAsModal(true);
  };

  const handleSaveAs = async (newPath: string) => {
    if (!activeTab || !newPath.trim()) return;
    const targetPath = newPath.trim();
    if (isCustomInstance) {
      try {
        const adapter = adapterManager.getAdapter();
        await adapter.writeFile(targetPath, activeTab.content);
        const newName = targetPath.split(/[/\\]/).pop() || targetPath;
        const newTab: EditorTab = {
          filePath: targetPath,
          fileName: newName,
          content: activeTab.content,
          savedContent: activeTab.content,
          isDirty: false,
          language: detectLanguage(newName),
        };
        setLocalTabs((prev) => [...prev.filter((t) => t.filePath !== targetPath), newTab]);
        setLocalActiveTabPath(targetPath);
        setSaveFeedback(true);
        setTimeout(() => setSaveFeedback(false), 1200);
      } catch (err) {
        console.error('Falha ao salvar como:', err);
      }
    } else {
      const ok = await globalStore.saveFileAs(activeTab.filePath, targetPath);
      if (ok) {
        setSaveFeedback(true);
        setTimeout(() => setSaveFeedback(false), 1200);
      }
    }
    setShowSaveAsModal(false);
  };

  const handleRevert = () => {
    if (!activeTab) return;
    if (isCustomInstance) {
      setLocalTabs((prev) =>
        prev.map((t) =>
          t.filePath === activeTab.filePath ? { ...t, content: t.savedContent, isDirty: false } : t
        )
      );
    } else {
      globalStore.revertFileByPath(activeTab.filePath);
    }
    setShowRevertModal(false);
  };

  const handleCloseCurrentTab = () => {
    if (activeTab) {
      handleCloseTab(activeTab.filePath);
    }
  };

  const handleCloseOtherTabs = () => {
    if (!activeTab) return;
    if (isCustomInstance) {
      setLocalTabs([activeTab]);
      setLocalActiveTabPath(activeTab.filePath);
    } else {
      globalStore.closeOtherTabs(activeTab.filePath);
    }
  };

  const handleCloseAllTabs = () => {
    if (isCustomInstance) {
      setLocalTabs([]);
      setLocalActiveTabPath(null);
    } else {
      globalStore.closeAllTabs();
    }
  };

  const handleShowInExplorer = () => {
    const existing = windows.find((w) => w.type === 'file-browser');
    if (existing) {
      bringToFront(existing.id);
    } else {
      openWindow('file-browser', {}, 0);
    }
  };

  const handleCopyFullPath = () => {
    if (activeTab?.filePath) {
      navigator.clipboard.writeText(activeTab.filePath);
    }
  };

  const handleCopyRelativePath = () => {
    if (activeTab?.fileName || activeTab?.filePath) {
      navigator.clipboard.writeText(activeTab.fileName || activeTab.filePath);
    }
  };

  const handleFormatDocument = () => {
    editorRef.current?.getAction('editor.action.formatDocument')?.run();
  };

  const handleGotoLine = (lineNumber?: number) => {
    if (lineNumber !== undefined) {
      editorRef.current?.setPosition({ lineNumber, column: 1 });
      editorRef.current?.revealLineInCenter(lineNumber);
      editorRef.current?.focus();
      setShowGotoLineModal(false);
    } else {
      setGotoLineInput(String(globalStore.cursorLine || 1));
      setShowGotoLineModal(true);
    }
  };

  const handleToggleWordWrap = () => {
    globalStore.toggleWordWrap();
  };

  const handleToggleLineEndings = () => {
    if (!activeTab) return;
    const next = lineEnding === 'LF' ? 'CRLF' : 'LF';
    setLineEnding(next);
    let newContent = activeTab.content;
    if (next === 'CRLF') {
      newContent = newContent.replace(/\r?\n/g, '\r\n');
    } else {
      newContent = newContent.replace(/\r\n/g, '\n');
    }
    handleUpdateContent(activeTab.filePath, newContent);
  };

  const handleToggleEncoding = () => {
    setEncoding((prev) => (prev === 'UTF-8' ? 'Latin-1' : 'UTF-8'));
  };

  // Global window keyboard shortcuts for editor
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modKey = isMac ? e.metaKey : e.ctrlKey;

      if (modKey && e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleOpenSaveAsDialog();
      } else if (modKey && !e.shiftKey && e.key.toLowerCase() === 's') {
        e.preventDefault();
        handleSave();
      } else if (modKey && e.key.toLowerCase() === 'w') {
        e.preventDefault();
        handleCloseCurrentTab();
      } else if (e.altKey && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        handleToggleWordWrap();
      } else if (modKey && e.key.toLowerCase() === 'g') {
        e.preventDefault();
        handleGotoLine();
      } else if (e.shiftKey && e.altKey && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        handleFormatDocument();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTab, lineEnding]);

  // Symbols outline
  const symbols = useMemo<CodeSymbol[]>(() => {
    if (!activeTab?.content) return [];
    const lines = activeTab.content.split('\n');
    const result: CodeSymbol[] = [];

    lines.forEach((lineText, idx) => {
      const lineNum = idx + 1;
      const funcMatch = lineText.match(/(?:export\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_$]+)/);
      if (funcMatch) {
        result.push({ name: funcMatch[1], kind: 'function', line: lineNum });
        return;
      }
      const arrowMatch = lineText.match(/(?:export\s+)?(?:const|let)\s+([a-zA-Z0-9_$]+)\s*=\s*(?:async\s*)?\([^)]*\)\s*=>/);
      if (arrowMatch) {
        result.push({ name: arrowMatch[1], kind: 'function', line: lineNum });
        return;
      }
      const classMatch = lineText.match(/(?:export\s+)?class\s+([a-zA-Z0-9_$]+)/);
      if (classMatch) {
        result.push({ name: classMatch[1], kind: 'class', line: lineNum });
        return;
      }
      const ifaceMatch = lineText.match(/(?:export\s+)?(?:interface|type)\s+([a-zA-Z0-9_$]+)/);
      if (ifaceMatch) {
        result.push({ name: ifaceMatch[1], kind: 'interface', line: lineNum });
      }
    });

    return result.slice(0, 50);
  }, [activeTab?.content]);

  const jumpToLine = (line: number) => {
    if (editorRef.current) {
      editorRef.current.revealLineInCenter(line);
      editorRef.current.setPosition({ lineNumber: line, column: 1 });
      editorRef.current.focus();
    }
  };

  if (!activeTab && tabs.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-8 text-center text-[#7a92b8] bg-[#050914]">
        <FolderOpen className="w-12 h-12 text-[#3ba9ff]/40 mb-3" />
        <p className="text-sm text-[#cbd5e1] font-medium mb-1">Nenhum arquivo aberto neste editor</p>
        <p className="text-xs max-w-sm mb-4">
          Crie um novo rascunho ou abra qualquer arquivo local do seu computador.
        </p>
        <div className="flex items-center gap-3">
          <button
            onClick={handleCreateNewTab}
            className="px-4 py-2 rounded-lg bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#e2edff] text-xs font-semibold border border-[#3ba9ff]/40 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <Plus className="w-4 h-4 text-[#5eead4]" /> Novo Rascunho
          </button>
          <button
            onClick={handleOpenLocalFile}
            className="px-4 py-2 rounded-lg bg-[#0f1b33] hover:bg-[#162744] text-[#7a92b8] hover:text-[#e6f0ff] text-xs font-medium border border-[#3ba9ff]/20 transition-colors flex items-center gap-2 cursor-pointer"
          >
            <FolderOpen className="w-4 h-4 text-[#3ba9ff]" /> Abrir Arquivo Local
          </button>
        </div>
      </div>
    );
  }

  const lineCount = activeTab?.content ? activeTab.content.split('\n').length : 0;
  const charCount = activeTab?.content ? activeTab.content.length : 0;
  const pathSegments = activeTab?.filePath ? activeTab.filePath.split(/[/\\]/) : [];

  const editorMenus: MenuGroup[] = [
    {
      id: 'arquivo',
      label: 'Arquivo',
      items: [
        {
          id: 'new-file',
          label: 'Novo Arquivo',
          icon: <Plus className="w-3.5 h-3.5 text-[#5eead4]" />,
          shortcut: 'Ctrl+N',
          onClick: handleCreateNewTab,
        },
        {
          id: 'open-local',
          label: 'Abrir Arquivo Local...',
          icon: <FolderOpen className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          shortcut: 'Ctrl+O',
          onClick: handleOpenLocalFile,
        },
        {
          id: 'save',
          label: 'Salvar',
          icon: <Save className="w-3.5 h-3.5 text-[#34d399]" />,
          shortcut: 'Ctrl+S',
          separator: true,
          onClick: handleSave,
        },
        {
          id: 'save-as',
          label: 'Salvar como...',
          icon: <FilePlus className="w-3.5 h-3.5 text-[#5eead4]" />,
          shortcut: 'Ctrl+Shift+S',
          onClick: handleOpenSaveAsDialog,
        },
        {
          id: 'revert',
          label: 'Reverter alterações...',
          icon: <RotateCcw className="w-3.5 h-3.5 text-[#ff8ba7]" />,
          disabled: !activeTab?.isDirty,
          onClick: () => setShowRevertModal(true),
        },
        {
          id: 'close-tab',
          label: 'Fechar Aba',
          icon: <X className="w-3.5 h-3.5" />,
          shortcut: 'Ctrl+W',
          separator: true,
          danger: true,
          onClick: handleCloseCurrentTab,
        },
        {
          id: 'close-others',
          label: 'Fechar Outras Abas',
          icon: <X className="w-3.5 h-3.5" />,
          disabled: tabs.length <= 1,
          onClick: handleCloseOtherTabs,
        },
        {
          id: 'close-all',
          label: 'Fechar Todas as Abas',
          icon: <X className="w-3.5 h-3.5" />,
          danger: true,
          disabled: tabs.length === 0,
          onClick: handleCloseAllTabs,
        },
        {
          id: 'show-in-explorer',
          label: 'Mostrar no explorador',
          icon: <Folder className="w-3.5 h-3.5 text-[#38bdf8]" />,
          separator: true,
          onClick: handleShowInExplorer,
        },
        {
          id: 'copy-full-path',
          label: 'Copiar caminho completo',
          icon: <Copy className="w-3.5 h-3.5 text-[#7a92b8]" />,
          onClick: handleCopyFullPath,
        },
        {
          id: 'copy-rel-path',
          label: 'Copiar caminho relativo',
          icon: <Copy className="w-3.5 h-3.5 text-[#7a92b8]" />,
          onClick: handleCopyRelativePath,
        },
        {
          id: 'download',
          label: 'Baixar Arquivo',
          icon: <Download className="w-3.5 h-3.5 text-[#f59e0b]" />,
          separator: true,
          onClick: handleDownloadFile,
        },
      ],
    },
    {
      id: 'editar',
      label: 'Editar',
      items: [
        {
          id: 'undo',
          label: 'Desfazer',
          icon: <Undo2 className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          shortcut: 'Ctrl+Z',
          onClick: () => editorRef.current?.trigger('menu', 'undo', null),
        },
        {
          id: 'redo',
          label: 'Refazer',
          icon: <Redo2 className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          shortcut: 'Ctrl+Y',
          onClick: () => editorRef.current?.trigger('menu', 'redo', null),
        },
        {
          id: 'find',
          label: 'Localizar',
          icon: <Search className="w-3.5 h-3.5 text-[#5eead4]" />,
          shortcut: 'Ctrl+F',
          separator: true,
          onClick: () => editorRef.current?.getAction('actions.find')?.run(),
        },
        {
          id: 'replace',
          label: 'Substituir',
          icon: <Copy className="w-3.5 h-3.5 text-[#a78bfa]" />,
          shortcut: 'Ctrl+H',
          onClick: () => editorRef.current?.getAction('editor.action.startFindReplaceAction')?.run(),
        },
        {
          id: 'goto-line',
          label: 'Ir para Linha...',
          icon: <Hash className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          shortcut: 'Ctrl+G',
          separator: true,
          onClick: () => {
            setGotoLineInput(String(globalStore.cursorLine || 1));
            setShowGotoLineModal(true);
          },
        },
        {
          id: 'format-doc',
          label: 'Formatar Documento',
          icon: <AlignLeft className="w-3.5 h-3.5 text-[#5eead4]" />,
          shortcut: 'Shift+Alt+F',
          onClick: handleFormatDocument,
        },
      ],
    },
    {
      id: 'view',
      label: 'View',
      items: [
        {
          id: 'word-wrap',
          label: `Quebra de Linha (${globalStore.wordWrap ? 'Ligada' : 'Desligada'})`,
          icon: <WrapText className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          shortcut: 'Alt+Z',
          onClick: handleToggleWordWrap,
        },
        {
          id: 'minimap',
          label: `Minimapa (${globalStore.minimap ? 'Ligado' : 'Desligado'})`,
          icon: <MapPin className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => globalStore.toggleMinimap(),
        },
        {
          id: 'symbols',
          label: `Símbolos Outline (${globalStore.showOutline ? 'Ligado' : 'Desligado'})`,
          icon: <ListTree className="w-3.5 h-3.5 text-[#5eead4]" />,
          onClick: () => globalStore.toggleOutline(),
        },
        {
          id: 'toggle-line-endings',
          label: `Fim de Linha: ${lineEnding} (Alternar)`,
          icon: <Code2 className="w-3.5 h-3.5 text-[#a78bfa]" />,
          separator: true,
          onClick: handleToggleLineEndings,
        },
        {
          id: 'toggle-encoding',
          label: `Codificação: ${encoding} (Alternar)`,
          icon: <FileCode className="w-3.5 h-3.5 text-[#a78bfa]" />,
          onClick: handleToggleEncoding,
        },
        {
          id: 'themes',
          label: 'Alternar Tema...',
          icon: <Palette className="w-3.5 h-3.5 text-[#a78bfa]" />,
          separator: true,
          onClick: () => setShowThemePicker(true),
        },
      ],
    },
    {
      id: 'tools',
      label: 'Tools',
      items: [
        {
          id: 'new-independent-editor',
          label: 'Novo Editor Independente',
          icon: <Plus className="w-3.5 h-3.5 text-[#5eead4]" />,
          onClick: handleOpenNewIndependentEditor,
        },
        ...(isSnapped
          ? [
              {
                id: 'unsnap',
                label: 'Desencaixar Deste Grupo',
                icon: <Magnet className="w-3.5 h-3.5 text-[#f59e0b]" />,
                onClick: handleUnsnapThis,
              },
            ]
          : []),
        {
          id: 'git-diff',
          label: 'Comparar com Git (Diff)',
          icon: <Split className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          separator: true,
          onClick: handleOpenDiff,
        },
      ],
    },
    {
      id: 'help',
      label: 'Help',
      items: [
        {
          id: 'help-about',
          label: 'Atalhos & Sobre',
          icon: <HelpCircle className="w-3.5 h-3.5 text-[#3ba9ff]" />,
          onClick: () => setShowHelpModal(true),
        },
      ],
    },
  ];

  return (
    <div className="flex flex-col h-full bg-[#050914] text-[#d1e0f5] select-text relative">
      {/* ── Top Application Menu Bar (EditorHeader component) ──── */}
      <EditorHeader menus={editorMenus}>
        <div className="flex items-center gap-2 text-[10px] text-[#506c94] font-mono">
          {isCustomInstance ? (
            <span className="px-1.5 py-0.5 rounded bg-[#3ba9ff]/15 text-[#5eead4] border border-[#3ba9ff]/30">
              Instância Independente
            </span>
          ) : (
            <span className="opacity-60">Editor Principal</span>
          )}
        </div>
      </EditorHeader>

      {/* ── Multi-Tab Bar (Notepad++ / VS Code inspired) ──── */}
      <div className="flex items-center justify-between border-b border-[#162744] bg-[#070e1c] px-1 overflow-x-auto select-none">
        <div className="flex items-center gap-1 overflow-x-auto py-1 scrollbar-none">
          {tabs.map((tab) => {
            const isTabActive = tab.filePath === activeTab?.filePath;
            return (
              <div
                key={tab.filePath}
                onClick={() => handleSetActiveTab(tab.filePath)}
                className={`group flex items-center gap-2 px-3 py-1.5 rounded-t-lg border-t border-x cursor-pointer transition-all text-xs font-mono select-none ${
                  isTabActive
                    ? 'bg-[#0b1324] border-[#3ba9ff]/40 text-[#5eead4] shadow-[0_-2px_10px_rgba(59,169,255,0.15)] font-medium'
                    : 'bg-[#080d1a] border-transparent text-[#7a92b8] hover:bg-[#0f1b33] hover:text-[#e2edff]'
                }`}
              >
                <FileCode className={`w-3.5 h-3.5 ${isTabActive ? 'text-[#3ba9ff]' : 'text-[#506c94]'}`} />
                <span className="truncate max-w-[140px]">{tab.fileName}</span>

                {tab.isDirty ? (
                  <span className="w-2 h-2 rounded-full bg-[#5eead4] ml-1 shrink-0 animate-pulse" title="Modificado (não salvo)" />
                ) : (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCloseTab(tab.filePath);
                    }}
                    className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-[#ff3b5c]/20 hover:text-[#ff3b5c] transition-opacity ml-1"
                    title="Fechar aba"
                  >
                    <X className="w-3 h-3" />
                  </button>
                )}
              </div>
            );
          })}
          {/* Quick New Tab Button */}
          <button
            onClick={handleCreateNewTab}
            title="Novo Arquivo / Rascunho"
            className="p-1.5 rounded hover:bg-[#14233e] text-[#7a92b8] hover:text-[#5eead4] transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Quick Toolbar */}
        <div className="flex items-center gap-1 shrink-0 px-2">
          {/* Save Button */}
          <button
            onClick={handleSave}
            title="Salvar arquivo (Ctrl+S)"
            className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition-all duration-200 border ${
              saveFeedback
                ? 'bg-[#10b981]/15 text-[#34d399] border-[#10b981]/40'
                : activeTab?.isDirty
                ? 'bg-[#3ba9ff]/20 text-[#5eead4] border-[#3ba9ff]/50 hover:bg-[#3ba9ff]/30 shadow-[0_0_12px_rgba(59,169,255,0.25)]'
                : 'hover:bg-[#14233e] text-[#7a92b8] border-transparent'
            }`}
          >
            {saveFeedback ? (
              <CheckCircle2 className="w-3.5 h-3.5 text-[#34d399] transition-transform scale-110" />
            ) : (
              <Save className="w-3.5 h-3.5" />
            )}
            <span className="hidden sm:inline">{saveFeedback ? 'Salvo' : 'Salvar'}</span>
          </button>

          {/* Diff Viewer Button */}
          <button
            onClick={handleOpenDiff}
            title="Comparar com versão do Git (Diff Side-by-Side)"
            className="flex items-center gap-1 px-2 py-1 rounded hover:bg-[#14233e] text-[#3ba9ff] text-xs font-medium border border-[#3ba9ff]/30 hover:border-[#3ba9ff]/60 transition-all"
          >
            <Split className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Diff</span>
          </button>

          {/* Theme Selector Icon */}
          <button
            onClick={() => setShowThemePicker(true)}
            title="Alternar Tema do Editor"
            className="p-1.5 rounded hover:bg-[#14233e] text-[#a78bfa] border border-transparent hover:border-[#a78bfa]/40 transition-colors cursor-pointer"
          >
            <Palette className="w-3.5 h-3.5" />
          </button>

          {/* Outline / Símbolos Toggle */}
          <button
            onClick={globalStore.toggleOutline}
            title={globalStore.showOutline ? 'Ocultar Outline de Símbolos' : 'Mostrar Outline de Símbolos (Funções / Classes)'}
            className={`p-1.5 rounded border transition-colors ${
              globalStore.showOutline
                ? 'bg-[#5eead4]/20 text-[#5eead4] border-[#5eead4]/40'
                : 'hover:bg-[#14233e] text-[#7a92b8] border-transparent'
            }`}
          >
            <ListTree className="w-3.5 h-3.5" />
          </button>

          {/* Word wrap toggle */}
          <button
            onClick={globalStore.toggleWordWrap}
            title={globalStore.wordWrap ? 'Desativar quebra de linha' : 'Ativar quebra de linha'}
            className={`p-1.5 rounded border transition-colors ${
              globalStore.wordWrap
                ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] border-[#3ba9ff]/40'
                : 'hover:bg-[#14233e] text-[#7a92b8] border-transparent'
            }`}
          >
            <WrapText className="w-3.5 h-3.5" />
          </button>

          {/* Minimap toggle */}
          <button
            onClick={globalStore.toggleMinimap}
            title={globalStore.minimap ? 'Ocultar Minimap' : 'Mostrar Minimap'}
            className={`p-1.5 rounded border transition-colors ${
              globalStore.minimap
                ? 'bg-[#3ba9ff]/20 text-[#3ba9ff] border-[#3ba9ff]/40'
                : 'hover:bg-[#14233e] text-[#7a92b8] border-transparent'
            }`}
          >
            <MapPin className="w-3.5 h-3.5" />
          </button>

          {/* Font size zoom */}
          <div className="flex items-center border border-[#162744] rounded bg-[#091122]">
            <button
              onClick={() => globalStore.setFontSize(globalStore.fontSize - 1)}
              title="Diminuir fonte"
              className="p-1 hover:bg-[#14233e] text-[#7a92b8] hover:text-white"
            >
              <ZoomOut className="w-3 h-3" />
            </button>
            <span className="text-[10px] px-1 font-mono text-[#5eead4]">{globalStore.fontSize}px</span>
            <button
              onClick={() => globalStore.setFontSize(globalStore.fontSize + 1)}
              title="Aumentar fonte"
              className="p-1 hover:bg-[#14233e] text-[#7a92b8] hover:text-white"
            >
              <ZoomIn className="w-3 h-3" />
            </button>
          </div>
        </div>
      </div>

      {/* ── Breadcrumbs Bar (VS Code inspired) ──── */}
      <div className="flex items-center justify-between px-3 py-1 bg-[#060b17] border-b border-[#14233d] text-[11px] font-mono text-[#627d9e] select-none">
        <div className="flex items-center gap-1 truncate">
          <FolderOpen className="w-3 h-3 text-[#3ba9ff] shrink-0" />
          {pathSegments.map((seg, i) => (
            <React.Fragment key={i}>
              <span className={i === pathSegments.length - 1 ? 'text-[#cbd5e1] font-semibold' : 'hover:text-[#93c5fd] cursor-pointer'}>
                {seg}
              </span>
              {i < pathSegments.length - 1 && (
                <ChevronRight className="w-3 h-3 opacity-40 shrink-0" />
              )}
            </React.Fragment>
          ))}
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[#506c94] shrink-0">
          <span>Git Gutter Ativo</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#5eead4]" />
        </div>
      </div>

      {/* ── Main Workspace Area (Editor + Optional Outline Drawer) ──── */}
      <div className="flex-1 flex overflow-hidden relative">
        <div className="flex-1 w-full relative overflow-hidden bg-[#070c18]">
          {activeTab ? (
            <Suspense
              fallback={
                <div className="flex flex-col items-center justify-center h-full w-full bg-[#070c18] text-[#506c94] gap-2 select-none">
                  <div className="w-5 h-5 border-2 border-[#3ba9ff]/30 border-t-[#3ba9ff] rounded-full animate-spin" />
                  <span className="text-[11px] font-mono">Carregando editor Monaco...</span>
                </div>
              }
            >
              <MonacoEditor
                height="100%"
                path={activeTab.filePath}
                language={activeTab.language || 'typescript'}
                value={activeTab.content}
                theme={globalStore.theme || 'nebula-dark'}
                beforeMount={handleEditorBeforeMount}
                onMount={handleEditorOnMount}
                onChange={(value) => {
                  handleUpdateContent(activeTab.filePath, value || '');
                }}
                options={{
                  fontSize: globalStore.fontSize,
                  fontFamily: "'JetBrains Mono', 'Fira Code', Menlo, Consolas, monospace",
                  fontLigatures: true,
                  wordWrap: globalStore.wordWrap ? 'on' : 'off',
                  minimap: { enabled: globalStore.minimap, scale: 1 },
                  smoothScrolling: true,
                  cursorSmoothCaretAnimation: 'on',
                  lineNumbers: 'on',
                  renderLineHighlight: 'all',
                  tabSize: 2,
                  scrollBeyondLastLine: false,
                  automaticLayout: true,
                  bracketPairColorization: { enabled: true },
                  padding: { top: 8, bottom: 8 },
                  glyphMargin: true,
                }}
              />
            </Suspense>
          ) : (
            <div className="p-8 text-center text-xs text-[#7a92b8]">Nenhum arquivo ativo.</div>
          )}
        </div>

        {/* Outline Symbols Drawer */}
        {globalStore.showOutline && (
          <aside className="w-56 bg-[#070e1c] border-l border-[#162744] flex flex-col shrink-0 select-none overflow-hidden transition-all">
            <div className="p-2 border-b border-[#162744] flex items-center justify-between text-xs font-semibold text-[#5eead4]">
              <span className="flex items-center gap-1.5">
                <ListTree className="w-3.5 h-3.5 text-[#3ba9ff]" />
                Símbolos ({symbols.length})
              </span>
              <button
                onClick={globalStore.toggleOutline}
                className="p-0.5 rounded hover:bg-[#162744] text-[#7a92b8]"
              >
                <X className="w-3 h-3" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-1 text-xs font-mono space-y-0.5">
              {symbols.length === 0 ? (
                <div className="p-3 text-[11px] text-[#506c94] text-center">
                  Nenhuma função ou classe detectada.
                </div>
              ) : (
                symbols.map((sym, idx) => (
                  <button
                    key={idx}
                    onClick={() => jumpToLine(sym.line)}
                    className="w-full flex items-center justify-between px-2 py-1 rounded hover:bg-[#162744] text-left text-[#cbd5e1] hover:text-[#5eead4] transition-colors group cursor-pointer"
                  >
                    <div className="flex items-center gap-1.5 truncate">
                      {sym.kind === 'function' ? (
                        <Code2 className="w-3 h-3 text-[#3ba9ff] shrink-0" />
                      ) : sym.kind === 'class' ? (
                        <Box className="w-3 h-3 text-[#f59e0b] shrink-0" />
                      ) : (
                        <Layers className="w-3 h-3 text-[#a78bfa] shrink-0" />
                      )}
                      <span className="truncate">{sym.name}</span>
                    </div>
                    <span className="text-[10px] text-[#506c94] group-hover:text-[#7a92b8] shrink-0 ml-1">
                      :{sym.line}
                    </span>
                  </button>
                ))
              )}
            </div>
          </aside>
        )}
      </div>

      {/* ── Status Bar (Notepad++ / VS Code style) ──── */}
      <div className="h-6 bg-[#060b17] border-t border-[#14233d] px-3 flex items-center justify-between text-[11px] text-[#6b82a6] select-none font-mono">
        <div className="flex items-center gap-4">
          <button
            type="button"
            onClick={() => {
              setGotoLineInput(String(globalStore.cursorLine || 1));
              setShowGotoLineModal(true);
            }}
            className="flex items-center gap-1 text-[#a3b8d7] hover:text-[#5eead4] transition-colors cursor-pointer"
            title="Ir para a Linha (Ctrl+G)"
          >
            Lin {globalStore.cursorLine}, Col {globalStore.cursorCol}
          </button>
          <span>Linhas: {lineCount}</span>
          <span>Caracteres: {charCount}</span>
          {activeTab?.isDirty ? (
            <span className="flex items-center gap-1 text-[#f59e0b]">
              <AlertCircle className="w-3 h-3" /> Modificado
            </span>
          ) : (
            <span className="flex items-center gap-1 text-[#10b981]">
              <CheckCircle2 className="w-3 h-3" /> Salvo
            </span>
          )}
        </div>

        <div className="flex items-center gap-4">
          <span className="text-[#3ba9ff]">{activeTab?.language || 'plaintext'}</span>
          <button
            type="button"
            onClick={handleToggleLineEndings}
            className="hover:text-[#5eead4] transition-colors cursor-pointer"
            title="Alternar LF / CRLF"
          >
            {lineEnding}
          </button>
          <button
            type="button"
            onClick={handleToggleEncoding}
            className="hover:text-[#5eead4] transition-colors cursor-pointer"
            title="Alternar UTF-8 / Latin-1"
          >
            {encoding}
          </button>
          <span className="text-[#5eead4]">git:({currentBranch})</span>
        </div>
      </div>

      {/* ── Clean Full-View Theme Picker Modal (Fixed UX - Never Clipped!) ──── */}
      {showThemePicker && (
        <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#091122] border border-[#3ba9ff]/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[#3ba9ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <Palette className="w-4 h-4 text-[#a78bfa]" />
                <span className="text-sm font-bold text-white">Temas do Editor Monaco</span>
              </div>
              <button
                type="button"
                onClick={() => setShowThemePicker(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
              {EDITOR_THEMES.map((th) => (
                <button
                  key={th.id}
                  type="button"
                  onClick={() => {
                    globalStore.setTheme(th.id);
                    setShowThemePicker(false);
                  }}
                  className={`flex items-center justify-between px-3 py-2 rounded-xl text-xs font-mono transition-all text-left ${
                    globalStore.theme === th.id
                      ? 'bg-[#3ba9ff]/25 text-[#5eead4] border border-[#5eead4]/60 font-semibold shadow-[0_0_15px_rgba(94,234,212,0.2)]'
                      : 'bg-[#0f1b33]/60 border border-transparent text-[#cbd5e1] hover:bg-[#162744] hover:text-white'
                  }`}
                >
                  <span>{th.name}</span>
                  <div className="flex items-center gap-2">
                    <span
                      className="w-3.5 h-3.5 rounded-full border border-white/20"
                      style={{ backgroundColor: th.badgeColor }}
                    />
                    {globalStore.theme === th.id && (
                      <CheckCircle2 className="w-3.5 h-3.5 text-[#5eead4]" />
                    )}
                  </div>
                </button>
              ))}
            </div>

            <button
              type="button"
              onClick={() => setShowThemePicker(false)}
              className="w-full py-2 rounded-xl bg-[#3ba9ff]/20 hover:bg-[#3ba9ff]/30 text-[#e6f0ff] text-xs font-semibold transition-colors mt-1"
            >
              Fechar
            </button>
          </div>
        </div>
      )}

      {/* ── Help / About Modal ──── */}
      {showHelpModal && (
        <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-md bg-[#091122] border border-[#3ba9ff]/40 rounded-2xl shadow-2xl p-5 flex flex-col gap-4">
            <div className="flex items-center justify-between border-b border-[#3ba9ff]/20 pb-3">
              <div className="flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-[#3ba9ff]" />
                <span className="text-sm font-bold text-white">Nebula Code Editor v2.7</span>
              </div>
              <button
                type="button"
                onClick={() => setShowHelpModal(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-3 text-xs text-[#a3b8d7]">
              <div>
                <strong className="text-white">Atalhos Essenciais:</strong>
                <ul className="mt-1 space-y-1 font-mono text-[11px]">
                  <li><code className="text-[#5eead4]">Ctrl+S</code> — Salvar arquivo no disco ou container</li>
                  <li><code className="text-[#5eead4]">Ctrl+F</code> — Abrir busca / Localizar no código</li>
                  <li><code className="text-[#5eead4]">Ctrl+H</code> — Localizar e Substituir</li>
                  <li><code className="text-[#5eead4]">Ctrl+Z / Ctrl+Y</code> — Desfazer e Refazer</li>
                </ul>
              </div>

              <div>
                <strong className="text-white">Instâncias Múltiplas e Independentes:</strong>
                <p className="mt-1 text-[11px] leading-relaxed">
                  Cada editor duplicado ou aberto via <code>Tools → Novo Editor Independente</code> opera de forma 100% isolada, permitindo editar arquivos diferentes simultaneamente sem interferência mútua.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowHelpModal(false)}
              className="w-full py-2 rounded-xl bg-[#3ba9ff] hover:bg-[#5eead4] text-[#050810] text-xs font-bold transition-colors"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      {/* ── Modal: Salvar Como ──── */}
      {showSaveAsModal && (
        <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#091122] border border-[#3ba9ff]/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-[#3ba9ff]/20 pb-2">
              <div className="flex items-center gap-2">
                <FilePlus className="w-4 h-4 text-[#5eead4]" />
                <span className="text-xs font-bold text-white font-mono">Salvar Arquivo Como</span>
              </div>
              <button
                type="button"
                onClick={() => setShowSaveAsModal(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#7a92b8]">
              Caminho ou nome do novo arquivo:
            </p>
            <input
              ref={saveAsInputRef}
              type="text"
              value={saveAsPath}
              onChange={(e) => setSaveAsPath(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSaveAs(saveAsPath);
                if (e.key === 'Escape') setShowSaveAsModal(false);
              }}
              className="bg-[#050810] border border-[#3ba9ff]/30 rounded-lg px-2.5 py-1.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowSaveAsModal(false)}
                className="px-3 py-1.5 text-xs text-[#7a92b8] hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => handleSaveAs(saveAsPath)}
                className="px-3 py-1.5 text-xs bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40 hover:bg-[#3ba9ff]/30 rounded-lg transition-colors font-medium"
              >
                Salvar Como
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Reverter Alterações ──── */}
      {showRevertModal && (
        <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-sm bg-[#091122] border border-[#ff3b5c]/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-[#ff3b5c]/20 pb-2">
              <div className="flex items-center gap-2">
                <RotateCcw className="w-4 h-4 text-[#ff3b5c]" />
                <span className="text-xs font-bold text-white font-mono">Reverter Alterações</span>
              </div>
              <button
                type="button"
                onClick={() => setShowRevertModal(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#cbd5e1] leading-relaxed">
              Deseja reverter todas as alterações não salvas no arquivo <strong className="text-white">{activeTab?.fileName}</strong>? Todas as edições desde o último salvamento serão descartadas.
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowRevertModal(false)}
                className="px-3 py-1.5 text-xs text-[#7a92b8] hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleRevert}
                className="px-3 py-1.5 text-xs bg-[#ff3b5c]/20 text-[#ff8ba7] border border-[#ff3b5c]/40 hover:bg-[#ff3b5c]/30 rounded-lg transition-colors font-medium"
              >
                Reverter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal: Ir para a Linha ──── */}
      {showGotoLineModal && (
        <div className="absolute inset-0 bg-[#050810]/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="w-full max-w-xs bg-[#091122] border border-[#3ba9ff]/40 rounded-2xl shadow-2xl p-4 flex flex-col gap-3 animate-in fade-in zoom-in-95 duration-100">
            <div className="flex items-center justify-between border-b border-[#3ba9ff]/20 pb-2">
              <div className="flex items-center gap-2">
                <Hash className="w-4 h-4 text-[#3ba9ff]" />
                <span className="text-xs font-bold text-white font-mono">Ir para a Linha</span>
              </div>
              <button
                type="button"
                onClick={() => setShowGotoLineModal(false)}
                className="p-1 rounded hover:bg-white/10 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-[11px] text-[#7a92b8]">
              Número da linha (1 a {lineCount}):
            </p>
            <input
              ref={gotoLineInputRef}
              type="number"
              min={1}
              max={lineCount}
              value={gotoLineInput}
              onChange={(e) => setGotoLineInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const num = parseInt(gotoLineInput, 10);
                  if (!isNaN(num)) handleGotoLine(num);
                }
                if (e.key === 'Escape') setShowGotoLineModal(false);
              }}
              className="bg-[#050810] border border-[#3ba9ff]/30 rounded-lg px-2.5 py-1.5 text-xs text-[#e6f0ff] font-mono focus:outline-none focus:border-[#5eead4]"
            />
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setShowGotoLineModal(false)}
                className="px-3 py-1.5 text-xs text-[#7a92b8] hover:text-white rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  const num = parseInt(gotoLineInput, 10);
                  if (!isNaN(num)) handleGotoLine(num);
                }}
                className="px-3 py-1.5 text-xs bg-[#3ba9ff]/20 text-[#3ba9ff] border border-[#3ba9ff]/40 hover:bg-[#3ba9ff]/30 rounded-lg transition-colors font-medium"
              >
                Ir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
