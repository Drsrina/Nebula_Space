import { get, set } from 'idb-keyval';
import {
  GitProviderAccount,
  GitProviderType,
  GitRepository,
  ForgejoRepo,
} from '../types';

const IDB_GIT_PROVIDERS_KEY = 'nebula-git-providers-v2';
const IDB_GIT_REPOS_KEY = 'nebula-git-repos-v2';

export const DEFAULT_GIT_PROVIDERS: Record<GitProviderType, GitProviderAccount> = {
  github: {
    provider: 'github',
    instanceUrl: 'https://api.github.com',
    username: '',
    token: '',
    connected: false,
  },
  gitlab: {
    provider: 'gitlab',
    instanceUrl: 'https://gitlab.com',
    username: '',
    token: '',
    connected: false,
  },
  forgejo: {
    provider: 'forgejo',
    instanceUrl: 'https://codeberg.org',
    username: '',
    token: '',
    connected: false,
  },
};

export const INITIAL_GIT_REPOSITORIES: GitRepository[] = [
  {
    id: 'repo-main',
    name: 'nebula-workspace',
    path: '/workspace',
    remoteUrl: 'https://github.com/Drsrina/Nebula_git.git',
    provider: 'github',
    currentBranch: 'main',
    ahead: 0,
    behind: 0,
    lastFetched: Date.now() - 1000 * 60 * 15,
  },
  {
    id: 'repo-plugins',
    name: 'nebula-community-plugins',
    path: '/workspace/plugins',
    remoteUrl: 'https://codeberg.org/nebula/plugins.git',
    provider: 'forgejo',
    currentBranch: 'main',
    ahead: 1,
    behind: 0,
    lastFetched: Date.now() - 1000 * 60 * 60,
  },
];

export async function loadGitProviders(): Promise<Record<GitProviderType, GitProviderAccount>> {
  if (typeof indexedDB === 'undefined') return { ...DEFAULT_GIT_PROVIDERS };
  try {
    const saved = await get<Record<GitProviderType, GitProviderAccount>>(IDB_GIT_PROVIDERS_KEY);
    if (saved && typeof saved === 'object') {
      return {
        github: { ...DEFAULT_GIT_PROVIDERS.github, ...(saved.github || {}) },
        gitlab: { ...DEFAULT_GIT_PROVIDERS.gitlab, ...(saved.gitlab || {}) },
        forgejo: { ...DEFAULT_GIT_PROVIDERS.forgejo, ...(saved.forgejo || {}) },
      };
    }
  } catch (err) {
    console.warn('Could not load Git providers from IndexedDB:', err);
  }
  return { ...DEFAULT_GIT_PROVIDERS };
}

export async function saveGitProviders(providers: Record<GitProviderType, GitProviderAccount>): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await set(IDB_GIT_PROVIDERS_KEY, providers);
  } catch (err) {
    console.error('Could not save Git providers to IndexedDB:', err);
  }
}

export async function loadGitRepositories(): Promise<GitRepository[]> {
  if (typeof indexedDB === 'undefined') return [...INITIAL_GIT_REPOSITORIES];
  try {
    const saved = await get<GitRepository[]>(IDB_GIT_REPOS_KEY);
    if (saved && Array.isArray(saved) && saved.length > 0) {
      return saved;
    }
  } catch (err) {
    console.warn('Could not load Git repositories from IndexedDB:', err);
  }
  return [...INITIAL_GIT_REPOSITORIES];
}

export async function saveGitRepositories(repos: GitRepository[]): Promise<void> {
  if (typeof indexedDB === 'undefined') return;
  try {
    await set(IDB_GIT_REPOS_KEY, repos);
  } catch (err) {
    console.error('Could not save Git repositories to IndexedDB:', err);
  }
}

/**
 * Test credentials and connection against GitHub, GitLab, or Forgejo
 */
