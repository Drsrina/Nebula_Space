import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  screenToWorld,
  worldToScreen,
  worldBoundsToScreen,
  calculateCursorZoom,
} from '../src/lib/coordinates';

describe('Coordinates & Cursor Zoom — World <-> Screen Transformations', () => {
  it('transformação centro da tela para centro do mundo em zoom 1.0', () => {
    const camera = { x: 0, y: 0, zoom: 1.0 };
    const viewport = { width: 1000, height: 800 };

    const worldPoint = screenToWorld(500, 400, camera, viewport.width, viewport.height);
    assert.equal(worldPoint.x, 0, 'Centro da tela deve ser (0,0) no mundo');
    assert.equal(worldPoint.y, 0, 'Centro da tela deve ser (0,0) no mundo');

    const screenPoint = worldToScreen(0, 0, camera, viewport.width, viewport.height);
    assert.equal(screenPoint.x, 500, 'Centro do mundo deve mapear para (500,400)');
    assert.equal(screenPoint.y, 400);
  });

  it('preserva integridade bidirecional (round-trip) em diferentes níveis de zoom e pan', () => {
    const camera = { x: 140, y: -80, zoom: 1.65 };
    const viewport = { width: 1920, height: 1080 };

    const originalWorld = { x: 235.5, y: -412.8 };
    const screen = worldToScreen(originalWorld.x, originalWorld.y, camera, viewport.width, viewport.height);
    const convertedWorld = screenToWorld(screen.x, screen.y, camera, viewport.width, viewport.height);

    assert.ok(Math.abs(convertedWorld.x - originalWorld.x) < 0.001, 'Round-trip X deve ser idêntico');
    assert.ok(Math.abs(convertedWorld.y - originalWorld.y) < 0.001, 'Round-trip Y deve ser idêntico');
  });

  it('transforma bounding boxes do mundo para tela corretamente', () => {
    const camera = { x: 0, y: 0, zoom: 2.0 };
    const viewport = { width: 1000, height: 800 };
    const bounds = { x: -100, y: -50, width: 200, height: 100 };

    const screenBounds = worldBoundsToScreen(bounds, camera, viewport.width, viewport.height);
    assert.equal(screenBounds.width, 400, 'Largura deve ser multiplicada pelo zoom (200 * 2 = 400)');
    assert.equal(screenBounds.height, 200, 'Altura deve ser multiplicada pelo zoom (100 * 2 = 200)');
    // Top-left: screenX = 500 + (-100 + 0) * 2 = 300, screenY = 400 + (-50 + 0) * 2 = 300
    assert.equal(screenBounds.x, 300);
    assert.equal(screenBounds.y, 300);
  });

  it('zoom no centro da tela mantém câmera x e y inalterados', () => {
    const currentCamera = { x: 50, y: -30, zoom: 1.0 };
    const viewport = { width: 1000, height: 800 };
    const centerCursor = { x: 500, y: 400 };

    const updated = calculateCursorZoom(currentCamera, 1.5, centerCursor, viewport);
    assert.equal(updated.zoom, 1.5);
    assert.equal(updated.x, 50, 'Zoom no centro não altera câmera X');
    assert.equal(updated.y, -30, 'Zoom no centro não altera câmera Y');
  });

  it('zoom centrado no cursor mantém o ponto do cursor estacionário na tela', () => {
    const currentCamera = { x: 0, y: 0, zoom: 1.0 };
    const viewport = { width: 1000, height: 800 };
    const cursorScreen = { x: 750, y: 200 }; // 250px à direita do centro, 200px acima do centro

    // Ponto no mundo antes do zoom
    const worldBefore = screenToWorld(cursorScreen.x, cursorScreen.y, currentCamera, viewport.width, viewport.height);

    // Aplica zoom in (1.0 -> 2.0)
    const updatedCamera = calculateCursorZoom(currentCamera, 2.0, cursorScreen, viewport);

    // Ponto na tela do mesmo ponto no mundo após o zoom com nova câmera
    const screenAfter = worldToScreen(worldBefore.x, worldBefore.y, updatedCamera, viewport.width, viewport.height);

    assert.ok(
      Math.abs(screenAfter.x - cursorScreen.x) < 0.05,
      `Posição X na tela deve permanecer fixa sob o cursor (${screenAfter.x} vs ${cursorScreen.x})`
    );
    assert.ok(
      Math.abs(screenAfter.y - cursorScreen.y) < 0.05,
      `Posição Y na tela deve permanecer fixa sob o cursor (${screenAfter.y} vs ${cursorScreen.y})`
    );
  });

  it('zoom no canto superior esquerdo (0,0) mantém o canto fixo na tela', () => {
    const currentCamera = { x: 0, y: 0, zoom: 1.0 };
    const viewport = { width: 1000, height: 800 };
    const cornerCursor = { x: 0, y: 0 };

    const worldBefore = screenToWorld(0, 0, currentCamera, viewport.width, viewport.height);
    const updatedCamera = calculateCursorZoom(currentCamera, 1.8, cornerCursor, viewport);
    const screenAfter = worldToScreen(worldBefore.x, worldBefore.y, updatedCamera, viewport.width, viewport.height);

    assert.ok(
      Math.abs(screenAfter.x - 0) < 0.05,
      `Canto X deve permanecer em 0 (${screenAfter.x})`
    );
    assert.ok(
      Math.abs(screenAfter.y - 0) < 0.05,
      `Canto Y deve permanecer em 0 (${screenAfter.y})`
    );
  });
});
