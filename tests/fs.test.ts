import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { validateAndResolvePath, getAllowedRoots } from '../server/lib/security';

describe('Filesystem Routes & Security — Root Boundaries & Path Traversal', () => {
  it('identifica corretamente as raízes permitidas ou fallback', () => {
    const roots = getAllowedRoots();
    assert.ok(Array.isArray(roots), 'Deve retornar array de raízes');
    assert.ok(roots.length > 0, 'Deve ter pelo menos uma raiz configurada ou fallback');
    assert.ok(roots[0].path, 'Raiz deve conter campo path');
  });

  it('permite acesso a caminhos estritamente dentro da raiz permitida', () => {
    const roots = getAllowedRoots();
    const primaryRoot = roots[0].path;
    const checkRoot = validateAndResolvePath(primaryRoot);
    assert.equal(checkRoot.valid, true, 'Deve validar a raiz permitida');

    const subPath = primaryRoot + '/test-subpath';
    const checkSub = validateAndResolvePath(subPath);
    assert.equal(checkSub.valid, true, 'Deve validar subdiretório dentro da raiz');
  });

  it('bloqueia ataques de path traversal e acesso fora das raízes configuradas com mensagem clara', () => {
    const roots = getAllowedRoots();
    const primaryRoot = roots[0].path;

    // Tentativa de escapar da raiz usando ../..
    const traversalPath = primaryRoot + '/../../../../../../etc/passwd';
    const check = validateAndResolvePath(traversalPath);
    assert.equal(check.valid, false, 'Deve bloquear path traversal');
    assert.match(check.error || '', /Permissão negada/, 'Deve conter mensagem clara de permissão negada');
  });

  it('bloqueia tentativa de acesso à raiz geral do sistema operacional "/" quando restrito a NEBULA_ROOTS', () => {
    // Se a raiz não for '/', o acesso direto a '/' ou '/etc' fora das roots deve ser bloqueado
    const roots = getAllowedRoots();
    const isRootSlash = roots.some(r => r.path === '/');
    if (!isRootSlash) {
      const checkSlash = validateAndResolvePath('/');
      assert.equal(checkSlash.valid, false, 'Deve bloquear acesso a / fora dos permitted roots');
      assert.match(checkSlash.error || '', /Permissão negada/, 'Deve retornar mensagem clara');
    }
  });
});
