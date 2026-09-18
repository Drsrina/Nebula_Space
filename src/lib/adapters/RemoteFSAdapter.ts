import { FileSystemAdapter, FSNodeItem, FSAdapterRoot, FileContentResult, RemoteServerConfig } from './types';
import { getAuthToken } from '../api';

export class RemoteFSAdapter implements FileSystemAdapter {
  readonly type = 'remote' as const;
  private config: RemoteServerConfig;

  constructor(config: Partial<RemoteServerConfig> = {}) {
    this.config = {
      baseUrl: config.baseUrl ?? '',
      token: config.token ?? '',
      isReadOnly: config.isReadOnly ?? false,
    };
  }

  public updateConfig(newConfig: Partial<RemoteServerConfig>) {
    this.config = { ...this.config, ...newConfig };
  }

  public getConfig(): RemoteServerConfig {
    return { ...this.config };
  }

  private getHeaders(): Record<string, string> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    const effectiveToken = (this.config.token && this.config.token.trim()) || getAuthToken();
    if (effectiveToken && effectiveToken.trim()) {
      headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
    }
    return headers;
  }

  private getUrl(endpoint: string, params: Record<string, string> = {}): string {
    const base = this.config.baseUrl.replace(/\/+$/, '');
    const url = new URL(`${base}${endpoint}`, window.location.origin);
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null) {
        url.searchParams.set(key, val);
      }
    });
    return url.toString();
  }

  async isAvailable(): Promise<boolean> {
    try {
      const url = this.getUrl('/api/health');
      const res = await fetch(url, {
        method: 'GET',
        headers: this.getHeaders(),
      });
      if (!res.ok) return false;
      const data = await res.json();
      return data.status === 'ok';
    } catch {
      return false;
    }
  }

  async getRoots(): Promise<FSAdapterRoot[]> {
    const url = this.getUrl('/api/fs/roots');
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to fetch roots (${res.status})`);
    }

    const data = await res.json();
    return data.roots || [];
  }

  async listDirectory(dirPath: string): Promise<FSNodeItem[]> {
    const url = this.getUrl('/api/fs/list', { path: dirPath });
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to list directory (${res.status})`);
    }

    const data = await res.json();
    return data.items || [];
  }

  async readFile(filePath: string): Promise<FileContentResult> {
    const url = this.getUrl('/api/fs/read', { path: filePath });
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to read file (${res.status})`);
    }

    return await res.json();
  }

  async writeFile(filePath: string, content: string): Promise<boolean> {
    const url = this.getUrl('/api/fs/write');
    const res = await fetch(url, {
      method: 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify({ path: filePath, content }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to write file (${res.status})`);
    }

    return true;
  }

  async createDirectory(dirPath: string): Promise<boolean> {
    const url = this.getUrl('/api/fs/mkdir');
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ path: dirPath }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to create folder (${res.status})`);
    }

    return true;
  }

  async rename(fromPath: string, toPath: string): Promise<boolean> {
    const url = this.getUrl('/api/fs/rename');
    const res = await fetch(url, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify({ from: fromPath, to: toPath }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to rename (${res.status})`);
    }

    return true;
  }

  async delete(targetPath: string): Promise<boolean> {
    const url = this.getUrl('/api/fs/delete', { path: targetPath });
    const res = await fetch(url, {
      method: 'DELETE',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to delete (${res.status})`);
    }

    return true;
  }

  async stat(targetPath: string): Promise<FSNodeItem> {
    const url = this.getUrl('/api/fs/stat', { path: targetPath });
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Failed to stat (${res.status})`);
    }

    return await res.json();
  }

  async search(basePath: string, query: string): Promise<FSNodeItem[]> {
    const url = this.getUrl('/api/fs/search', { path: basePath, q: query });
    const res = await fetch(url, {
      method: 'GET',
      headers: this.getHeaders(),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: res.statusText }));
      throw new Error(err.error || `Search failed (${res.status})`);
    }

    const data = await res.json();
    return data.results || [];
  }
}
