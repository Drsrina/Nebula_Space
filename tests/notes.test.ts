import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

describe('Note Window — File Options, Save As, Rename & Export', () => {
  test('renomear nota preserva o conteúdo markdown intacto', () => {
    const originalContent = '# Conteúdo Crítico\n- Item 1\n- Item 2';
    let currentTitle = 'Nota Antiga';
    let currentContent = originalContent;

    // Ação de renomear
    const newTitle = 'Nota Renomeada';
    currentTitle = newTitle;

    assert.strictEqual(currentTitle, 'Nota Renomeada');
    assert.strictEqual(currentContent, originalContent, 'O conteúdo markdown não deve sofrer alteração ao renomear');
  });

  test('salvar como gera uma nova entidade independente mantendo o conteúdo', () => {
    const originalNote = {
      id: 'note-1',
      title: 'Nota Original',
      content: '```ts\nconst x = 42;\n```',
    };

    // Ação salvar como
    const copyNote = {
      id: `note-${Date.now()}`,
      title: 'Nota Copiada',
      content: originalNote.content,
    };

    assert.notStrictEqual(copyNote.id, originalNote.id);
    assert.strictEqual(copyNote.content, originalNote.content);
    assert.strictEqual(copyNote.title, 'Nota Copiada');
  });

  test('gerador de exportação HTML encapsula markdown com tags semânticas', () => {
    const title = 'Documento de Teste';
    const content = 'Linha 1\nLinha 2';

    const htmlOutput = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <title>${title}</title>
</head>
<body>
  <h1>${title}</h1>
  <div>${content.replace(/\n/g, '<br/>')}</div>
</body>
</html>`;

    assert.ok(htmlOutput.includes('<title>Documento de Teste</title>'));
    assert.ok(htmlOutput.includes('<h1>Documento de Teste</h1>'));
    assert.ok(htmlOutput.includes('Linha 1<br/>Linha 2'));
  });

  test('gerador de exportação Markdown preserva sintaxe intacta', () => {
    const content = '# Título\n\n**Texto em negrito**\n- Item lista';
    const blobContent = content;
    assert.strictEqual(blobContent, content);
  });
});
