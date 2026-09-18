/**
 * snapManager.ts — v2.6
 * 
 * Algoritmo de detecção e cálculo de snap magnético entre janelas Nebula.
 * Quando uma janela é arrastada e suas bordas ficam próximas das bordas de
 * outra janela, retorna o alvo e a posição de snap para encaixe perfeito.
 */

export const SNAP_THRESHOLD = 40; // pixels de distância para ativar snap

export type SnapSide = 'left' | 'right' | 'top' | 'bottom';

export interface WindowRect {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapResult {
  targetId: string;
  side: SnapSide;        // lado do alvo onde a janela vai encaixar
  snapX: number;         // posição X final após snap
  snapY: number;         // posição Y final após snap
  guideX1: number;       // linha guia — ponto inicial X
  guideY1: number;
  guideX2: number;       // linha guia — ponto final X
  guideY2: number;
}

/**
 * Detecta se a janela sendo arrastada está próxima o suficiente de
 * qualquer outra janela para ativar snap, e retorna o resultado do snap.
 */
export function detectSnap(
  dragging: WindowRect,
  others: WindowRect[],
  threshold = SNAP_THRESHOLD
): SnapResult | null {
  let bestResult: SnapResult | null = null;
  let bestDist = threshold + 1;

  const dRight = dragging.x + dragging.width;
  const dBottom = dragging.y + dragging.height;
  const dCenterX = dragging.x + dragging.width / 2;
  const dCenterY = dragging.y + dragging.height / 2;

  for (const other of others) {
    if (other.id === dragging.id) continue;

    const oRight = other.x + other.width;
    const oBottom = other.y + other.height;

    // Verifica sobreposição vertical (janelas estão alinhadas horizontalmente)
    const vertOverlap =
      dCenterY > other.y - threshold && dCenterY < oBottom + threshold;

    // Verifica sobreposição horizontal (janelas estão alinhadas verticalmente)
    const horzOverlap =
      dCenterX > other.x - threshold && dCenterX < oRight + threshold;

    // ── Snap: borda direita da arrastada com borda esquerda do alvo ─────────
    if (vertOverlap) {
      const dist = Math.abs(dRight - other.x);
      if (dist < bestDist) {
        bestDist = dist;
        bestResult = {
          targetId: other.id,
          side: 'right',
          snapX: other.x - dragging.width,
          snapY: dragging.y,
          guideX1: other.x,
          guideY1: Math.min(dragging.y, other.y),
          guideX2: other.x,
          guideY2: Math.max(dBottom, oBottom),
        };
      }
    }

    // ── Snap: borda esquerda da arrastada com borda direita do alvo ─────────
    if (vertOverlap) {
      const dist = Math.abs(dragging.x - oRight);
      if (dist < bestDist) {
        bestDist = dist;
        bestResult = {
          targetId: other.id,
          side: 'left',
          snapX: oRight,
          snapY: dragging.y,
          guideX1: oRight,
          guideY1: Math.min(dragging.y, other.y),
          guideX2: oRight,
          guideY2: Math.max(dBottom, oBottom),
        };
      }
    }

    // ── Snap: borda inferior da arrastada com borda superior do alvo ─────────
    if (horzOverlap) {
      const dist = Math.abs(dBottom - other.y);
      if (dist < bestDist) {
        bestDist = dist;
        bestResult = {
          targetId: other.id,
          side: 'bottom',
          snapX: dragging.x,
          snapY: other.y - dragging.height,
          guideX1: Math.min(dragging.x, other.x),
          guideY1: other.y,
          guideX2: Math.max(dRight, oRight),
          guideY2: other.y,
        };
      }
    }

    // ── Snap: borda superior da arrastada com borda inferior do alvo ─────────
    if (horzOverlap) {
      const dist = Math.abs(dragging.y - oBottom);
      if (dist < bestDist) {
        bestDist = dist;
        bestResult = {
          targetId: other.id,
          side: 'top',
          snapX: dragging.x,
          snapY: oBottom,
          guideX1: Math.min(dragging.x, other.x),
          guideY1: oBottom,
          guideX2: Math.max(dRight, oRight),
          guideY2: oBottom,
        };
      }
    }
  }

  return bestResult;
}

/**
 * Calcula o snap group ID para duas janelas que se encaixaram.
 * Se uma das janelas já tem um grupo, usa esse grupo — caso contrário gera um novo.
 */
export function resolveSnapGroup(
  groupA: string | undefined,
  groupB: string | undefined
): string {
  return groupA ?? groupB ?? `snap-${Date.now()}`;
}
