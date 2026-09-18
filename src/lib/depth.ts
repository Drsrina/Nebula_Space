import { DepthConfig, DepthLevel } from '../types';

/**
 * Nebula Depth System (3 Cognitive Planes)
 * 
 * - Degrau 0 (Z = 0px): Focus. The active working window, preview, or current note.
 *   Sharp, full opacity, 1.0 scale, strong neon accent glow.
 * 
 * - Degrau 1 (Z = -400px): Context. Project file tree, related references, directory browsing.
 *   Light blur (1.5px), 0.82 opacity, 0.94 scale, medium glow.
 * 
 * - Degrau 2 (Z = -700px): Archive/Reference. Parked notes, docs, backlog or historical material.
 *   Deeper blur (3px), 0.60 opacity, 0.88 scale, subtle glow.
 */

// Necessário para hit-testing do degrau 2 — ver v0.1.3 para não regredir
export const DEPTH_Z: Record<DepthLevel, number> = {
  0: 0,
  1: -400,
  2: -700, // Ajustado de -800 para -700 para hit-testing consistente no CSS 3D
};

export const DEPTH_CONFIGS: Record<DepthLevel, DepthConfig> = {
  0: {
    level: 0,
    z: DEPTH_Z[0],
    name: 'Degrau 0: Foco',
    subtitle: 'Janela ativa & editor',
    blur: '0px',
    opacity: 1.0,
    scale: 1.0,
    boxShadow: '0 0 50px rgba(59, 169, 255, 0.28), 0 20px 40px rgba(0, 0, 0, 0.6)',
    borderColor: 'rgba(94, 234, 212, 0.45)',
  },
  1: {
    level: 1,
    z: DEPTH_Z[1],
    name: 'Degrau 1: Contexto',
    subtitle: 'Árvore de arquivos & pastas',
    blur: '1.5px',
    opacity: 0.82,
    scale: 0.94,
    boxShadow: '0 0 35px rgba(59, 169, 255, 0.16), 0 15px 30px rgba(0, 0, 0, 0.5)',
    borderColor: 'rgba(80, 180, 255, 0.25)',
  },
  2: {
    level: 2,
    z: DEPTH_Z[2],
    name: 'Degrau 2: Arquivo',
    subtitle: 'Notas e docs estacionados',
    blur: '3px',
    opacity: 0.6,
    scale: 0.88,
    boxShadow: '0 0 20px rgba(59, 169, 255, 0.08), 0 10px 25px rgba(0, 0, 0, 0.4)',
    borderColor: 'rgba(80, 180, 255, 0.14)',
  },
};

export const DEPTH_LEVELS: DepthLevel[] = [0, 1, 2];

/**
 * Returns the closest depth level for a given arbitrary Z coordinate
 */
export function snapToNearestDepth(z: number): DepthLevel {
  if (z > -200) return 0;
  if (z > -550) return 1;
  return 2;
}

/**
 * Returns the depth configuration for a given depth level
 */
export function getDepthConfig(level: DepthLevel): DepthConfig {
  return DEPTH_CONFIGS[level] ?? DEPTH_CONFIGS[0];
}

/**
 * Retorna o valor de Z da câmera para posicionar a camada especificada
 * exatamente no plano focal Z=0 da tela (neutraliza o Z negativo da camada no CSS 3D).
 * 
 * Relação: Z_tela = Z_janela (negativo) + Z_câmera (positivo) = 0px
 */
export function getCameraZForLayer(level: DepthLevel): number {
  return Math.abs(DEPTH_Z[level] ?? 0);
}

