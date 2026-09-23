import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { useEditorStore } from '../src/store/useEditorStore';

describe('Code Editor — Advanced Options, Save As, Revert & Tab Management', () => {
  test('closeOtherTabs com 3+ abas mantém apenas a aba selecionada', () => {
    // Configura 3 abas de teste
    const tab1 = { filePath: 'src/a.ts', fileName: 'a.ts', content: 'const a = 1;', savedContent: 'const a = 1;', isDirty: false, language: 'typescript' };
    const tab2 = { filePath: 'src/b.ts', fileName: 'b.ts', content: 'const b = 2;', savedContent: 'const b = 2;', isDirty: false, language: 'typescript' };
    const tab3 = { filePath: 'src/c.ts', fileName: 'c.ts', content: 'const c = 3;', savedContent: 'const c = 3;', isDirty: false, language: 'typescript' };

    useEditorStore.setState({
      tabs: [tab1, tab2, tab3],
      activeTabPath: 'src/b.ts',
    });

    assert.strictEqual(useEditorStore.getState().tabs.length, 3);

    // Fecha outras abas mantendo src/b.ts
    useEditorStore.getState().closeOtherTabs('src/b.ts');

    const state = useEditorStore.getState();
    assert.strictEqual(state.tabs.length, 1);
    assert.strictEqual(state.tabs[0].filePath, 'src/b.ts');
    assert.strictEqual(state.activeTabPath, 'src/b.ts');
  });

  test('closeAllTabs fecha todas as abas abertas', () => {
    const tab1 = { filePath: 'src/a.ts', fileName: 'a.ts', content: 'const a = 1;', savedContent: 'const a = 1;', isDirty: false, language: 'typescript' };
    useEditorStore.setState({
      tabs: [tab1],
      activeTabPath: 'src/a.ts',
    });

    useEditorStore.getState().closeAllTabs();

    const state = useEditorStore.getState();
    assert.strictEqual(state.tabs.length, 0);
    assert.strictEqual(state.activeTabPath, null);
  });

  test('revertFileByPath reverte o conteúdo modificado para o savedContent e limpa dirty flag', () => {
    const savedCode = 'function hello() { return "world"; }';
    const modifiedCode = 'function hello() { return "broken"; }';

    const tab = {
      filePath: 'src/test-revert.ts',
      fileName: 'test-revert.ts',
      content: modifiedCode,
      savedContent: savedCode,
      isDirty: true,
      language: 'typescript',
    };

    useEditorStore.setState({
      tabs: [tab],
      activeTabPath: 'src/test-revert.ts',
    });

    assert.strictEqual(useEditorStore.getState().tabs[0].isDirty, true);
    assert.strictEqual(useEditorStore.getState().tabs[0].content, modifiedCode);

    // Executa reversão
    useEditorStore.getState().revertFileByPath('src/test-revert.ts');

    const revertedTab = useEditorStore.getState().tabs.find((t) => t.filePath === 'src/test-revert.ts');
    assert.ok(revertedTab);
    assert.strictEqual(revertedTab.content, savedCode, 'O conteúdo deve voltar ao estado salvo');
    assert.strictEqual(revertedTab.isDirty, false, 'O dirty flag deve ser desativado');
  });

  test('conversão de quebras de linha LF <-> CRLF preserva o texto', () => {
    const textLF = 'linha 1\nlinha 2\nlinha 3';
    const textCRLF = textLF.replace(/\r?\n/g, '\r\n');
    assert.ok(textCRLF.includes('\r\n'));
    assert.strictEqual(textCRLF.split('\r\n').length, 3);

    const backToLF = textCRLF.replace(/\r\n/g, '\n');
    assert.strictEqual(backToLF, textLF);
  });
});
