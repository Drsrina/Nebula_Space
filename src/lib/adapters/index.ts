import { get, set } from 'idb-keyval';
import { FileSystemAdapter, RemoteServerConfig } from './types';
import { RemoteFSAdapter } from './RemoteFSAdapter';
import { LocalFSAdapter } from './LocalFSAdapter';

const IDB_KEY_CONFIG = 'nebula_fs_remote_config';
const IDB_KEY_FAVORITES = 'nebula_fs_favorites';
const IDB_KEY_MODE = 'nebula_fs_active_mode';

class AdapterManager {
  private remoteAdapter: RemoteFSAdapter;
  private localAdapter: LocalFSAdapter;
  private activeMode: 'local' | 'remote' = 'remote';
  private isInitialized = false;

  constructor() {
    this.remoteAdapter = new RemoteFSAdapter({
      baseUrl: '',
      token: '',
    });
    this.localAdapter = new LocalFSAdapter();
  }

  public async init(): Promise<{ mode: 'local' | 'remote'; isConnected: boolean }> {
    if (this.isInitialized) {
      return {
        mode: this.activeMode,
        isConnected: await this.remoteAdapter.isAvailable(),
      };
    }

    // 1. Load saved config from IndexedDB
    try {
      const savedConfig = await get<RemoteServerConfig>(IDB_KEY_CONFIG);
      if (savedConfig) {
        this.remoteAdapter.updateConfig(savedConfig);
      }
    } catch (e) {
      console.warn('Could not read saved remote config from IndexedDB:', e);
    }

    // 2. Check if remote backend is alive
    const remoteAvailable = await this.remoteAdapter.isAvailable();

    // 3. Check preferred mode or fallback
    try {
      const savedMode = await get<'local' | 'remote'>(IDB_KEY_MODE);
      if (savedMode && (savedMode === 'remote' ? remoteAvailable : true)) {
        this.activeMode = savedMode;
      } else {
        this.activeMode = remoteAvailable ? 'remote' : 'local';
      }
    } catch {
      this.activeMode = remoteAvailable ? 'remote' : 'local';
    }

    this.isInitialized = true;
    return {
      mode: this.activeMode,
      isConnected: remoteAvailable,
    };
  }

  public getAdapter(): FileSystemAdapter {
    return this.activeMode === 'remote' ? this.remoteAdapter : this.localAdapter;
  }

  public getRemoteAdapter(): RemoteFSAdapter {
    return this.remoteAdapter;
  }

  public getLocalAdapter(): LocalFSAdapter {
    return this.localAdapter;
  }

  public getMode(): 'local' | 'remote' {
    return this.activeMode;
  }

  public async setMode(mode: 'local' | 'remote'): Promise<void> {
    this.activeMode = mode;
    try {
      await set(IDB_KEY_MODE, mode);
    } catch (e) {
      console.warn('Failed to persist mode in IndexedDB:', e);
    }
  }

  public async updateRemoteConfig(config: Partial<RemoteServerConfig>): Promise<boolean> {
    this.remoteAdapter.updateConfig(config);
    try {
      const current = this.remoteAdapter.getConfig();
      await set(IDB_KEY_CONFIG, current);
    } catch (e) {
      console.warn('Failed to persist remote config in IndexedDB:', e);
    }
    return await this.remoteAdapter.isAvailable();
  }

  public async getFavorites(): Promise<string[]> {
    try {
      const favs = await get<string[]>(IDB_KEY_FAVORITES);
      return favs || [];
    } catch {
      return [];
    }
  }

  public async saveFavorites(favorites: string[]): Promise<void> {
    try {
      await set(IDB_KEY_FAVORITES, favorites);
    } catch (e) {
      console.warn('Failed to persist favorites in IndexedDB:', e);
    }
  }
}

export const adapterManager = new AdapterManager();
export * from './types';
export * from './RemoteFSAdapter';
export * from './LocalFSAdapter';
