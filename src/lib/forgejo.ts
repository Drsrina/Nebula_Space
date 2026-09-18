import { get, set } from 'idb-keyval';
import { ForgejoConfig, ForgejoIssue, ForgejoRepo } from '../types';

const IDB_FORGEJO_CONFIG_KEY = 'nebula-forgejo-config-v1';

export const DEFAULT_FORGEJO_CONFIG: ForgejoConfig = {
  instanceUrl: 'https://codeberg.org',
  username: '',
  token: '',
  selectedRepo: '',
};

export async function loadForgejoConfig(): Promise<ForgejoConfig> {
  try {
    const saved = await get<ForgejoConfig>(IDB_FORGEJO_CONFIG_KEY);
    if (saved && typeof saved === 'object') {
      return {
        ...DEFAULT_FORGEJO_CONFIG,
        ...saved,
      };
    }
  } catch (err) {
    console.warn('Could not load Forgejo config from IndexedDB:', err);
  }
  return { ...DEFAULT_FORGEJO_CONFIG };
}

export async function saveForgejoConfig(config: ForgejoConfig): Promise<void> {
  try {
    await set(IDB_FORGEJO_CONFIG_KEY, config);
  } catch (err) {
    console.error('Could not save Forgejo config to IndexedDB:', err);
  }
}

/**
 * Fetch user repositories from Forgejo / Gitea API
 */
export async function fetchForgejoUserRepos(config: ForgejoConfig): Promise<ForgejoRepo[]> {
  if (!config.instanceUrl || !config.token) {
    throw new Error('Configure a URL da instância e o Token de Acesso.');
  }

  const cleanUrl = config.instanceUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/api/v1/user/repos?limit=50&sort=updated`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `token ${config.token.trim()}`,
    },
  });

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      throw new Error('Token inválido ou sem permissão de leitura.');
    }
    throw new Error(`Erro na API Forgejo (${res.status}): ${res.statusText}`);
  }

  const repos: ForgejoRepo[] = await res.json();
  return repos;
}

/**
 * Fetch issues and PRs for a specific repo from Forgejo / Gitea
 */
export async function fetchForgejoRepoIssues(
  config: ForgejoConfig,
  owner: string,
  repoName: string
): Promise<ForgejoIssue[]> {
  if (!config.instanceUrl || !config.token) {
    return [];
  }

  const cleanUrl = config.instanceUrl.replace(/\/+$/, '');
  const endpoint = `${cleanUrl}/api/v1/repos/${encodeURIComponent(owner)}/${encodeURIComponent(repoName)}/issues?state=all&limit=30`;

  const res = await fetch(endpoint, {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `token ${config.token.trim()}`,
    },
  });

  if (!res.ok) {
    throw new Error(`Falha ao carregar issues (${res.status})`);
  }

  return await res.json();
}
