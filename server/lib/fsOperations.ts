import fs from 'fs/promises';
import fsSync from 'fs';
import path from 'path';
import { FSItem, FSListResponse, FSReadResponse, FSSearchResponse } from '../types';

const MAX_READ_SIZE_BYTES = 10 * 1024 * 1024; // 10MB limit

const BINARY_EXTENSIONS = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'ico', 'bmp', 'tiff',
  'pdf', 'zip', 'tar', 'gz', 'bz2', '7z', 'rar',
  'exe', 'dll', 'so', 'dylib', 'bin',
  'mp4', 'mkv', 'avi', 'mov', 'webm', 'mp3', 'wav', 'ogg', 'flac',
  'woff', 'woff2', 'ttf', 'eot', 'otf',
  'iso', 'img', 'dmg'
]);

/**
 * Converts numeric file mode to human-readable permission string (e.g. -rw-r--r--)
 */
function formatPermissions(mode: number, isDir: boolean): string {
  const type = isDir ? 'd' : '-';
  const owner = (mode & 0o400 ? 'r' : '-') + (mode & 0o200 ? 'w' : '-') + (mode & 0o100 ? 'x' : '-');
  const group = (mode & 0o040 ? 'r' : '-') + (mode & 0o020 ? 'w' : '-') + (mode & 0o010 ? 'x' : '-');
  const others = (mode & 0o004 ? 'r' : '-') + (mode & 0o002 ? 'w' : '-') + (mode & 0o001 ? 'x' : '-');
  return `${type}${owner}${group}${others}`;
}

/**
 * Lists directory entries with metadata
 */
export async function listDirectory(dirPath: string): Promise<FSListResponse> {
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const items: FSItem[] = [];

  for (const entry of entries) {
    const itemPath = path.join(dirPath, entry.name);
    let size = 0;
    let mtime = Date.now();
    let atime = Date.now();
    let mode = '0644';
    const isDir = entry.isDirectory();
    const isSymbolicLink = entry.isSymbolicLink();

    try {
      const stats = await fs.stat(itemPath);
      size = stats.size;
      mtime = stats.mtimeMs;
      atime = stats.atimeMs;
      mode = formatPermissions(stats.mode, isDir);
    } catch {
      // If stat fails (e.g. broken symlink or permission)
    }

    const ext = !isDir && entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : undefined;

    items.push({
      name: entry.name,
      path: itemPath,
      isDir,
      size,
      mtime,
      atime,
      mode,
      ext,
      isSymbolicLink,
    });
  }

  // Sort: directories first, then alphabetical (case-insensitive)
  items.sort((a, b) => {
    if (a.isDir && !b.isDir) return -1;
    if (!a.isDir && b.isDir) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' });
  });

  return {
    path: dirPath,
    items,
    total: items.length,
  };
}

/**
 * Reads file content with 10MB safety threshold
 */
export async function readFile(filePath: string): Promise<FSReadResponse> {
  const stats = await fs.stat(filePath);

  if (stats.isDirectory()) {
    throw new Error(`Cannot read directory "${filePath}" as file content.`);
  }

  if (stats.size > MAX_READ_SIZE_BYTES) {
    const mb = (stats.size / (1024 * 1024)).toFixed(2);
    const err = new Error(`File size (${mb} MB) exceeds maximum allowed size of 10 MB.`);
    (err as any).statusCode = 413;
    throw err;
  }

  const ext = filePath.split('.').pop()?.toLowerCase() || '';
  const isBinary = BINARY_EXTENSIONS.has(ext);

  if (isBinary) {
    return {
      path: filePath,
      content: `[Arquivo binário / mídia (${ext.toUpperCase()}) - ${stats.size} bytes]`,
      size: stats.size,
      mtime: stats.mtimeMs,
      isBinary: true,
    };
  }

  try {
    const content = await fs.readFile(filePath, 'utf8');
    return {
      path: filePath,
      content,
      size: stats.size,
      mtime: stats.mtimeMs,
      isBinary: false,
    };
  } catch (err: any) {
    // If UTF-8 read fails, treat as binary
    return {
      path: filePath,
      content: `[Não foi possível decodificar como texto UTF-8 - ${stats.size} bytes]`,
      size: stats.size,
      mtime: stats.mtimeMs,
      isBinary: true,
    };
  }
}

/**
 * Writes text content to file
 */
export async function writeFile(filePath: string, content: string): Promise<{ success: boolean; bytesWritten: number }> {
  // Ensure directory exists
  const parentDir = path.dirname(filePath);
  await fs.mkdir(parentDir, { recursive: true });

  await fs.writeFile(filePath, content, 'utf8');
  const stats = await fs.stat(filePath);

  return {
    success: true,
    bytesWritten: stats.size,
  };
}

/**
 * Creates a directory recursively
 */
export async function createDirectory(dirPath: string): Promise<{ success: boolean }> {
  await fs.mkdir(dirPath, { recursive: true });
  return { success: true };
}

/**
 * Renames / moves a file or directory
 */
