import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useLayoutPresetsStore, BUILTIN_PRESETS } from '../src/store/useLayoutPresetsStore';
import { useWindowsStore } from '../src/store/useWindowsStore';
import { useCanvasStore } from '../src/store/useCanvasStore';

describe('Layout Presets Espaciais (Workspaces Salvos)', () => {
  beforeEach(() => {
    useLayoutPresetsStore.setState({
      presets: [...BUILTIN_PRESETS],
      activePresetId: 'preset-coding',
    });
  });

  test('contém os 4 presets embutidos padrão (Coding, Review/Notes, Fullstack, Zen)', () => {
    const { presets } = useLayoutPresetsStore.getState();
    assert.ok(presets.length >= 4);

    const coding = presets.find((p) => p.id === 'preset-coding');
    assert.ok(coding, 'Preset Coding deve existir');
    assert.equal(coding.windows.length, 3, 'Coding deve ter 3 janelas (D0, D1, D2)');

    const review = presets.find((p) => p.id === 'preset-review-notes');
    assert.ok(review, 'Preset Review / Notes deve existir');
    assert.equal(review.windows.length, 3);

    const fullstack = presets.find((p) => p.id === 'preset-fullstack');
    assert.ok(fullstack, 'Preset Full Stack deve existir');
    assert.equal(fullstack.windows.length, 5);

    const zen = presets.find((p) => p.id === 'preset-zen');
    assert.ok(zen, 'Preset Zen deve existir');
    assert.equal(zen.windows.length, 1);
  });

  test('applyPreset("preset-coding") instancia janelas nos degraus D0, D1 e D2', () => {
    const applied = useLayoutPresetsStore.getState().applyPreset('preset-coding');
    assert.equal(applied, true);

    const windows = useWindowsStore.getState().windows;
    assert.equal(windows.length, 3);

    const editorWin = windows.find((w) => w.type === 'editor');
    assert.ok(editorWin, 'Editor deve estar presente');
    assert.equal(editorWin.depth, 0, 'Editor deve estar no Degrau 0 (Foco)');

    const diffWin = windows.find((w) => w.type === 'diff');
    assert.ok(diffWin, 'Diff deve estar presente');
    assert.equal(diffWin.depth, 1, 'Diff deve estar no Degrau 1 (Contexto)');

    const gitWin = windows.find((w) => w.type === 'git-panel');
    assert.ok(gitWin, 'Git Panel deve estar presente');
    assert.equal(gitWin.depth, 2, 'Git Panel deve estar no Degrau 2 (Arquivo)');

    const camera = useCanvasStore.getState().camera;
    assert.equal(camera.z, 0, 'Câmera deve resetar no Z=0');
  });

  test('saveCurrentAsPreset cria um preset personalizado com as janelas ativas', () => {
    const customId = useLayoutPresetsStore.getState().saveCurrentAsPreset('Meu Workspace Custom', 'Teste');
    assert.ok(customId.startsWith('preset-custom-'));

    const { presets, activePresetId } = useLayoutPresetsStore.getState();
    assert.equal(activePresetId, customId);

    const found = presets.find((p) => p.id === customId);
    assert.ok(found);
    assert.equal(found.name, 'Meu Workspace Custom');
    assert.equal(found.isBuiltIn, false);
  });

  test('deletePreset remove preset customizado e não permite deletar built-in', () => {
    // Não pode deletar built-in
    const deleteBuiltin = useLayoutPresetsStore.getState().deletePreset('preset-coding');
    assert.equal(deleteBuiltin, false);

    // Pode deletar custom
    const customId = useLayoutPresetsStore.getState().saveCurrentAsPreset('Para Deletar');
    const deleteCustom = useLayoutPresetsStore.getState().deletePreset(customId);
    assert.equal(deleteCustom, true);

    const remaining = useLayoutPresetsStore.getState().presets.find((p) => p.id === customId);
    assert.equal(remaining, undefined);
  });
});
