# Nebula 🌌 — 3D Spatial File Workspace

Nebula é um ambiente de trabalho espacial e imersivo para navegar, editar e organizar arquivos de código, repositórios Git e anotações em um canvas 3D nativo com **3 degraus de profundidade cognitiva**.

Inspirado na liberdade visual do Miro e na agilidade de editores de código modernos, o Nebula elimina o caos de dezenas de janelas sobrepostas através de uma hierarquia espacial tangível no eixo Z.

---

## 📐 O Princípio dos 3 Degraus (Z-Depth) & Sistema de Oclusão

A interface do Nebula não utiliza 3D como mero artifício estético; o eixo Z reflete **prioridade cognitiva direta**:

| Degrau | Profundidade Z | Prioridade | Características Visuais & Comportamento |
|---|---|---|---|
| **Degrau 0** | `Z = 0px` | **Foco** | Janela principal de trabalho (editor de código ativo, preview de documento). **Blur 0px, Opacidade 1.0, Escala 1.0**, glow neon e interação total. |
| **Degrau 1** | `Z = -400px` | **Contexto** | Painel Git, árvore de arquivos do projeto, abas de consulta secundária. **Blur 0px ou atenuado, Escala 0.94**, glow médio. |
| **Degrau 2** | `Z = -700px` | **Arquivo / Referência** | Notas de pesquisa de longo prazo, documentação estacionada, logs e rascunhos. **Escala 0.88**, recuo perceptível no fundo. |

### 🔍 Sistema Inteligente de Oclusão Óptica & Hit-Testing 3D (`activeLayer`)
Um dos maiores diferenciais do Nebula é o tratamento inteligente de interação entre planos espaciais:
- **Hit-Testing 3D Livre de Bloqueios**: O contêiner da cena 3D opera com `pointer-events: none`, permitindo que os raios de clique atravessem planos virtuais e alcancem diretamente os botões, cabeçalhos e textos das janelas situadas em profundidades negativas ($Z = -400px$ e $Z = -700px$).
- **Isolamento de Janelas Inertes**: Quando a atenção está no **Degrau 1** ou **Degrau 2**, as janelas dos degraus fisicamente à frente tornam-se **vidro fosco translúcido atenuado** e recebem a regra em cascata `[data-inert="true"]` (`pointer-events: none !important`), impedindo que o Monaco Editor ou outros elementos frontais roubem cliques.
- **Foco e Seleção com 1 Clique**: Clicar em qualquer janela de qualquer degrau traz automaticamente aquela janela e a câmera para o plano ativo correspondente, mantendo o workspace fluido e sem atrito.

---

## ✨ Módulos e Janelas Especializadas

O workspace do Nebula oferece janelas nativas integradas para todo o ciclo de desenvolvimento:

### 1. 📝 Editor de Código Multi-Abas (`EditorWindow`) — *Degrau 0*
- Monaco Editor completo com tema neon customizado (`nebula-dark`).
- Suporte a múltiplas abas com indicador visual de alterações pendentes (*dirty state*).
- Numeração de linhas, busca e substituição, minimapa, quebra de linha e destaque de sintaxe multiliguagem.
- Atalhos universais de gravação (`Ctrl+S` / `Cmd+S`).
- Conexão direta com arquivos do disco local via **File System Access API** ou via backend remoto Express.

### 2. 💻 Terminal Integrado (`TerminalWindow`) — *Degrau 2*
- Terminal local autônomo conectado via endpoint `POST /api/terminal/exec`.
- Histórico de comandos com navegação rápida pelas setas ($\uparrow$ / $\downarrow$).
- Atalhos de controle `Ctrl+C` (interromper), `Ctrl+L` ou comando `clear` (limpar tela).
- Respeita o modo de segurança `NEBULA_READONLY` quando configurado.

### 3. 🤖 Nebula AI Chat (`AiChatWindow`) — *Degrau 1*
- Assistente de código integrado com a API do **Google Gemini 2.0 Flash** (`POST /api/ai/chat`).
- **Contextualização inteligente**: Injeta automaticamente o arquivo atualmente em foco no Monaco Editor sempre que você menciona termos como "código", "função" ou "arquivo".
- Formatação de respostas em Markdown com blocos de código syntax-highlighted.

