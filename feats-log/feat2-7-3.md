# Documentação de Entrega — Feat 2.7.3
## Nebula Spatial Workspace v2.7.3 — UX, Windowing, Editor & Estabilidade do Core

---

### Sumário Executivo

A versão **2.7.3** do Nebula Workspace consolida correções estruturais críticas de interface espacial, renderização em tela cheia, navegação de câmera, desacoplamento de janelas, editor de código Monaco com padrão profissional, proxy para navegação embutida, persistência em tempo real e segurança de autenticação.

---

### 1. Resumo das Implementações e Correções

| # | Área | Problema Identificado | Solução Implementada |
|---|---|---|---|
| **1** | **Fullscreen / Maximização** | A janela maximizada ficava presa no canto esquerdo da cena 3D e não ocupava a tela real do monitor. | A janela maximizada agora é renderizada via **React Portal** diretamente em `document.body` com `fixed inset-0 z-[99999]`, e os parâmetros do Framer Motion (`x, y, z`) são zerados, quebrando o *containing block* 3D do CSS e ocupando 100% da tela do usuário. |
| **2** | **Editor: Menu Bar Completo** | O editor não possuía menus clássicos de aplicação desktop. | Adicionada Menu Bar completa no topo do editor: **Arquivo** (Novo, Abrir Local, Salvar, Baixar, Fechar), **Editar** (Desfazer, Refazer, Localizar, Substituir), **View** (Word Wrap, Minimapa, Símbolos Outline, Alternar Tema), **Tools** (Novo Editor Independente, Desencaixar, Diff Git) e **Help** (Atalhos, Sobre). |
| **3** | **Editor: Abrir & Mudar Arquivo Local** | Não era possível abrir arquivos locais do computador ou trocar o arquivo ativo. | Implementada opção `Arquivo → Abrir Arquivo Local...` com a **File System Access API** nativa (`showOpenFilePicker`), permitindo selecionar e carregar qualquer arquivo diretamente na janela ativa do editor. |
| **4** | **Editores Múltiplos & Independentes** | Duplicar ou abrir múltiplos editores refletia as alterações de um no outro. | Editores secundários ou duplicados agora mantêm estado e buffers locais totalmente desacoplados e independentes. Alterações em um editor **não** afetam o outro. |
| **5** | **Editor: UX do Tema Corrigida** | O menu de alternar tema era cortado pela div do cabeçalho com `overflow-x-auto`. | O seletor de tema agora abre um modal/popover espaçoso, translúcido e centralizado com *backdrop-blur*, exibindo todos os temas e badges de cores sem qualquer corte. |
| **6** | **Janelas Magnéticas (Snapping) & Desencaixe** | Janelas grudavam sem opção de desligar ou separar com facilidade. | Criado toggle global nas Configurações (`snapEnabled`) e botão proeminente **[Desencaixar]** no cabeçalho de qualquer janela agrupada e no menu `Tools` do editor. |
| **7** | **Token não fornecido / Autenticação no Container** | Ao tentar criar/editar arquivos no container, ocorria erro 401 "Token não fornecido". | O `RemoteFSAdapter` agora consulta automaticamente `getAuthToken()` caso não haja token manual configurado, autenticando todas as requisições ao backend `/api/fs/*` de forma transparente. |
| **8** | **Atualização da Árvore ao Salvar** | A árvore de arquivos locais não refletia alterações salvas até reiniciar o Nebula. | Criado o método `refreshTree()` no `useFSStore` que reindexa o diretório local via `readDirectoryRecursive` e atualiza a árvore e previews imediatamente ao salvar (`Ctrl+S`). |
| **9** | **Destacar em Nova Aba (Popout Loop)** | O botão de destacar em nova janela entrava em loop de re-renderização infinito. | Desacoplado o ciclo de vida do pop-out no `PopoutPortal.tsx` usando referências estáveis (`useRef`) para callbacks e atualizações imperativas do título da janela. |
| **10** | **Graph View** | O termo "Obsidian" estava associado ao mapa. | Removida a palavra Obsidian em toda a aplicação; o módulo agora se chama **Graph — Mapa de Conexões**. |
| **11** | **Resolução & Nitidez Visual** | A cena 3D aparentava baixa resolução ou leve desfoque. | Adicionado anti-aliasing aprimorado no `index.css` (`text-rendering: optimizeLegibility`, font-smoothing subpixel) e seletor de nitidez nas Configurações (**Padrão 1x**, **Ultra-Nítido**, **Retina / HiDPI**). |
| **12** | **Navegador Embutido (Proxy Anti-X-Frame)** | Sites como Google e GitHub recusavam conexão em iframes. | Implementado endpoint de streaming seguro `/api/proxy/web?url=...` no backend com remoção de `X-Frame-Options` / CSP restritivo e injeção de `<base>`, além de botão direto para abertura em nova aba. |
| **13** | **Remoção do Botão "Toggle Z"** | O botão "Toggle Z" era redundante com o botão "Foco Ativo". | Removido da barra superior (TopBar). |
| **14** | **Abertura Inteligente de Janelas** | Janelas abriam em coordenadas fixas e degraus predefinidos. | Todas as janelas agora abrem centralizadas na visão atual da câmera (`-camera.x`, `-camera.y`) e no degrau ativo (`currentDepthPlane`). |
| **15** | **Grid 3D Simplificado** | Havia 3 grids visuais simultâneos poluindo o espaço 3D. | Mantido apenas o grid mais ao fundo (**Degrau 2, Z = -700px**). |
| **16** | **Velocidade do WASD** | Navegação por teclado era lenta para percorrer distâncias maiores. | Velocidade de movimentação base aumentada em **25%** (de 8 para 10) e velocidade com Shift (de 20 para 25). |
| **17** | **Sessão, Logout e Credenciais** | Não havia como deslogar para ver a tela de login nem documentação da senha padrão. | Adicionado botão de **Logout** na TopBar e nas Configurações. Credenciais padrão informadas: Usuário: `admin` / Senha: `admin123`. |

