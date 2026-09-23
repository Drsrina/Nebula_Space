# Nebula Workspace — Build 2.7.1 Features (Eixo 3)

Documento de referência da Build 2.7.1, cobrindo a otimização profunda de performance, modularização de bundles e aprimoramentos de usabilidade e navegação espacial no frontend.

---

## ⚡ 1. Code-Splitting de Janelas & Shimmer Skeleton Futurista

### 1.1. Fallback Visual Dinâmico com Shimmer (`WindowSkeleton.tsx`)
- Componente dedicado renderizado enquanto chunks assíncronos estão sendo buscados via rede.
- Design futurista com pulso suave, esqueleto de cabeçalho, barra de ferramentas e linhas de conteúdo simuladas nos tons característicos do Nebula (`#3ba9ff` e `#5eead4`).

### 1.2. Lazy Loading Sob Demanda de 15 Janelas
- Todas as janelas secundárias/pesadas foram convertidas para `React.lazy()` em [`Window.tsx`](file:///c:/Users/Drysrina/Desktop/Code/Nebula_git/nebula_gitv2/src/components/Window.tsx):
  - `GitPanelWindow`, `DiffWindow`, `AiChatWindow`, `GlobalSearchWindow`, `TaskRunnerWindow`, `WorkflowWindow`, `KanbanWindow`, `PdfViewerWindow`, `WebEmbedWindow`, `ApiClientWindow`, `LivePreviewSplitWindow`, `SnippetsWindow`, `CrontabWindow`, `CodeSandboxWindow` e `PluginManagerWindow`.
- Ambas as saídas de renderização (no canvas 3D e dentro de janelas desacopladas via `PopoutPortal`) são envolvidas por `<React.Suspense fallback={<WindowSkeleton />}>`.

### 1.3. Otimização de Chunks via Vite (`manualChunks`)
- O arquivo de configuração [`vite.config.ts`](file:///c:/Users/Drysrina/Desktop/Code/Nebula_git/nebula_gitv2/vite.config.ts) foi configurado para isolar as dependências de terceiros em chunks próprios (`vendor-react`, `vendor-motion`, `vendor-icons`, `vendor-git`, `vendor-monaco`, `vendor-highlight`).
- **Métricas de Ganho de Performance**:
  - O bundle principal (`dist/assets/index-*.js`) caiu de **1.670 kB** para **189.99 kB** (apenas **52.65 kB gzipped**), uma redução de quase **90%** no payload inicial transferido ao navegador.

---

## 🗺️ 2. Minimap 3D Interativo

- **Arquivo**: [`Minimap.tsx`](file:///c:/Users/Drysrina/Desktop/Code/Nebula_git/nebula_gitv2/src/components/Minimap.tsx)

### 2.1. Navegação Contínua por Arraste (Pointer Capture)
- Permite arrastar o retângulo de viewport com o mouse ou toque para mover a câmera em tempo real pelo universo 3D com captura de ponteiro segura (`setPointerCapture`).
- Cursors visuais dinâmicos (`grab` / `grabbing`).

### 2.2. Botão de Colapso / Expansão (Compact Mode)
- Toggle chevron no cabeçalho permitindo recolher o minimap em formato de pill minimalista, desobstruindo a visão do canvas quando desejado.

### 2.3. Badges de Camada Z e Zoom
- Exibição em tempo real do nível Z ativo (`D0`, `D1` ou `D2`) com sua cor temático-espacial.
- Percentual de zoom da câmera atualizado instantaneamente (`camera.zoom * 100%`).
- Botões interativos na legenda inferior que executam `setActiveLayer(layer, true)` para transição rápida entre planos de profundidade.

---

## 📂 3. Renderização Progressiva no FileBrowser (`displayLimit`)

- **Arquivo**: [`FileBrowserWindow.tsx`](file:///c:/Users/Drysrina/Desktop/Code/Nebula_git/nebula_gitv2/src/components/windows/FileBrowserWindow.tsx)

### 3.1. Slicing Dinâmico de Diretórios Gigantes
- Em diretórios com grande volume de nós (ex: `node_modules`, `dist`, logs), o FileBrowser agora adota um limite reativo de exibição (`displayLimit` padrão de 80 itens).
- Previne travamento de renderização e recálculo de reflow no DOM.

### 3.2. Botão "Carregar mais (+80 itens)"
- Integrado na base da visualização em Tabela (estilo 1Panel) e em Grade (Grid View).
- Exibe o progresso de itens carregados (ex: `80 de 1520`) e permite incremento sob demanda.
- Barra de status inferior atualizada com contador de itens visíveis vs totais.

---

## 🧪 4. Validação & Testes Automatizados

- **Testes Unitários e de Integração**: `npm test` executado com sucesso:
  - **22/22 testes passando** com 0 falhas em ~1.0 segundo.
- **Build de Produção**: `npm run build` executado com sucesso:
  - Bundle principal minificado em **189.99 kB**.
  - **0 avisos de chunk size**.
  - ESBuild server bundle `dist/server.cjs` gerado sem erros.