### 4. 🐙 Painel Git Local & Forgejo / Gitea (`GitPanelWindow`) — *Degrau 1*
- **Git Local**:
  - Detecção e listagem de arquivos modificados, novos (*untracked*) e deletados.
  - Ações rápidas de **Stage (+)**, **Unstage (-)** e descarte de alterações.
  - Criação de commits com mensagem personalizada, autor e carimbo de data.
  - Troca de branches (*checkout*) e visualização de status à frente/atrás da origem.
  - Histórico de commits com identificador SHA reduzido e mensagem.
  - Acesso com 1 clique ao **Visualizador de Diff** para qualquer arquivo alterado.
- **Conexão Forgejo / Gitea / Codeberg / GitHub**:
  - Configuração de URL da instância e token de API pessoal.
  - Listagem de repositórios remotos, Issues abertas/fechadas e Pull Requests em tempo real.

### 5. ⚖️ Visualizador de Diferenças (`DiffWindow`)
- Visualização lado a lado (*Side-by-Side*) ou unificada (*Unified Diff*).
- Contadores de linhas adicionadas (`+`) e removidas (`-`) com destaque sintático neon azul/vermelho.

### 6. 🗂️ Árvore de Diretórios e Navegador (`FileTreeWindow` & `FileBrowserWindow`) — *Degrau 1*
- Expansão e recolhimento hierárquico de diretórios.
- Busca e filtragem instantânea de arquivos por nome ou extensão.
- Abertura direta de pastas do sistema operacional com permissão segura do usuário.
- *Workspace Fallback*: Modo de demonstração com arquivos reais caso executado em navegadores sem suporte à API nativa de arquivos.

### 7. 📌 Notas Espaciais & Rascunhos (`NoteWindow`) — *Degrau 2*
- Editor de notas ricas com formatação Markdown instantânea (títulos, negrito, itálico, listas de afazeres com checkboxes, blocos de código).
- Categorização por etiquetas de cores (roxo, azul, ciano, âmbar, vermelho).
- Cópia com 1 clique para a área de transferência e exportação para arquivos `.md`.

### 8. 👁️ Previewer de Arquivos (`FilePreviewWindow`)
- Renderização avançada de Markdown com tabelas e formatação estilizada.
- Visualizador de imagens (PNG, JPG, SVG, WebP), JSON formatado e código fonte com contagem de linhas e tamanho em bytes.

### 9. ⚡ Command Palette & Quick Open (`LauncherWindow`)
- Acessível a qualquer momento via `Ctrl + K` ou `Ctrl + P`.
- Modo **Quick Open** (`Ctrl + P`): Busca fuzzy instantânea de arquivos por nome em todo o workspace com abertura direta no Editor.
- Comandos rápidos de alternância de modo, layout e criação de notas.

### 10. 🔍 Busca Global no Workspace (`GlobalSearchWindow`) — *Degrau 1*
- Acessível via atalho global `Ctrl + Shift + F` ou botão na barra superior.
- Busca textual recursiva com suporte a expressões regulares (via endpoint `GET /api/fs/grep`).
- Agrupamento inteligente de resultados por arquivo, contadores de ocorrências, números de linhas e snippets de código com destaque.
- Navegação com 1 clique diretamente para o arquivo e linha no Monaco Editor.

### 11. 📦 Task Runner & Scripts (`TaskRunnerWindow`) — *Degrau 2*
- Acessível via botão **Tasks** na barra superior ou Launcher.
- Auto-detecção de scripts definidos no `package.json` (`npm run dev`, `npm run build`, `npm run lint`, etc.).
- Execução de tarefas em background com streaming de logs em tempo real em um console embutido.
- Controles de execução com botão Play/Stop e limpeza de histórico.

### 12. 🎨 Experiência Monaco Avançada: Temas, Git Gutter & Símbolos
- **Git Gutter em Tempo Real**: Indicadores luminosos no gutter do Monaco (verde para adições, âmbar para edições, vermelho para remoções) comparando em tempo real com o Git HEAD.
- **Breadcrumbs Bar**: Barra de navegação hierárquica no topo do editor mostrando o caminho da pasta e arquivo ativo (`src > components > EditorWindow.tsx`).
- **Outline Drawer de Símbolos**: Painel retrátil na lateral do editor que extrai interfaces, classes, funções e constantes com salto direto para a linha ao clicar.
- **Seletor de Temas**: Paleta com 4 temas customizados de alta fidelidade: *Nebula Deep Space*, *Tokyo Night*, *One Dark Pro* e *Dracula Neon*.

