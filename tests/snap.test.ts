import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { detectSnap, resolveSnapGroup } from '../src/lib/snapManager';

describe('Snap & Docking System — Grouping, Boundaries & Cascade Detach', () => {
  it('detecta snap magnético quando janelas estão próximas dentro do limiar', () => {
    const dragging = { id: 'win-1', x: 200, y: 100, width: 400, height: 300 };
    const others = [{ id: 'win-2', x: 620, y: 100, width: 400, height: 300 }]; // dist = 20px (< threshold 40)

    const result = detectSnap(dragging, others, 40);
    assert.ok(result, 'Deve detectar oportunidade de snap');
    assert.equal(result.targetId, 'win-2');
    assert.equal(result.side, 'right');
    assert.equal(result.snapX, 220); // 620 - 400
  });

  it('não ativa snap quando janelas estão distantes além do limiar', () => {
    const dragging = { id: 'win-1', x: 100, y: 100, width: 400, height: 300 };
    const others = [{ id: 'win-2', x: 800, y: 100, width: 400, height: 300 }]; // dist = 300px

    const result = detectSnap(dragging, others, 40);
    assert.equal(result, null, 'Não deve detectar snap');
  });

  it('reutiliza grupo existente ou gera novo ID estável', () => {
    const group1 = resolveSnapGroup('snap-123', undefined);
    assert.equal(group1, 'snap-123');

    const group2 = resolveSnapGroup(undefined, 'snap-456');
    assert.equal(group2, 'snap-456');

    const groupNew = resolveSnapGroup(undefined, undefined);
    assert.match(groupNew, /^snap-/);
  });

  it('lógica de desencaixe em cascata limpa par e preserva grupo com 3+ janelas', () => {
    // Simulação da lógica de unsnap
    type MockWin = { id: string; x: number; y: number; snapGroup?: string };

    function mockUnsnap(windows: MockWin[], id: string): MockWin[] {
      const target = windows.find((w) => w.id === id);
      if (!target || !target.snapGroup) return windows;

      const group = target.snapGroup;
      const others = windows.filter((w) => w.snapGroup === group && w.id !== id);

      return windows.map((w) => {
        if (w.id === id) return { ...w, snapGroup: undefined };
        if (others.length === 1 && w.snapGroup === group) return { ...w, snapGroup: undefined };
        return w;
      });
    }

    // Caso 1: Par de janelas A e B
    const pair: MockWin[] = [
      { id: 'A', x: 100, y: 100, snapGroup: 'grp-1' },
      { id: 'B', x: 500, y: 100, snapGroup: 'grp-1' },
    ];
    const afterPairUnsnap = mockUnsnap(pair, 'A');
    assert.equal(afterPairUnsnap.find((w) => w.id === 'A')?.snapGroup, undefined, 'A deve ficar sem grupo');
    assert.equal(afterPairUnsnap.find((w) => w.id === 'B')?.snapGroup, undefined, 'B deve ficar sem grupo pois sobrou sozinho');
    assert.equal(afterPairUnsnap.find((w) => w.id === 'A')?.x, 100, 'Posição X de A mantida sem pulo');
    assert.equal(afterPairUnsnap.find((w) => w.id === 'B')?.x, 500, 'Posição X de B mantida sem pulo');

    // Caso 2: Trio de janelas A, B e C (desencaixe em cascata)
    const trio: MockWin[] = [
      { id: 'A', x: 100, y: 100, snapGroup: 'grp-2' },
      { id: 'B', x: 500, y: 100, snapGroup: 'grp-2' },
      { id: 'C', x: 900, y: 100, snapGroup: 'grp-2' },
    ];
    const afterTrioUnsnap = mockUnsnap(trio, 'A');
    assert.equal(afterTrioUnsnap.find((w) => w.id === 'A')?.snapGroup, undefined, 'A foi desencaixado');
    assert.equal(afterTrioUnsnap.find((w) => w.id === 'B')?.snapGroup, 'grp-2', 'B e C permanecem agrupados');
    assert.equal(afterTrioUnsnap.find((w) => w.id === 'C')?.snapGroup, 'grp-2', 'C permanece agrupado com B');
  });
});
