# Nebula Space — Versão 2.7.6
**Data:** 24 de Setembro de 2026  
**Foco:** Estabilidade, CI/CD, Desacoplamento de Módulos, Backup & Restore do Workspace e UX de Snapping / Configurações Globais

---

### 1. GitHub Actions (CI Automatizado)
- Adicionado `.github/workflows/ci.yml` cobrindo pushes e pull requests na branch `main`.
- Etapas automáticas:
  1. `npm ci`
  2. `npm run lint` (`tsc --noEmit`)
  3. `npm test` (64 testes unitários e de integração)
  4. `npm run build` (Vite + esbuild backend)
- Garante proteção contínua da branch principal contra regressões no repositório público.

### 2. Desacoplamento de Imports Circulares do Bundler
- Eliminados os avisos do Vite em `src/store/useEditorStore.ts` que realizavam `import()` dinâmico de `useFSStore` e `useWindowsStore`.
- Implementado barramento de eventos leves via `window.dispatchEvent(new CustomEvent('nebula_file_saved', { detail: { path, content } }))`.
- Ouvintes centralizados em `App.tsx` garantem sincronização de árvore de arquivos e pré-visualizações sem criar nós circulares no grafo do bundler.
- Compilação do Vite 100% limpa sem avisos de importação circular.

### 3. Backup & Restore do Workspace (`.nebula.json`)
- Criado o módulo `src/lib/workspaceBackup.ts`.
- Exportação completa em um único arquivo `.nebula.json`:
  - Todas as janelas abertas com coordenadas (X, Y, Z), dimensões, títulos e payloads.
  - Todas as notas salvas no IndexedDB.
  - Abas abertas no editor Monaco e aba ativa.
  - Posição da câmera 3D, zoom e degrau ativo (0, 1, 2).
  - Configurações do usuário (snapping magnético, modo de resolução visual).
- Importação e restauração completa com validação de integridade.
- Acessível diretamente pelo menu da **TopBar** ("Exportar Workspace" / "Importar Workspace") e pela janela de **Configurações Globais**.

### 4. Correção e Afastamento Físico no Botão "Desencaixar" (Snapping)
- O botão "Desencaixar" agora calcula o vetor de separação em relação ao centro dos outros componentes do grupo e afasta a janela em 60px (`SEPARATION > SNAP_THRESHOLD = 40px`).
- Evita que a janela continue grudada na borda após ser solta ou sofra re-snap imediato no primeiro micro-arrasto.

### 5. Povoamento e Roteamento de Configurações Globais (`settings-global`)
- Corrigida a renderização de `<SettingsWindow />` para a chave `settings-global` em `Window.tsx` (anteriormente exibia "Janela vazia.").
- Interface de Configurações Globais completa com:
  - Toggle liga/desliga para o snapping magnético de janelas.
  - Painel de Backup & Migração (`.nebula.json`) para exportação e importação.
  - Seleção de nitidez e resolução (1x, Ultra-Nítido, Retina HiDPI).
  - Parâmetros de backend remoto VPS (Docker/1Panel) e teste de conexão HTTP ao vivo.
  - Gerenciamento de sessão e logout seguro.