export async function testProviderAuth(account: GitProviderAccount): Promise<{ ok: boolean; username: string; message: string }> {
  if (!account.token.trim()) {
    return { ok: false, username: '', message: 'Personal Access Token (PAT) é obrigatório.' };
  }

  const token = account.token.trim();
  const rawUrl = (account.instanceUrl || '').replace(/\/+$/, '');

  try {
    if (account.provider === 'github') {
      const res = await fetch('https://api.github.com/user', {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          Authorization: `Bearer ${token}`,
        },
      });
      if (!res.ok) {
        return { ok: false, username: '', message: `GitHub rejeitou token (${res.status} ${res.statusText})` };
      }
      const data = await res.json();
      return { ok: true, username: data.login || account.username, message: `Conectado como ${data.login}!` };
    }

    if (account.provider === 'gitlab') {
      const base = rawUrl || 'https://gitlab.com';
      const res = await fetch(`${base}/api/v4/user`, {
        headers: {
          'PRIVATE-TOKEN': token,
        },
      });
      if (!res.ok) {
        return { ok: false, username: '', message: `GitLab rejeitou token (${res.status} ${res.statusText})` };
      }
      const data = await res.json();
      return { ok: true, username: data.username || account.username, message: `Conectado como ${data.username}!` };
    }

    if (account.provider === 'forgejo') {
      const base = rawUrl || 'https://codeberg.org';
      const res = await fetch(`${base}/api/v1/user`, {
        headers: {
          Accept: 'application/json',
          Authorization: `token ${token}`,
        },
      });
      if (!res.ok) {
        return { ok: false, username: '', message: `Forgejo/Gitea rejeitou token (${res.status} ${res.statusText})` };
      }
      const data = await res.json();
      return { ok: true, username: data.login || account.username, message: `Conectado como ${data.login}!` };
    }

    return { ok: false, username: '', message: 'Provedor desconhecido' };
  } catch (err: any) {
    return { ok: false, username: '', message: `Erro de rede: ${err.message || 'Falha na conexão'}` };
  }
}

/**
 * Fetch remote repositories from provider
 */
export async function fetchRemoteProviderRepos(account: GitProviderAccount): Promise<ForgejoRepo[]> {
  if (!account.token.trim()) return [];

  const token = account.token.trim();
  const rawUrl = (account.instanceUrl || '').replace(/\/+$/, '');

  if (account.provider === 'github') {
    const res = await fetch('https://api.github.com/user/repos?per_page=30&sort=updated', {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        Authorization: `Bearer ${token}`,
      },
    });
    if (!res.ok) throw new Error(`Falha ao buscar repositórios GitHub (${res.status})`);
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.full_name,
      description: r.description || '',
      private: Boolean(r.private),
      html_url: r.html_url,
      clone_url: r.clone_url,
      stars_count: r.stargazers_count || 0,
      forks_count: r.forks_count || 0,
      open_issues_count: r.open_issues_count || 0,
      default_branch: r.default_branch || 'main',
      owner: {
        login: r.owner?.login || '',
        avatar_url: r.owner?.avatar_url || '',
      },
    }));
  }

  if (account.provider === 'gitlab') {
    const base = rawUrl || 'https://gitlab.com';
    const res = await fetch(`${base}/api/v4/projects?membership=true&per_page=30&order_by=updated_at`, {
      headers: {
        'PRIVATE-TOKEN': token,
      },
    });
    if (!res.ok) throw new Error(`Falha ao buscar repositórios GitLab (${res.status})`);
    const data = await res.json();
    return data.map((r: any) => ({
      id: r.id,
      name: r.name,
      full_name: r.path_with_namespace,
      description: r.description || '',
      private: r.visibility === 'private',
      html_url: r.web_url,
      clone_url: r.http_url_to_repo,
      stars_count: r.star_count || 0,
      forks_count: r.forks_count || 0,
      open_issues_count: r.open_issues_count || 0,
      default_branch: r.default_branch || 'main',
      owner: {
        login: r.namespace?.name || '',
        avatar_url: r.avatar_url || '',
      },
    }));
  }

  if (account.provider === 'forgejo') {
    const base = rawUrl || 'https://codeberg.org';
    const res = await fetch(`${base}/api/v1/user/repos?limit=30&sort=updated`, {
      headers: {
        Accept: 'application/json',
        Authorization: `token ${token}`,
      },
    });
    if (!res.ok) throw new Error(`Falha ao buscar repositórios Forgejo (${res.status})`);
    return await res.json();
  }

  return [];
}
