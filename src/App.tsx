import React, { useEffect, useState } from 'react';
import { TopBar } from './components/TopBar';
import { Canvas3D } from './components/Canvas3D';
import { CameraController } from './components/CameraController';
import { ActiveLayerIndicator } from './components/ActiveLayerIndicator';
import { Minimap } from './components/Minimap';
import { FullScreenLoginGate } from './components/FullScreenLoginGate';
import { CommandPaletteOverlay } from './components/CommandPaletteOverlay';
import { useFSStore } from './store/useFSStore';
import { useCanvasStore } from './store/useCanvasStore';
import { useWindowsStore } from './store/useWindowsStore';
import { useThemeStore } from './store/useThemeStore';
import { getAuthToken } from './lib/api';
import { Loader2 } from 'lucide-react';

export default function App() {
  const { initFS, errorMessage } = useFSStore();
  const { isFocusMode } = useCanvasStore();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAuthToken());
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
    // Aplica o tema global configurado imediatamente
    useThemeStore.getState().applyTheme();

    const checkAuthStatus = async () => {
      const token = getAuthToken();
      if (token) {
        setIsAuthenticated(true);
        setIsCheckingAuth(false);
        initFS();
        return;
      }
      try {
        const res = await fetch('/api/health');
        if (res.ok) {
          const data = await res.json();
          if (!data.authRequired) {
            setIsAuthenticated(true);
            initFS();
          } else {
            setIsAuthenticated(false);
          }
        } else {
          setIsAuthenticated(false);
        }
      } catch {
        setIsAuthenticated(false);
      } finally {
        setIsCheckingAuth(false);
      }
    };

    checkAuthStatus();

    const handleLogoutEvent = () => {
      setIsAuthenticated(false);
    };

    const handleFileSaved = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      useFSStore.getState().refreshTree();
      if (detail?.path) {
        const { windows, openFilePreview } = useWindowsStore.getState();
        const previewWin = windows.find((w) => w.type === 'file-preview');
        if (previewWin && (previewWin.payload as any)?.filePath === detail.path) {
          openFilePreview({
            ...(previewWin.payload as any),
            content: detail.content,
            size: new Blob([detail.content || '']).size,
            lastModified: Date.now(),
          });
        }
      }
    };

    window.addEventListener('nebula_logout', handleLogoutEvent);
    window.addEventListener('nebula_file_saved', handleFileSaved);
    return () => {
      window.removeEventListener('nebula_logout', handleLogoutEvent);
      window.removeEventListener('nebula_file_saved', handleFileSaved);
    };
  }, [initFS]);

  // Loading Splash while determining authentication status
  if (isCheckingAuth) {
    return (
      <div className="w-screen h-screen bg-[#050810] flex flex-col items-center justify-center gap-3 select-none font-mono text-xs text-[#7a92b8]">
        <Loader2 className="w-8 h-8 animate-spin text-[#3ba9ff]" />
        <span>Iniciando Nebula Workspace...</span>
      </div>
    );
  }

  // Full-Screen Authentication Gate (Blocks entire application until login is completed)
  if (!isAuthenticated) {
    return (
      <FullScreenLoginGate
        onLoginSuccess={() => {
          setIsAuthenticated(true);
          initFS();
        }}
      />
    );
  }

  // Full Workspace (Only accessible after successful login)
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050810] select-none">
      {/* Top Bar HUD */}
      <TopBar />

      {/* 3D Spatial Canvas */}
      <Canvas3D />

      {/* Subtle HUD Active Layer Indicator (Degraus 0, 1, 2) */}
      <ActiveLayerIndicator />

      {/* Camera & Spatial Navigation HUD */}
      <CameraController />

      {/* Canvas Minimap */}
      <Minimap />

      {/* Fixed Viewport Command Palette Modal */}
      <CommandPaletteOverlay />

      {/* Error alert toast if file system access fails */}
      {errorMessage && (
        <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl bg-[#ff5c7a]/20 border border-[#ff5c7a]/40 text-[#ff8ba7] text-xs backdrop-blur-md shadow-[0_4px_20px_rgba(255,92,122,0.2)] max-w-md flex items-center gap-2">
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
