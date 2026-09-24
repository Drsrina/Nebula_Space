import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { useGitStore } from '../src/store/useGitStore';
import { INITIAL_GIT_REPOSITORIES } from '../src/lib/gitProviders';

describe('Git & Versionamento — Multi-Repositório & Remote Sync', () => {
  beforeEach(() => {
    useGitStore.setState({
      repositories: [...INITIAL_GIT_REPOSITORIES],
      activeRepoId: INITIAL_GIT_REPOSITORIES[0].id,
      activeRepo: INITIAL_GIT_REPOSITORIES[0],
      currentBranch: 'main',
    });
  });

  test('inicializa com repositórios padrão e permite alternar repositório ativo', () => {
    const { repositories, activeRepo } = useGitStore.getState();
    assert.ok(repositories.length >= 2);
    assert.equal(activeRepo?.name, 'nebula-workspace');

    // Alterna para o segundo repositório
    const targetRepo = repositories[1];
    useGitStore.getState().switchRepository(targetRepo.id);

    const updated = useGitStore.getState();
    assert.equal(updated.activeRepoId, targetRepo.id);
    assert.equal(updated.activeRepo?.name, targetRepo.name);
  });

  test('adiciona novo repositório local/remoto e define como ativo', () => {
    const newId = useGitStore.getState().addRepository({
      name: 'microservice-auth',
      path: '/workspace/auth',
      remoteUrl: 'https://github.com/empresa/auth.git',
      provider: 'github',
    });

    const state = useGitStore.getState();
    assert.equal(state.activeRepoId, newId);
    assert.equal(state.activeRepo?.name, 'microservice-auth');
    assert.equal(state.activeRepo?.remoteUrl, 'https://github.com/empresa/auth.git');
    assert.equal(state.activeRepo?.provider, 'github');
  });

  test('remove repositório mantendo pelo menos um', () => {
    const state = useGitStore.getState();
    const toRemoveId = state.repositories[1].id;

    const removed = useGitStore.getState().removeRepository(toRemoveId);
    assert.equal(removed, true);

    const updatedRepos = useGitStore.getState().repositories;
    assert.ok(!updatedRepos.some((r) => r.id === toRemoveId));

    // Não deve permitir deletar se restar apenas 1
    if (updatedRepos.length === 1) {
      const cantRemoveLast = useGitStore.getState().removeRepository(updatedRepos[0].id);
      assert.equal(cantRemoveLast, false);
    }
  });

  test('fetchRemote atualiza timestamp e zera erros de sincronização', async () => {
    const success = await useGitStore.getState().fetchRemote();
    assert.equal(success, true);

    const { syncStatus, activeRepo } = useGitStore.getState();
    assert.equal(syncStatus.isSyncing, false);
    assert.equal(syncStatus.error, null);
    assert.ok(activeRepo?.lastFetched && activeRepo.lastFetched > 0);
  });

  test('pullRemote zera contador behind e pushRemote zera contador ahead', async () => {
    // Simula estado com 2 commits behind e 1 commit ahead
    useGitStore.setState((s) => ({
      repositories: s.repositories.map((r) =>
        r.id === s.activeRepoId ? { ...r, ahead: 1, behind: 2 } : r
      ),
      activeRepo: { ...s.activeRepo!, ahead: 1, behind: 2 },
    }));

    const pullSuccess = await useGitStore.getState().pullRemote();
    assert.equal(pullSuccess, true);
    assert.equal(useGitStore.getState().activeRepo?.behind, 0);

    const pushSuccess = await useGitStore.getState().pushRemote();
    assert.equal(pushSuccess, true);
    assert.equal(useGitStore.getState().activeRepo?.ahead, 0);
  });
});
