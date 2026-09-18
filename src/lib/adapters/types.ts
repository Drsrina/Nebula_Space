export interface FSNodeItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number;
  atime?: number;
  mode?: string;
  ext?: string;
  isSymbolicLink?: boolean;
}

export interface FSAdapterRoot {
  name: string;
  path: string;
}

export interface FileContentResult {
  path: string;
  content: string;
  size: number;
  mtime: number;
  isBinary: boolean;
}

export interface FileSystemAdapter {
  readonly type: 'local' | 'remote';
  isAvailable(): Promise<boolean>;
  getRoots(): Promise<FSAdapterRoot[]>;
  listDirectory(dirPath: string): Promise<FSNodeItem[]>;
  readFile(filePath: string): Promise<FileContentResult>;
  writeFile(filePath: string, content: string): Promise<boolean>;
  createDirectory(dirPath: string): Promise<boolean>;
  rename(fromPath: string, toPath: string): Promise<boolean>;
  delete(targetPath: string): Promise<boolean>;
  stat(targetPath: string): Promise<FSNodeItem>;
  search(basePath: string, query: string): Promise<FSNodeItem[]>;
}

export interface RemoteServerConfig {
  baseUrl: string; // e.g. "" (relative for same host/container) or "http://my-vps:3001"
  token: string;
  isReadOnly?: boolean;
}
