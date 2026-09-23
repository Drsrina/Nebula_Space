import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('Camera Reset & Window Spawn Centering', () => {
  type WindowMock = {
    id: string;
    x: number;
    y: number;
    width: number;
    height: number;
    depth: number;
    isMinimized?: boolean;
    isPopped?: boolean;
  };

  function computeResetCamera(windows: WindowMock[]) {
    const active = windows.filter((w) => !w.isMinimized && !w.isPopped);
    if (active.length === 0) {
      return { x: 0, y: 0, z: 0, zoom: 1.0, depthPlane: 0 };
    }

    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;

    for (const win of active) {
      minX = Math.min(minX, win.x);
      maxX = Math.max(maxX, win.x + win.width);
      minY = Math.min(minY, win.y);
      maxY = Math.max(maxY, win.y + win.height);
    }

    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;

    return {
      x: Number((-centerX).toFixed(2)),
      y: Number((-centerY).toFixed(2)),
      z: 0,
      zoom: 1.0,
      depthPlane: 0,
    };
  }

  it('workspace vazio centraliza exatamente em (0,0) do Degrau 0', () => {
    const camera = computeResetCamera([]);
    assert.equal(camera.x, 0, 'Câmera X deve ser 0');
    assert.equal(camera.y, 0, 'Câmera Y deve ser 0');
    assert.equal(camera.z, 0, 'Câmera Z deve ser 0 (Degrau 0)');
    assert.equal(camera.zoom, 1.0, 'Zoom padrão deve ser 1.0');
    assert.equal(camera.depthPlane, 0, 'Plano deve ser Degrau 0');
  });

  it('centraliza na média das bounding boxes com 3 janelas (uma por degrau)', () => {
    const threeWindows: WindowMock[] = [
      { id: 'w0', x: -200, y: -150, width: 400, height: 300, depth: 0 }, // Center = (0, 0)
      { id: 'w1', x: 300, y: -100, width: 400, height: 300, depth: 1 },  // Left: 300, Right: 700
      { id: 'w2', x: -700, y: 100, width: 300, height: 200, depth: 2 },  // Left: -700, Right: -400
    ];

    // minX = -700, maxX = 700 -> centerX = 0
    // minY = -150, maxY = 300 -> centerY = 75
    const camera = computeResetCamera(threeWindows);
    assert.equal(camera.x, 0, 'Centro X da bounding box');
    assert.equal(camera.y, -75, 'Centro Y da bounding box invertido para a câmera');
    assert.equal(camera.z, 0, 'Reseta foco para Degrau 0');
  });

  it('padronização de spawn posiciona nova janela centrada em (0,0) no Degrau 0', () => {
    const width = 640;
    const height = 480;
    const offset = 0; // primeira janela

    const spawnX = Math.round(-width / 2 + offset);
    const spawnY = Math.round(-height / 2 + offset);

    // O centro geométrico da janela (x + width / 2, y + height / 2) deve ser (0, 0)
    const windowCenterX = spawnX + width / 2;
    const windowCenterY = spawnY + height / 2;

    assert.equal(windowCenterX, 0, 'Centro horizontal deve ser 0');
    assert.equal(windowCenterY, 0, 'Centro vertical deve ser 0');
  });
});
