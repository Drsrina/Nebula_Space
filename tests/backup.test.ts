import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { NebulaBackupData, importWorkspaceBackup } from '../src/lib/workspaceBackup';

describe('Workspace Backup & Restore (.nebula.json)', () => {
  const sampleBackup: NebulaBackupData = {
    app: 'nebula-workspace',
    version: '2.7.6',
    exportedAt: new Date().toISOString(),
    workspace: {
      windows: [
        {
          id: 'win-editor-main',
          title: 'Editor: main.ts',
          type: 'editor',
          depth: 0,
          x: 100,
          y: 200,
          width: 700,
          height: 500,
          zIndex: 10,
        },
        {
          id: 'win-tree-main',
          title: 'Navegador de Arquivos',
          type: 'file-tree',
          depth: 1,
          x: -400,
          y: 200,
          width: 300,
          height: 500,
          zIndex: 5,
        },
      ],
      notes: [
        {
          id: 'note-1',
          title: 'Nota de Teste',
          content: '# Teste\nBackup e restore do workspace',
          createdAt: 1727180000000,
          updatedAt: 1727180000000,
        },
      ],
      editor: {
        tabs: [
          {
            filePath: 'main.ts',
            fileName: 'main.ts',
            content: 'console.log("hello nebula");',
            savedContent: 'console.log("hello nebula");',
            isDirty: false,
            language: 'typescript',
          },
        ],
        activeTabPath: 'main.ts',
      },
      canvas: {
        camera: { x: 0, y: 0, z: 0, zoom: 1.2, rotX: 0, rotY: 0 },
        activeLayer: 0,
      },
      settings: {
        snapEnabled: true,
        resMode: 'ultra',
      },
    },
  };

  it('rejeita arquivos com formato ou JSON corrompido', async () => {
    const invalidRes = await importWorkspaceBackup('{"corrompido": true}');
    assert.equal(invalidRes.success, false);
    assert.match(invalidRes.message, /inválido/i);

    const syntaxErrorRes = await importWorkspaceBackup('{ invalid json');
    assert.equal(syntaxErrorRes.success, false);
    assert.match(syntaxErrorRes.message, /Erro ao processar/i);
  });

  it('valida e restaura workspace completo a partir de JSON válido', async () => {
    const jsonStr = JSON.stringify(sampleBackup);
    const result = await importWorkspaceBackup(jsonStr);

    assert.equal(result.success, true);
    assert.equal(result.windowCount, 2);
    assert.equal(result.notesCount, 1);
    assert.match(result.message, /sucesso/i);
  });
});