export async function renamePath(fromPath: string, toPath: string): Promise<{ success: boolean }> {
  const targetParent = path.dirname(toPath);
  await fs.mkdir(targetParent, { recursive: true });
  await fs.rename(fromPath, toPath);
  return { success: true };
}

/**
 * Deletes a file or directory
 */
export async function deletePath(targetPath: string): Promise<{ success: boolean }> {
  const stats = await fs.stat(targetPath);
  if (stats.isDirectory()) {
    await fs.rm(targetPath, { recursive: true, force: true });
  } else {
    await fs.unlink(targetPath);
  }
  return { success: true };
}

/**
 * Gets stats for a path
 */
export async function statPath(targetPath: string): Promise<FSItem> {
  const stats = await fs.stat(targetPath);
  const isDir = stats.isDirectory();
  const name = path.basename(targetPath) || targetPath;
  const ext = !isDir && name.includes('.') ? name.split('.').pop()?.toLowerCase() : undefined;

  return {
    name,
    path: targetPath,
    isDir,
    size: stats.size,
    mtime: stats.mtimeMs,
    atime: stats.atimeMs,
    mode: formatPermissions(stats.mode, isDir),
    ext,
    isSymbolicLink: stats.isSymbolicLink(),
  };
}

/**
 * Recursively searches for files/directories matching a query
 */
const IGNORED_SEARCH_DIRS = new Set(['node_modules', '.git', '.next', '.cache', 'dist', 'build']);

export async function searchFiles(
  basePath: string,
  query: string,
  maxResults = 200
): Promise<FSSearchResponse> {
  const results: FSItem[] = [];
  const lowerQuery = query.toLowerCase();

  async function walk(currentDir: string, currentDepth: number) {
    if (results.length >= maxResults || currentDepth > 8) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (results.length >= maxResults) break;

      const itemPath = path.join(currentDir, entry.name);
      const isDir = entry.isDirectory();

      if (entry.name.toLowerCase().includes(lowerQuery)) {
        let size = 0;
        let mtime = Date.now();
        try {
          const s = await fs.stat(itemPath);
          size = s.size;
          mtime = s.mtimeMs;
        } catch {
          // ignore
        }

        results.push({
          name: entry.name,
          path: itemPath,
          isDir,
          size,
          mtime,
          ext: !isDir && entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : undefined,
        });
      }

      if (isDir && !IGNORED_SEARCH_DIRS.has(entry.name)) {
        await walk(itemPath, currentDepth + 1);
      }
    }
  }

  await walk(basePath, 0);

  return {
    basePath,
    query,
    results,
    total: results.length,
  };
}

export interface GrepMatch {
  filePath: string;
  fileName: string;
  line: number;
  lineContent: string;
}

export interface GrepResponse {
  basePath: string;
  query: string;
  matches: GrepMatch[];
  totalFiles: number;
  totalMatches: number;
}

const TEXT_FILE_EXTENSIONS = new Set([
  'ts', 'tsx', 'js', 'jsx', 'json', 'css', 'scss', 'html', 'md', 'txt',
  'py', 'rs', 'go', 'sh', 'yaml', 'yml', 'sql', 'xml', 'svg', 'toml', 'env',
]);

/**
 * Searches for text content across all text files in workspace
 */
export async function grepFiles(
  basePath: string,
  query: string,
  maxMatches = 300
): Promise<GrepResponse> {
  const matches: GrepMatch[] = [];
  const matchedFiles = new Set<string>();
  const lowerQuery = query.toLowerCase();

  async function walk(currentDir: string, depth: number) {
    if (matches.length >= maxMatches || depth > 8) return;

    let entries;
    try {
      entries = await fs.readdir(currentDir, { withFileTypes: true });
    } catch {
      return;
    }

    for (const entry of entries) {
      if (matches.length >= maxMatches) break;

      const itemPath = path.join(currentDir, entry.name);
      if (entry.isDirectory()) {
        if (!IGNORED_SEARCH_DIRS.has(entry.name)) {
          await walk(itemPath, depth + 1);
        }
      } else {
        const ext = entry.name.includes('.') ? entry.name.split('.').pop()?.toLowerCase() : '';
        if (ext && !TEXT_FILE_EXTENSIONS.has(ext)) {
          continue; // skip binary / unsupported files
        }

        try {
          const stats = await fs.stat(itemPath);
          if (stats.size > 2 * 1024 * 1024) continue; // skip files > 2MB

          const content = await fs.readFile(itemPath, 'utf8');
          if (!content.toLowerCase().includes(lowerQuery)) continue;

          const lines = content.split('\n');
          for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
            if (matches.length >= maxMatches) break;
            const lineText = lines[lineIdx];
            if (lineText.toLowerCase().includes(lowerQuery)) {
              matchedFiles.add(itemPath);
              matches.push({
                filePath: itemPath,
                fileName: entry.name,
                line: lineIdx + 1,
                lineContent: lineText.trim().slice(0, 200),
              });
            }
          }
        } catch {
          // ignore unreadable files
        }
      }
    }
  }

  await walk(basePath, 0);

  return {
    basePath,
    query,
    matches,
    totalFiles: matchedFiles.size,
    totalMatches: matches.length,
  };
}

