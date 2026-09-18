export interface FSItem {
  name: string;
  path: string;
  isDir: boolean;
  size: number;
  mtime: number; // timestamp in milliseconds
  atime?: number;
  mode?: string; // e.g. "0755" or "drwxr-xr-x"
  ext?: string;
  isSymbolicLink?: boolean;
}

export interface FSRoot {
  name: string;
  path: string;
}

export interface FSListResponse {
  path: string;
  items: FSItem[];
  total: number;
}

export interface FSReadResponse {
  path: string;
  content: string;
  size: number;
  mtime: number;
  isBinary: boolean;
}

export interface FSSearchResponse {
  basePath: string;
  query: string;
  results: FSItem[];
  total: number;
}