### 13. ⚙️ Configurações do Workspace (`SettingsWindow`)
- Ajuste de sensibilidade de pan/zoom da câmera 3D, espaçamento entre planos no eixo Z, efeitos de glow neon e utilitários de limpeza de cache local.

---

## ⌨️ Atalhos de Teclado

| Atalho | Ação |
|---|---|
| `1` ou `Alt + 1` | Navegar câmera e focar no **Degrau 0 (Foco)** |
| `2` ou `Alt + 2` | Navegar câmera e focar no **Degrau 1 (Contexto)** |
| `3` ou `Alt + 3` | Navegar câmera e focar no **Degrau 2 (Arquivo)** |
| `Esc` ou `0` | Retornar câmera imediatamente ao **Degrau 0** |
| `Ctrl + P` ou `Cmd + P` | **Quick Open** (Busca rápida de arquivos pelo nome) |
| `Ctrl + Shift + F` | **Busca Global** no Workspace (Grep textual por conteúdo) |
| `Ctrl + K` ou `Cmd + K` | Abrir Command Palette / Launcher geral |
| `Ctrl + S` ou `Cmd + S` | Salvar arquivo aberto na aba ativa do Editor |
| `F` | Alternar **Modo Foco** (oculta degraus secundários) |
| `Espaço + Arrastar` | Panorâmica (Pan) pelo canvas 3D infinito |
| `Botão do Meio do Mouse` | Panorâmica livre do canvas |
| `Scroll do Mouse (Wheel)` | Zoom in / Zoom out suave (fora de janelas com rolagem) |
| `Scroll no Cabeçalho da Janela` | Alternar degrau Z da janela (subir/descer de nível com a rodinha do mouse) |

---

## 🛠️ Stack Técnica & Arquitetura

- **Frontend**: React 19 + TypeScript + Vite.
- **Styling**: Tailwind CSS v4 (design system escuro *Deep Space* com paleta neon ciano `#3ba9ff` e `#5eead4`).
- **Renderização 3D Nativa no DOM**:
  - `perspective: 3000px`, `transform-style: preserve-3d` no contêiner mestre, translações `translate3d(X, Y, Z)` combinadas com física fluida do Framer Motion (`motion/react`).
  - *Decisão arquitetural*: **Zero WebGL/Three.js overhead**. Todo o texto permanece 100% selecionável no DOM, editores de código preservam inputs nativos do navegador e Monaco Editor opera com precisão máxima.
  - *Mitigação de Flattening (CSS Transforms L2)*: As janelas 2D individuais não aplicam `preserve-3d`, permitindo o uso irrestrito de `overflow: hidden`, `backdrop-filter: blur` e cantos arredondados sem corromper a matriz de projeção tridimensional do motor de renderização.
- **Gerenciamento de Estado**: Zustand (`useCanvasStore` para câmera e camadas, `useWindowsStore` para janelas e arquivos).
- **Persistência**: IndexedDB (`idb-keyval`) com sanitização e normalização automática de tipos (impede estados corrompidos entre sessões).
- **Backend Full-Stack**: Node.js + Express (empacotado em produção via `esbuild` em um único arquivo CJS autônomo `dist/server.cjs`).

---

## 🌐 API REST (Backend Self-Hosted)

Quando executado com o backend Node/Express ou via Docker, o Nebula expõe uma API REST protegida e segura:

- `GET /api/health` — Status de integridade do serviço, raízes permitidas e modo de operação (leitura/escrita).
- `GET /api/fs/roots` — Lista as pastas raiz configuradas em `NEBULA_ROOTS`.
- `GET /api/fs/list?path=...` — Lista o conteúdo de um diretório com metadados de arquivos.
- `GET /api/fs/read?path=...` — Lê o conteúdo textual ou binário de um arquivo.
- `POST /api/fs/write` — Grava ou atualiza o conteúdo de um arquivo (com limite de até 15MB).
- `POST /api/fs/mkdir` — Cria um novo subdiretório.
- `POST /api/fs/rename` — Renomeia ou move arquivos e diretórios.
- `DELETE /api/fs/delete` — Remove arquivos ou diretórios com segurança.
- `GET /api/fs/search?query=...&path=...` — Busca rápida recursiva por termos e extensões.
- `POST /api/terminal/exec` — Executa comandos no shell local com retorno de saída padrão (stdout/stderr).
- `POST /api/ai/chat` — Conversação e geração de código com modelos Google Gemini.