---

### 2. Detalhamento Técnico das Correções

#### 2.1 Fullscreen Real via Portal (`src/components/Window.tsx`)
Sob a especificação CSS 3D Transforms, qualquer container ancestral com `transform: translate3d(...)` ou `transformStyle: preserve-3d` redefine o bloco de contenção (*containing block*) para elementos com `position: fixed`. Isso fazia com que uma janela maximizada ficasse contida dentro dos limites e translações do canvas 3D.
- **Correção:** Quando `win.isMaximized` é verdadeiro, o componente utiliza `createPortal(windowNode, document.body)`.
- Além disso, o Framer Motion foi instruído a zerar as coordenadas `animate={{ x: 0, y: 0, z: 0, scale: 1 }}` ao invés de manter os offsets da posição original no canvas.

#### 2.2 Desacoplamento dos Editores (`src/components/windows/EditorWindow.tsx`)
Anteriormente, o `EditorWindow` consumia exclusivamente a store global `useEditorStore`. Ao abrir múltiplos editores ou duplicar janelas, todos compartilhavam o mesmo array de abas e a mesma aba ativa.
- **Correção:** O componente agora recebe `windowId` e `payload`. Para instâncias secundárias ou duplicadas (`windowId !== 'win-editor-main'`), o editor inicializa um estado local independente (`localTabs`, `localActiveTabPath`).
- Cada editor pode abrir seus próprios rascunhos, carregar arquivos locais diferentes e salvar individualmente sem qualquer colisão de estado.

#### 2.3 Menu Bar e File System Picker no Editor
O editor agora apresenta uma barra de menus com as seguintes opções:
- **Arquivo**:
  - `Novo Arquivo` (`Ctrl+N`): Adiciona um novo rascunho.
  - `Abrir Arquivo Local...` (`Ctrl+O`): Invoca a `showOpenFilePicker()` nativa do Chromium com suporte a `.ts`, `.tsx`, `.js`, `.json`, `.css`, `.html`, `.md`, `.py`, `.rs`, `.go`, `.sql`, `.yaml`, etc.
  - `Salvar` (`Ctrl+S`): Grava no handle local ou via adapter remoto e dispara `refreshTree()`.
  - `Baixar Arquivo`: Exporta o conteúdo como download no navegador.
  - `Fechar Aba` (`Ctrl+W`): Fecha a aba ativa.
