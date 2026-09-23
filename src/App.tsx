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
import { getAuthToken } from './lib/api';
import { Info, X, Loader2 } from 'lucide-react';

export default function App() {
  const { initFS, errorMessage } = useFSStore();
  const { isFocusMode } = useCanvasStore();
  const [showTip, setShowTip] = useState(true);

  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    return Boolean(getAuthToken());
  });
  const [isCheckingAuth, setIsCheckingAuth] = useState<boolean>(true);

  useEffect(() => {
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

    window.addEventListener('nebula_logout', handleLogoutEvent);
    return () => window.removeEventListener('nebula_logout', handleLogoutEvent);
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

      {/* Quick onboard guide tooltip (can be dismissed) */}
      {showTip && !isFocusMode && (
        <aside
          aria-label="Controles de Navegação 3D"
          className="absolute bottom-6 left-6 z-40 hidden md:flex items-center gap-3 px-3.5 py-2.5 rounded-xl bg-[#0f192d]/80 backdrop-blur-xl border border-[#50b4ff]/20 text-[11px] text-[#7a92b8] shadow-[0_4px_25px_rgba(0,0,0,0.5)]"
        >
          <Info className="w-4 h-4 text-[#3ba9ff] shrink-0" />
          <div className="flex items-center gap-2">
            <span>
              <strong className="text-[#e6f0ff] font-medium">Pan:</strong> Arraste o fundo
            </span>
            <span className="opacity-40">•</span>
            <span>
              <strong className="text-[#e6f0ff] font-medium">Degraus:</strong> Teclas 1, 2, 3 (Esc = D0)
            </span>
            <span className="opacity-40">•</span>
            <span>
              <strong className="text-[#5eead4] font-medium">Arrastar janela:</strong> Foca seu degrau automaticamente
            </span>
          </div>
          <button
            type="button"
            onClick={() => setShowTip(false)}
            className="text-[#7a92b8] hover:text-[#e6f0ff] ml-1 cursor-pointer"
            title="Fechar dica"
            aria-label="Fechar dica de navegação"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </aside>
      )}
    </div>
  );
}
