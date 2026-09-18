import React from 'react';

interface SnapGuideProps {
  /** Posição da linha guia no espaço do canvas (coordenadas do mundo, não da viewport) */
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  /** Transform CSS aplicado ao canvas (para converter coords mundo → viewport) */
  canvasTransform: string;
}

/**
 * SnapGuide — v2.6
 * 
 * Linha visual de alinhamento (estilo Figma/VS Code) mostrada durante drag
 * quando uma janela está prestes a se encaixar na outra.
 * Renderiza como uma linha absoluta posicionada no canvas.
 */
export const SnapGuide: React.FC<SnapGuideProps> = ({ x1, y1, x2, y2, canvasTransform }) => {
  const isVertical = x1 === x2;
  const isHorizontal = y1 === y2;

  if (!isVertical && !isHorizontal) return null;

  const style: React.CSSProperties = isVertical
    ? {
        position: 'absolute',
        left: x1,
        top: Math.min(y1, y2),
        width: 2,
        height: Math.abs(y2 - y1),
        background: 'linear-gradient(180deg, rgba(56,189,248,0) 0%, #38bdf8 20%, #38bdf8 80%, rgba(56,189,248,0) 100%)',
        boxShadow: '0 0 8px 2px rgba(56,189,248,0.6)',
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 99999,
        transform: canvasTransform,
        transformOrigin: 'top left',
      }
    : {
        position: 'absolute',
        left: Math.min(x1, x2),
        top: y1,
        width: Math.abs(x2 - x1),
        height: 2,
        background: 'linear-gradient(90deg, rgba(56,189,248,0) 0%, #38bdf8 20%, #38bdf8 80%, rgba(56,189,248,0) 100%)',
        boxShadow: '0 0 8px 2px rgba(56,189,248,0.6)',
        borderRadius: 2,
        pointerEvents: 'none',
        zIndex: 99999,
        transform: canvasTransform,
        transformOrigin: 'top left',
      };

  return <div style={style} />;
};
