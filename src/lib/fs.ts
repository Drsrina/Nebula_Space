import { FSFileNode } from '../types';

export const isFSSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

const IGNORED_DIRECTORIES = new Set([
  'node_modules',
  '.git',
  '.next',
  '.vite',
  'dist',
  'build',
  '.turbo',
  '.cache',
  'coverage',
]);

/**
 * Reads a local directory recursively using File System Access API
 */
export async function readDirectoryRecursive(
  dirHandle: FileSystemDirectoryHandle,
  currentPath = '',
  currentDepth = 0,
  maxDepth = 4
): Promise<FSFileNode[]> {
  const nodes: FSFileNode[] = [];

  try {
    // @ts-expect-error async iterator is supported in modern browsers for directory handle
    for await (const entry of dirHandle.values()) {
      const entryPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;

      if (entry.kind === 'directory') {
        const isIgnored = IGNORED_DIRECTORIES.has(entry.name) || entry.name.startsWith('.');
        let children: FSFileNode[] = [];

        if (!isIgnored && currentDepth < maxDepth) {
          try {
            children = await readDirectoryRecursive(
              entry as FileSystemDirectoryHandle,
              entryPath,
              currentDepth + 1,
              maxDepth
            );
          } catch (e) {
            console.warn(`Could not read dir ${entryPath}:`, e);
          }
        }

        nodes.push({
          id: `dir-${entryPath}`,
          name: entry.name,
          kind: 'directory',
          path: entryPath,
          handle: entry as FileSystemDirectoryHandle,
          children,
        });
      } else if (entry.kind === 'file') {
        const ext = entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : '';
        let size = 0;
        let lastModified = Date.now();

        try {
          const file = await (entry as FileSystemFileHandle).getFile();
          size = file.size;
          lastModified = file.lastModified;
        } catch {
          // In some cases reading metadata right away can fail
        }

        nodes.push({
          id: `file-${entryPath}`,
          name: entry.name,
          kind: 'file',
          path: entryPath,
          handle: entry as FileSystemFileHandle,
          extension: ext,
          size,
          lastModified,
        });
      }
    }
  } catch (err) {
    console.error('Error iterating directory entries:', err);
  }

  // Sort: directories first, then alphabetical
  return nodes.sort((a, b) => {
    if (a.kind === b.kind) {
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    }
    return a.kind === 'directory' ? -1 : 1;
  });
}

/**
 * Reads file content as text
 */
export async function readFileContent(
  fileHandle: FileSystemFileHandle
): Promise<{ content: string; isBinary: boolean; size: number }> {
  const file = await fileHandle.getFile();
  const size = file.size;

  // If file is very large (> 2MB), handle preview gracefully
  if (size > 2 * 1024 * 1024) {
    return {
      content: `[Arquivo muito grande para preview: ${(size / (1024 * 1024)).toFixed(2)} MB]`,
      isBinary: true,
      size,
    };
  }

  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const binaryExtensions = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'pdf', 'zip', 'tar', 'gz', 'exe', 'bin', 'mp4', 'mp3', 'wav', 'woff', 'woff2', 'ttf'];

  if (binaryExtensions.includes(ext)) {
    return {
      content: `[Arquivo binário/mídia (${ext.toUpperCase()}) - ${formatBytes(size)}]`,
      isBinary: true,
      size,
    };
  }

  try {
    const text = await file.text();
    return {
      content: text,
      isBinary: false,
      size,
    };
  } catch (err) {
    console.warn('Failed to read file as text:', err);
    return {
      content: '[Não foi possível ler o arquivo como texto codificado em UTF-8]',
      isBinary: true,
      size,
    };
  }
}

/**
 * Formats file size in bytes to human readable format
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Counts total files in a node tree
 */
export function countFiles(nodes: FSFileNode[]): number {
  let count = 0;
  for (const node of nodes) {
    if (node.kind === 'file') {
      count += 1;
    } else if (node.children) {
      count += countFiles(node.children);
    }
  }
  return count;
}

