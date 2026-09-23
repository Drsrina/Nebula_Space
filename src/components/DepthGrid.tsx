import React from 'react';
import { DepthLevel } from '../types';
import { DEPTH_CONFIGS, DEPTH_LEVELS } from '../lib/depth';
import { useCanvasStore } from '../store/useCanvasStore';

export const DepthGrid: React.FC = () => {
  const { isFocusMode, currentDepthPlane } = useCanvasStore();

  // Mantém apenas o grid mais fundo (Degrau 2, Z = -700px) para eliminar excesso de linhas visuais
  const level: DepthLevel = 2;
  const config = DEPTH_CONFIGS[level];
  const isMutedByFocus = isFocusMode && currentDepthPlane === 0;
  const isFocalPlane = currentDepthPlane === level;

  const gridSize = '64px';
  const opacity = isMutedByFocus ? 0.015 : isFocalPlane ? 0.09 : 0.04;

  return (
    <div
      className="absolute inset-0 pointer-events-none"
      style={{ transformStyle: 'preserve-3d' }}
    >
      <div
        key={level}
        style={{
          position: 'absolute',
          left: '50%',
          top: '50%',
          width: '5000px',
          height: '5000px',
          transform: `translate(-50%, -50%) translateZ(${config.z}px)`,
          transformStyle: 'preserve-3d',
          backgroundImage: `
            linear-gradient(to right, rgba(59, 169, 255, ${opacity}) 1px, transparent 1px),
            linear-gradient(to bottom, rgba(59, 169, 255, ${opacity}) 1px, transparent 1px)
          `,
          backgroundSize: `${gridSize} ${gridSize}`,
          transition: 'opacity 0.4s ease',
          pointerEvents: 'none',
        }}
      >
        {/* Spatial Plane Labels and Corner Crosshairs */}
        <div
          className="absolute left-[38%] top-[38%] p-2 rounded-lg border border-[#3ba9ff]/15 bg-[#050810]/40 backdrop-blur-sm text-[10px] font-mono tracking-widest text-[#7a92b8] flex items-center gap-2 select-none pointer-events-none"
          style={{
            opacity: isMutedByFocus ? 0 : 0.5,
            transform: 'translateZ(10px)',
          }}
        >
          <span className="w-2 h-2 rounded-full bg-[#6ea8ff]" />
          <span>PLANO Z = {config.z}px</span>
          <span className="opacity-50">[{config.name}]</span>
        </div>

        {/* Faint depth plane boundaries */}
        <div
          className="absolute left-[25%] top-[20%] w-[2000px] h-[1500px] border border-[#3ba9ff]/10 rounded-3xl pointer-events-none"
        />
      </div>
    </div>
  );
};
