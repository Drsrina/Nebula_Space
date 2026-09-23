import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { usePaletteStore } from '../src/store/usePaletteStore';
import { useWindowsStore } from '../src/store/useWindowsStore';

describe('Command Palette Overlay & Store — Modal, Shortcuts & Focus Restoration', () => {
  test('inicia fechada por padrão', () => {
    const state = usePaletteStore.getState();
    assert.strictEqual(state.isOpen, false);
  });

  test('abre em modo de arquivos com openPalette("files")', () => {
    usePaletteStore.getState().openPalette('files');
    const state = usePaletteStore.getState();
    assert.strictEqual(state.isOpen, true);
    assert.strictEqual(state.mode, 'files');
    usePaletteStore.getState().closePalette();
  });

  test('abre em modo de comandos com openPalette("commands")', () => {
    usePaletteStore.getState().openPalette('commands');
    const state = usePaletteStore.getState();
    assert.strictEqual(state.isOpen, true);
    assert.strictEqual(state.mode, 'commands');
    usePaletteStore.getState().closePalette();
  });

  test('memoriza e restaura foco da janela ativa anterior ao fechar', () => {
    // Configura estado inicial com uma janela ativa
    const winId = 'win-test-42';
    useWindowsStore.setState({
      activeWindowId: winId,
      windows: [{ id: winId, type: 'note', x: 0, y: 0, width: 400, height: 300, depth: 0, zIndex: 1 } as any],
    });
    assert.strictEqual(useWindowsStore.getState().activeWindowId, winId);

    // Abre a command palette
    usePaletteStore.getState().openPalette('commands');
    assert.strictEqual(usePaletteStore.getState().isOpen, true);
    assert.strictEqual(usePaletteStore.getState().previousActiveWindowId, winId);

    // Fecha a command palette
    usePaletteStore.getState().closePalette();
    assert.strictEqual(usePaletteStore.getState().isOpen, false);
    assert.strictEqual(useWindowsStore.getState().activeWindowId, winId);
  });

  test('togglePalette alterna estado aberto/fechado', () => {
    usePaletteStore.getState().closePalette();
    assert.strictEqual(usePaletteStore.getState().isOpen, false);

    usePaletteStore.getState().togglePalette('files');
    assert.strictEqual(usePaletteStore.getState().isOpen, true);
    assert.strictEqual(usePaletteStore.getState().mode, 'files');

    usePaletteStore.getState().togglePalette('files');
    assert.strictEqual(usePaletteStore.getState().isOpen, false);
  });
});