/**
 * Writes text content to a local FileSystemFileHandle
 */
export async function writeFileContent(
  fileHandle: FileSystemFileHandle,
  content: string
): Promise<boolean> {
  try {
    const writable = await (fileHandle as any).createWritable();
    await writable.write(content);
    await writable.close();
    return true;
  } catch (err) {
    console.error('Error writing file:', err);
    return false;
  }
}

/**
 * Resolves a FileSystemFileHandle from a relative path inside a directory handle
 */
export async function getFileHandleFromPath(
  rootDir: FileSystemDirectoryHandle,
  path: string,
  create = false
): Promise<FileSystemFileHandle | null> {
  try {
    const cleanPath = path.startsWith('/') ? path.slice(1) : path;
    const parts = cleanPath.split('/').filter(Boolean);
    let currentDir = rootDir;
    for (let i = 0; i < parts.length - 1; i++) {
      currentDir = await currentDir.getDirectoryHandle(parts[i], { create });
    }
    const fileName = parts[parts.length - 1];
    return await currentDir.getFileHandle(fileName, { create });
  } catch (err) {
    console.warn(`Could not get handle for ${path}:`, err);
    return null;
  }
}

/**
 * Rich mock file tree for unsupported browsers or initial playground
 */
export const MOCK_PROJECT_TREE: FSFileNode[] = [
  {
    id: 'mock-readme',
    name: 'README.md',
    kind: 'file',
    path: 'README.md',
    extension: 'md',
    size: 2480,
    lastModified: Date.now() - 1000 * 60 * 30,
  },
  {
    id: 'mock-package-json',
    name: 'package.json',
    kind: 'file',
    path: 'package.json',
    extension: 'json',
    size: 1120,
    lastModified: Date.now() - 1000 * 60 * 120,
  },
  {
    id: 'mock-src',
    name: 'src',
    kind: 'directory',
    path: 'src',
    children: [
      {
        id: 'mock-app-tsx',
        name: 'App.tsx',
        kind: 'file',
        path: 'src/App.tsx',
        extension: 'tsx',
        size: 3410,
        lastModified: Date.now() - 1000 * 60 * 15,
      },
      {
        id: 'mock-main-tsx',
        name: 'main.tsx',
        kind: 'file',
        path: 'src/main.tsx',
        extension: 'tsx',
        size: 680,
        lastModified: Date.now() - 1000 * 60 * 60,
      },
      {
        id: 'mock-components',
        name: 'components',
        kind: 'directory',
        path: 'src/components',
        children: [
          {
            id: 'mock-canvas-3d',
            name: 'Canvas3D.tsx',
            kind: 'file',
            path: 'src/components/Canvas3D.tsx',
            extension: 'tsx',
            size: 4890,
            lastModified: Date.now() - 1000 * 60 * 5,
          },
          {
            id: 'mock-window',
            name: 'Window.tsx',
            kind: 'file',
            path: 'src/components/Window.tsx',
            extension: 'tsx',
            size: 5210,
            lastModified: Date.now() - 1000 * 60 * 10,
          },
          {
            id: 'mock-depth-grid',
            name: 'DepthGrid.tsx',
            kind: 'file',
            path: 'src/components/DepthGrid.tsx',
            extension: 'tsx',
            size: 2190,
            lastModified: Date.now() - 1000 * 60 * 45,
          },
        ],
      },
      {
        id: 'mock-lib',
        name: 'lib',
        kind: 'directory',
        path: 'src/lib',
        children: [
          {
            id: 'mock-depth-ts',
            name: 'depth.ts',
            kind: 'file',
            path: 'src/lib/depth.ts',
            extension: 'ts',
            size: 1980,
            lastModified: Date.now() - 1000 * 60 * 20,
          },
          {
            id: 'mock-fs-ts',
            name: 'fs.ts',
            kind: 'file',
            path: 'src/lib/fs.ts',
            extension: 'ts',
            size: 3200,
            lastModified: Date.now() - 1000 * 60 * 35,
          },
        ],
      },
    ],
  },
  {
    id: 'mock-docs',
    name: 'docs',
    kind: 'directory',
    path: 'docs',
    children: [
      {
        id: 'mock-architecture',
        name: 'architecture-3d.md',
        kind: 'file',
        path: 'docs/architecture-3d.md',
        extension: 'md',
        size: 1820,
        lastModified: Date.now() - 1000 * 60 * 180,
      },
      {
        id: 'mock-roadmap',
        name: 'roadmap.md',
        kind: 'file',
        path: 'docs/roadmap.md',
        extension: 'md',
        size: 950,
        lastModified: Date.now() - 1000 * 60 * 240,
      },
    ],
  },
  {
    id: 'mock-notes',
    name: 'notes',
    kind: 'directory',
    path: 'notes',
    children: [
      {
        id: 'mock-cognitive-planes',
        name: 'planos-cognitivos.md',
        kind: 'file',
        path: 'notes/planos-cognitivos.md',
        extension: 'md',
        size: 1420,
        lastModified: Date.now() - 1000 * 60 * 50,
      },
    ],
  },
];

