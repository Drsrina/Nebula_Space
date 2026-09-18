import { FileSystemAdapter, FSNodeItem, FSAdapterRoot, FileContentResult } from './types';
import { readFileContent, writeFileContent } from '../fs';

export class LocalFSAdapter implements FileSystemAdapter {
  readonly type = 'local' as const;
  private rootHandle: FileSystemDirectoryHandle | null = null;
  private rootName = 'Pasta Local';

  constructor(rootHandle?: FileSystemDirectoryHandle, rootName = 'Pasta Local') {
    if (rootHandle) {
      this.rootHandle = rootHandle;
      this.rootName = rootName || rootHandle.name;
    }
  }

  public setRootHandle(handle: FileSystemDirectoryHandle, name?: string) {
    this.rootHandle = handle;
    this.rootName = name || handle.name;
  }

  public getRootHandle(): FileSystemDirectoryHandle | null {
    return this.rootHandle;
  }

  async isAvailable(): Promise<boolean> {
    return typeof window !== 'undefined' && 'showDirectoryPicker' in window;
  }

  async getRoots(): Promise<FSAdapterRoot[]> {
    if (!this.rootHandle) return [];
    return [{ name: this.rootName, path: '/' }];
  }

  // Helper to resolve directory handle from relative path
  private async resolveDirHandle(relPath: string): Promise<FileSystemDirectoryHandle> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = relPath.replace(/^\/+|\/+$/g, '');
    if (!cleaned || cleaned === '.' || cleaned === '') {
      return this.rootHandle;
    }

    const segments = cleaned.split('/');
    let curr = this.rootHandle;
    for (const seg of segments) {
      curr = await curr.getDirectoryHandle(seg, { create: false });
    }
    return curr;
  }

  async listDirectory(dirPath: string): Promise<FSNodeItem[]> {
    const dirHandle = await this.resolveDirHandle(dirPath);
    const items: FSNodeItem[] = [];

    // @ts-expect-error async iterator is standard for FileSystemDirectoryHandle
    for await (const entry of dirHandle.values()) {
      const isDir = entry.kind === 'directory';
      const cleanPath = dirPath.replace(/\/+$/, '');
      const itemPath = cleanPath === '' || cleanPath === '/' ? `/${entry.name}` : `${cleanPath}/${entry.name}`;
      let size = 0;
      let mtime = Date.now();

      if (!isDir) {
        try {
          const f = await (entry as FileSystemFileHandle).getFile();
          size = f.size;
          mtime = f.lastModified;
        } catch {
          // ignore
        }
      }

      const ext = !isDir && entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : undefined;

      items.push({
        name: entry.name,
        path: itemPath,
        isDir,
        size,
        mtime,
        ext,
      });
    }

    return items.sort((a, b) => {
      if (a.isDir && !b.isDir) return -1;
      if (!a.isDir && b.isDir) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
    });
  }

  async readFile(filePath: string): Promise<FileContentResult> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = filePath.replace(/^\/+/, '');
    const segments = cleaned.split('/');
    const fileName = segments.pop()!;

    let dirHandle = this.rootHandle;
    for (const seg of segments) {
      dirHandle = await dirHandle.getDirectoryHandle(seg, { create: false });
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: false });
    const res = await readFileContent(fileHandle);
    return {
      path: filePath,
      content: res.content,
      size: res.size,
      mtime: Date.now(),
      isBinary: res.isBinary,
    };
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = filePath.replace(/^\/+/, '');
    const segments = cleaned.split('/');
    const fileName = segments.pop()!;

    let dirHandle = this.rootHandle;
    for (const seg of segments) {
      dirHandle = await dirHandle.getDirectoryHandle(seg, { create: true });
    }

    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });
    return await writeFileContent(fileHandle, content);
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = dirPath.replace(/^\/+|\/+$/g, '');
    const segments = cleaned.split('/');
    let curr = this.rootHandle;
    for (const seg of segments) {
      curr = await curr.getDirectoryHandle(seg, { create: true });
    }
    return true;
  }

  async rename(fromPath: string, toPath: string): Promise<boolean> {
    // Standard File System Access API does not support native rename without polyfill/copy
    const { content } = await this.readFile(fromPath);
    await this.writeFile(toPath, content);
    await this.delete(fromPath);
    return true;
  }

  async delete(targetPath: string): Promise<boolean> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = targetPath.replace(/^\/+|\/+$/g, '');
    const segments = cleaned.split('/');
    const targetName = segments.pop()!;

    let dirHandle = this.rootHandle;
    for (const seg of segments) {
      dirHandle = await dirHandle.getDirectoryHandle(seg, { create: false });
    }

    await dirHandle.removeEntry(targetName, { recursive: true });
    return true;
  }

  async stat(targetPath: string): Promise<FSNodeItem> {
    if (!this.rootHandle) throw new Error('Nenhuma pasta local aberta.');
    const cleaned = targetPath.replace(/^\/+|\/+$/g, '');
    if (!cleaned) {
      return {
        name: this.rootName,
        path: '/',
        isDir: true,
        size: 0,
        mtime: Date.now(),
      };
    }

    const segments = cleaned.split('/');
    const targetName = segments.pop()!;
    let dirHandle = this.rootHandle;
    for (const seg of segments) {
      dirHandle = await dirHandle.getDirectoryHandle(seg, { create: false });
    }

    try {
      const fileHandle = await dirHandle.getFileHandle(targetName);
      const f = await fileHandle.getFile();
      return {
        name: targetName,
        path: targetPath,
        isDir: false,
        size: f.size,
        mtime: f.lastModified,
        ext: targetName.includes('.') ? targetName.split('.').pop()?.toLowerCase() : undefined,
      };
    } catch {
      await dirHandle.getDirectoryHandle(targetName);
      return {
        name: targetName,
        path: targetPath,
        isDir: true,
        size: 0,
        mtime: Date.now(),
      };
    }
  }

  async search(basePath: string, query: string): Promise<FSNodeItem[]> {
    const results: FSNodeItem[] = [];
    const lowerQuery = query.toLowerCase();

    const walk = async (currPath: string, depth: number) => {
      if (depth > 5 || results.length >= 150) return;
      try {
        const items = await this.listDirectory(currPath);
        for (const item of items) {
          if (item.name.toLowerCase().includes(lowerQuery)) {
            results.push(item);
          }
          if (item.isDir && !item.name.startsWith('.') && item.name !== 'node_modules') {
            await walk(item.path, depth + 1);
          }
        }
      } catch {
        // ignore
      }
    };

    await walk(basePath, 0);
    return results;
  }
}
