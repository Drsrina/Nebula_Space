# Feat 2.7.7 — Produtividade, Cloud IDE & Git Multi-Repositório 🚀

**Data:** 24 de Setembro de 2026  
**Versão:** v2.7.7  
**Status:** Concluído com sucesso (73/73 testes passando, build de produção verificado)

---

## 1. Visão Geral das Entregas

A versão **v2.7.7** marca o salto decisivo de produtividade para o ecossistema Nebula Workspace, entregando:

1. **Git & Versionamento (Multi-Repositório estilo GitHub Desktop)**:
   - Renomeação global de "Git Local & Forgejo" para **"Git & Versionamento"** em todos os pontos da UI (TopBar, Launcher, Command Palette, Window headers).
   - Suporte a gerenciamento de múltiplos repositórios (`activeRepoId`, `repositories`), permitindo alternar de contexto, adicionar repositórios locais (`/workspace/meu-projeto`) e clonar/vincular repositórios remotos.
   - Suporte a provedores remotos: **GitHub**, **GitLab** e **Forgejo / Gitea / Codeberg**.
   - Gerenciamento de credenciais com Personal Access Token (PAT) com validação de conexão em tempo real (🟢 Conectado / ⚪ Não autenticado).
   - Operações remotas com sincronização em 1 clique:
     - `Fetch origin`: consulta estado remoto e atualiza timestamp.
     - `Pull origin`: com badge dinâmico de commits pendentes (`↓ {behind}`).
     - `Push origin`: com badge dinâmico de commits locais prontos para envio (`↑ {ahead}`).
     - `Sync`: pull e push unificados.

2. **Layout Presets Espaciais (Workspaces Salvos nos 3 Degraus)**:
   - Nova store reativa `useLayoutPresetsStore` que gerencia a distribuição tridimensional de janelas entre D0 (Foco), D1 (Contexto) e D2 (Arquivo/Referência).
   - 4 presets embutidos prontos para uso:
     - **Coding**: Editor no D0, Diff no D1, Git & Versionamento no D2.
     - **Review / Notes**: Duas notas lado a lado no D0, File Browser no D1.
     - **Full Stack & Ops**: Editor + Terminal no D0, Task Runner + Docker Monitor no D1, Git & Versionamento no D2.
     - **Zen / Foco Total**: Editor único maximizado no D0.
   - Criação de presets personalizados do usuário gravados no LocalStorage com 1 clique.
   - Acesso rápido aos presets via novo menu **Layouts** na TopBar e atalhos na **Command Palette** (`Ctrl+P` / `Ctrl+Shift+P`).

3. **Terminal Web Interativo Real (Container Docker Shell)**:
   - Suporte inteligente à navegação com `cd` persistente entre comandos consecutivos validado estritamente contra as raízes permitidas (`validateAndResolvePath`).
   - Execução direta com `/bin/bash` ou `/bin/sh` no container Docker, com suporte a variáveis de ambiente `TERM=xterm-256color` e `FORCE_COLOR=1`.
   - Parser ANSI nativo no frontend para renderizar saídas coloridas de comandos como `ls -la`, `git status`, `git log`, `npm test`.
   - Barra de comandos rápidos (*chips*) para execução imediata (`ls -la`, `pwd`, `git status`, `node -v`, `npm test`).
   - Indicador de diretório de trabalho atual (`cwd`) com botão de cópia e atalhos de teclado (Ctrl+L para limpar, Ctrl+C para abortar prompt, Setas Cima/Baixo para histórico).

---

## 2. Arquivos Criados e Alterados

- `src/types/index.ts`: tipos `GitRepository`, `GitProviderAccount`, `GitRemoteSyncStatus`, `SpatialLayoutPreset`.
- `src/lib/gitProviders.ts`: integrações para autenticação e listagem em GitHub, GitLab e Forgejo.
- `src/store/useGitStore.ts`: ampliação da store Git com controle multi-repositório, sincronização remota e gestão de provedores.
- `src/store/useLayoutPresetsStore.ts`: store para layouts espaciais D0/D1/D2 com built-ins e layouts personalizados.
- `src/components/windows/GitPanelWindow.tsx`: interface inspirada no GitHub Desktop com seletor de repositório, branch dropdown, sync bar e abas de provedores.
- `src/components/windows/TerminalWindow.tsx`: console interativo com ANSI coloring, chips de comandos rápidos e histórico.
- `src/components/TopBar.tsx`: menu dropdown de "Layouts", atualização do nome para "Git & Versionamento" e bump para v2.7.7.
- `src/components/CommandPaletteOverlay.tsx`: ações de presets e atalho para Git & Versionamento.
- `src/components/windows/LauncherWindow.tsx`: atualização para "Abrir Git & Versionamento".
- `server.ts`: aprimoramento da rota `/api/terminal/exec` com persistência de diretório `cd` e execução no shell do container.
- `tests/presets.test.ts`: testes de unidade cobrindo os 4 presets, aplicação nos degraus e persistência.
- `tests/git-multi.test.ts`: testes de unidade cobrindo troca de repositório ativo, adição de repositórios, remoção e operações de remote sync.

---

## 3. Validação & Qualidade

- **Testes Unitários:** 73/73 testes passando com sucesso.
- **Tipagem estática:** `tsc --noEmit` executado sem erros (0 avisos).
- **Build de produção:** `vite build && esbuild server.ts` gerado em 35s com chunks otimizados.