- **Editar**: `Desfazer (Ctrl+Z)`, `Refazer (Ctrl+Y)`, `Localizar (Ctrl+F)`, `Substituir (Ctrl+H)`.
- **View**: `Quebra de Linha`, `Minimapa`, `Símbolos (Outline)`, `Alternar Tema...`.
- **Tools**: `Novo Editor Independente`, `Desencaixar Janela`, `Comparar com Git (Diff)`.
- **Help**: `Atalhos & Sobre`.

#### 2.4 Explicação Técnica: "Token não fornecido - autenticação necessária"
O backend do Nebula protege os endpoints de sistema de arquivos (`/api/fs/*`) com o middleware JWT `authMiddleware`.
No frontend:
1. O login salvava o token JWT no `localStorage` e `sessionStorage` sob a chave `nebula_token`.
2. O `RemoteFSAdapter`, entretanto, lia apenas `this.config.token`, que era uma propriedade manual configurada apenas na janela de configurações de VPS.
3. Como resultado, as requisições para criar, listar ou salvar arquivos dentro do próprio container ou máquina local enviavam requisições sem o cabeçalho `Authorization: Bearer <token>`, resultando no erro 401.
- **Solução:** Em `src/lib/adapters/RemoteFSAdapter.ts`, o método `getHeaders()` agora executa:
```typescript
const effectiveToken = (this.config.token && this.config.token.trim()) || getAuthToken();
if (effectiveToken && effectiveToken.trim()) {
  headers['Authorization'] = `Bearer ${effectiveToken.trim()}`;
}
```
Isso garante autenticação automática em todas as chamadas de sistema de arquivos do container.

#### 2.5 Atualização Imediata da Árvore de Arquivos
Quando um arquivo era salvo pelo editor via `writeFileContent` (handle nativo do Windows/Chromium), o arquivo era gravado no disco com sucesso, mas o `rootNodes` da árvore de arquivos não era notificado.
- **Solução:** O método `refreshTree` foi adicionado ao `useFSStore` e invocado no `saveFileByPath` do editor. Ele re-executa `readDirectoryRecursive(dirHandle)` imediatamente após o salvamento, atualizando os nós, tamanhos e previews em tempo real.

#### 2.6 Navegador Embutido e Proxy de Streaming (`server/routes/proxyRoutes.ts`)
Sites modernos enviam cabeçalhos HTTP como `X-Frame-Options: SAMEORIGIN` ou `Content-Security-Policy: frame-ancestors 'none'`. Quando um `<iframe>` tenta carregar diretamente `https://www.google.com`, o navegador bloqueia a exibição por segurança.
- **Solução:** Adicionado o endpoint `GET /api/proxy/web?url=...` no backend do Nebula.
  - Valida o destino contra ataques SSRF e redes privadas.
  - Faz o fetch da página externa pelo servidor do Nebula.
  - Remove os cabeçalhos restritivos de framing (`X-Frame-Options` e CSP `frame-ancestors`).
  - Injeta a tag `<base href="...">` no HTML para que links, estilos e imagens relativas funcionem.
  - O `WebEmbedWindow` conta agora com um seletor visual **Proxy ON / Proxy OFF** e botão para abrir em nova aba.

#### 2.7 Hotfix: Restauração de `computedZIndex` (`src/components/Window.tsx`)
Durante a unificação dos manipuladores de pop-out e portal de maximização, a declaração de `computedZIndex` foi suprimida acidentalmente enquanto seu uso permanecia no estilo inline de posicionamento. Foi restaurada a expressão canônica de empilhamento:
```typescript
const computedZIndex = (isCurrentPlane ? 100 : 0) + depthZBase + (win.zIndex || 0) + (isActive ? 40 : 5);
```
Garantindo renderização imediata sem disparar a tela de recuperação (*ErrorBoundary*).