/**
 * Mock file contents for immediate exploration
 */
export const MOCK_FILE_CONTENTS: Record<string, string> = {
  'README.md': `# Nebula 🌌
### Workspace Espacial em 3D para Arquivos Locais & Notas

Nebula revoluciona a forma como você trabalha com código e documentos locais:
em vez de dezenas de abas amontoadas, cada arquivo ganha um lugar no espaço 3D,
organizado em **3 Degraus de Profundidade Cognitiva**:

- **Degrau 0 (Z = 0px)**: Foco total. Janela ativa, preview e notas em edição.
- **Degrau 1 (Z = -400px)**: Contexto. Árvore de navegação e referências imediatas.
- **Degrau 2 (Z = -800px)**: Arquivo & Estacionamento. Notas de longo prazo e especificações.

### Self-Hosting
- 100% Client-Side.
- Sem telemetria, sem servidores externos, sem dependências de nuvem.
- Navegue arquivos do seu computador com a File System Access API nativa.
`,
  'package.json': `{
  "name": "nebula-workspace",
  "version": "1.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "zustand": "^5.0.0",
    "motion": "^12.0.0",
    "idb-keyval": "^6.2.1",
    "highlight.js": "^11.9.0",
    "lucide-react": "^0.470.0"
  }
}
`,
  'src/App.tsx': `import React from 'react';
import { Canvas3D } from './components/Canvas3D';
import { TopBar } from './components/TopBar';
import { CameraController } from './components/CameraController';

export default function App() {
  return (
    <div className="relative w-screen h-screen overflow-hidden bg-[#050810]">
      <TopBar />
      <Canvas3D />
      <CameraController />
    </div>
  );
}
`,
  'docs/architecture-3d.md': `# Arquitetura 3D do Nebula

## Por que CSS 3D nativo e não WebGL/Three.js?
O Nebula renderiza interfaces ricas dentro de cada janela flutuante:
- Árvores de diretórios com scroll nativo e seleção
- Texto com syntax highlighting copiável
- Textareas e editores markdown fluidos

O CSS 3D com \`perspective: 1600px\`, \`transform-style: preserve-3d\` e
\`translate3d(x, y, z)\` permite aproveitar a GPU para a câmera espacial enquanto
mantém o DOM 100% nativo e acessível.

## Princípio dos 3 Degraus
A mente humana trabalha melhor com profundidade espacial:
1. **Foco (Z=0)**: Contraste máximo, blur zero, neon nítido.
2. **Contexto (Z=-400)**: Suavemente recuado, mantém a visão periférica sem poluir.
3. **Arquivo (Z=-800)**: Memória de trabalho estendida.
`,
  'notes/planos-cognitivos.md': `# Ideias de Ergonomia Cognitiva

- [x] Transição suave de 300ms entre degraus
- [x] Snap magnético ao soltar a janela
- [x] Modo foco que oculta temporariamente Z=-400 e Z=-800
- [x] Paralaxe do grid estelar entre planos
`,
};