---

## 🚀 Como Rodar Localmente (Desenvolvimento)

1. Clone o repositório:
```bash
git clone https://github.com/your-username/nebula.git
cd nebula
```

2. Instale as dependências:
```bash
npm install
```

3. Configure o arquivo de ambiente:
```bash
cp .env.example .env
```

4. Inicie o servidor de desenvolvimento:
```bash
npm run dev
```

5. Acesse no navegador:
```
http://localhost:3000
```
*(Dica: Para usufruir da File System Access API nativa do sistema operacional, use navegadores baseados em Chromium, como Google Chrome, Brave ou Edge).*

---

## 🐳 Self-Hosting & Deploy

O Nebula foi projetado para deploy descomplicado em servidores próprios, VPS ou painéis de gerenciamento como **1Panel**, **Portainer** ou **Coolify**.

### Opção 1: Docker & Docker Compose (Recomendado)

Utilize o arquivo `docker-compose.yml.example`:

```bash
cp docker-compose.yml.example docker-compose.yml
```

Ajuste as variáveis no `docker-compose.yml`:
```yaml
version: "3.8"

services:
  nebula:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: nebula-workspace
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
      - PORT=3000
      - NEBULA_TOKEN=defina_um_token_seguro_aqui
      - NEBULA_ROOTS=/data:/workspace
      - NEBULA_READONLY=false
    volumes:
      - /meu-diretorio-no-host/data:/data
      - /meu-diretorio-no-host/workspace:/workspace
```

Inicie o container:
```bash
docker compose up -d
```

### Opção 2: Build Manual para Produção

Compile a aplicação frontend e o backend empacotado:
```bash
npm run build
npm start
```
O comando compila o frontend estático para `dist/` e empacota o servidor Express em `dist/server.cjs`.

### Opção 3: Deploy em Servidores Web Estáticos (Caddy / Nginx)

Caso deseje servir apenas a interface SPA client-side sem o backend Node:

#### Caddy (`Caddyfile`):
```caddy
nebula.seudominio.com {
    root * /caminho/para/nebula/dist
    file_server
    try_files {path} /index.html
}
```

#### Nginx:
```nginx
server {
    listen 80;
    server_name nebula.seudominio.com;
    root /var/www/nebula/dist;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }
}
```

---

## 🔒 Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP em que o servidor Express escutará. |
| `NODE_ENV` | `development` | Ambiente de execução (`development` ou `production`). |
| `NEBULA_TOKEN` | *Vazio* | Token Bearer obrigatório para autenticar operações no filesystem. Se vazio em dev, o acesso é livre. |
| `NEBULA_ROOTS` | `/data` | Lista de diretórios autorizados separados por vírgula ou dois-pontos. Protege contra *path traversal*. |
| `NEBULA_READONLY` | `false` | Se `true`, bloqueia todas as requisições de escrita, criação e exclusão. |
| `GEMINI_API_KEY` | *Opcional* | Chave de API Google Gemini gerenciada no servidor. |

---

## 💾 Persistência & Recuperação de Falhas

- Todo o estado do workspace (posição de cada janela, dimensões, degrau no eixo Z, z-index e estado de abas/notas) é salvo continuamente no **IndexedDB** local (`nebula_windows_state_v2`).
- Caso deseje restaurar o arranjo original de fábrica ou purgar estados legados, clique no **ícone de redefinição** (seta circular) na barra superior do workspace.

---

## 📄 Licença

Distribuído sob a licença **GNU General Public License v3.0 (GPLv3)**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

Software Livre: Você tem a liberdade de executar, estudar, modificar e redistribuir este software sob os termos da GNU GPLv3. Quaisquer trabalhos derivados devem obrigatoriamente manter o código aberto sob a mesma licença GPLv3.