#### 2.8 Tela de Login em Tela Cheia (Auth Gate Bloqueante)
Anteriormente, o formulário de login era instanciado como uma janela flutuante padrão dentro do canvas 3D. Isso expunha visualmente o ambiente de trabalho e permitia interações preliminares antes da validação das credenciais.
- **Implementação:** Criado o componente `FullScreenLoginGate.tsx` montado na raiz da aplicação (`src/App.tsx`).
- **Segurança e Bloqueio:** O gate ocupa 100% da viewport (`fixed inset-0 z-[999999] bg-[#050810]`), impedindo qualquer acesso, clique ou vazamento visual do canvas 3D ou da TopBar até que o usuário informe as credenciais corretas (`admin` / `admin123`).
- **Ciclo de Desconexão:** Ao acionar o botão de **Logout** na barra superior ou no painel de configurações, o token de autenticação é revogado via `clearAuthToken()` e é despachado o evento global `window.dispatchEvent(new CustomEvent('nebula_logout'))`, trancando o workspace imediatamente e devolvendo o usuário ao gate de autenticação em tela cheia.

#### 2.9 Centralização Global no Viewport Ativo e Degrau Atual (Sem Warping de Câmera)
**Problema diagnosticado:** Ao clicar em botões para abrir janelas (pela TopBar ou pelo Launcher), as janelas apareciam deslocadas muito ao norte ou fora do campo visual do usuário. As causas eram:
1. Janelas já existentes no workspace (como o editor ou painel git) retinham coordenadas pré-estabelecidas (ex.: `y: -260`) e não eram movidas para o ponto focal do usuário ao serem acionadas.
2. Os atalhos invocavam `jumpToDepthPlane(depth)`, o que forçava a câmera a transladar no eixo X para posições fixas (`180` ou `-120`), desorientando a navegação.
- **Solução Padronizada:** Implementada a regra canônica em `TopBar.tsx`, `LauncherWindow.tsx`, `FilePreviewWindow.tsx`, `FileBrowserWindow.tsx`, `EditorWindow.tsx`, `GitPanelWindow.tsx` e `useWindowsStore.ts`:
  - Toda abertura ou focalização de janela calcula a coordenada central exata do campo de visão da câmera:
    `x = Math.round(-camera.x - width / 2)`
    `y = Math.round(-camera.y - height / 2 + 28)` (compensando a altura da TopBar de 56px).
  - A janela é posicionada no degrau ativo (`currentDepthPlane`) onde o usuário está trabalhando, sem disparar translações abruptas de câmera (`jumpToDepthPlane`).

---

### 3. Credenciais e Acesso

- **Usuário Padrão:** `admin`
- **Senha Padrão:** `admin123`
- **Variável de Ambiente:** `NEBULA_ADMIN_PASSWORD=admin123` (no `docker-compose.yml`)
- **Tela de Login:** Exibida em tela cheia na primeira carga da aplicação e sempre que o usuário acionar o botão **Logout** na TopBar ou nas Configurações Globais.

---

### 4. Verificação e Testes Automatizados

- **Testes Unitários e Integração:** Todos os **31 testes** automatizados em `tests/**/*.test.ts` foram executados com **100% de aprovação**:
  - `auth.test.ts` (Rate limiting, MFA setup)
  - `cron.test.ts` (CRUD de jobs, validação sintática, path traversal)
  - `proxy.test.ts` (Validações SSRF, bloqueio de loopback, metadados de cloud e IPs privados)
  - `task-runner.test.ts` (Proteção contra injeção de comandos)
  - `workflow-engine.test.ts` (Execução de grafos, sandbox, isolamento e validação de DAG)
  - `workflow.test.ts` (CRUD, streaming SSE, webhooks)
- **Build de Produção:** `npm run build` compilou com sucesso tanto o bundle do Vite (`dist/index.html` e assets) quanto o servidor Node (`dist/server.cjs`).
