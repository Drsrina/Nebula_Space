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
- Monaco Editor completo com tema neon customizado (`nebula-dark`) e suporte a múltiplos temas (`tokyo-night`, `one-dark-pro`, `dracula-neon`).
- **Menu Completo de Ações Avançadas**:
  - **Arquivo**: Novo Arquivo (`Ctrl+N`), Abrir Arquivo Local (`Ctrl+O`), Salvar (`Ctrl+S`), **Salvar Como (`Save As...`)**, **Reverter Alterações (`Revert`)**, **Alternar Quebra de Linha (LF / CRLF)** e Exportar.
  - **Editar**: Desfazer (`Ctrl+Z`), Refazer (`Ctrl+Y`), Buscar (`Ctrl+F`), Substituir (`Ctrl+H`).
  - **Exibir**: Quebra de linha automática (*Word Wrap*), Minimapa, Drawer de Símbolos, Alternância de Tema.
  - **Ferramentas**: Abrir Novo Editor Independente, Desencaixar Janela, Comparar com Git (Diff).
- Instâncias de editor 100% independentes sem vazamento de estado de buffer ou cursor.
- **Git Gutter em Tempo Real**: Linhas adicionadas (verde), editadas (âmbar) e removidas (vermelho) calculadas contra `HEAD`.
- **Breadcrumbs Hierárquicos**: Caminho interativo da pasta e arquivo em foco.
- **Outline Drawer de Símbolos**: Extração automática de interfaces, funções, classes e constantes com salto direto para o código.

### 2. ⚡ Command Palette & Quick Open (`LauncherWindow`) — *Atalho Universal `Ctrl+P` / `Ctrl+K`*
- Acessível instantaneamente em qualquer lugar através de `Ctrl+P` ou `Ctrl+K`.
- **Modo Quick Open (`Ctrl+P`)**: Busca rápida e inteligente (fuzzy) por qualquer arquivo do projeto com abertura direta no editor.
- **Comandos de Sistema & Ações Rápidas**: Alternar modos de operação (Local vs VPS), abrir janelas especializadas, alternar presets espaciais e resetar a câmera 3D.
- Navegação completa por teclado com atalhos de seleção rápida.

### 3. 📌 Notas Espaciais & Exportação Multi-Formato (`NoteWindow`) — *Degrau 2*
- Editor de anotações ricas em Markdown com renderização instantânea, blocos de código e listas de afazeres interativas (*checkboxes*).
- **Exportação Multi-Formato com 1 Clique**:
  - **HTML**: Documento HTML formatado com folha de estilos limpa pronta para visualização externa.
  - **PDF**: Layout formatado com estilo de impressão limpo, pronto para arquivamento ou envio.
  - **Markdown (.md)**: Download direto do arquivo Markdown puro.
- Categorização visual por cores neon (ciano, roxo, azul, âmbar, verde e vermelho).
- Estatísticas de texto em tempo real (contagem de palavras e caracteres).

### 4. 🎛️ Presets de Layout Espacial 3D (Workspaces Salvos)
- Alterne instantaneamente entre configurações pré-definidas de janelas nos 3 degraus cognitivos com 1 clique:
  - **Preset "Coding"**: Editor Monaco em foco no Degrau 0, Diff no Degrau 1, Painel Git no Degrau 2.
  - **Preset "Review / Notes"**: Duas notas lado a lado no Degrau 0, Árvore de Arquivos no Degrau 1.
  - **Preset "Full Stack"**: Editor de Código no Degrau 0, Terminal Interativo no Degrau 1, Monitor Docker no Degrau 2.
- Animação de transição suave de câmera entre planos com interpolação precisa (lerp).

### 5. 💻 Terminal Web Interativo Real (xterm.js + WebSocket / PTY) — *Degrau 2*
- Terminal interativo real conectado a uma sessão PTY (`/bin/bash` ou `sh` dentro do container).
- Suporte a comandos interativos completos (`top`, `htop`, `vim`, `nano`, `git`, `npm`).
- Histórico persistente de comandos, atalhos de controle `Ctrl+C`, `Ctrl+L` e redimensionamento dinâmico de colunas e linhas.

### 6. 🔄 Mini-Workflows de Automação & Crontab Integrado
- Construtor visual de fluxos de automação baseado em nós encadeados.
- **Nó Trigger**: Execução manual ou acionamento programado via agendador **Crontab**.
- **Nó HTTP Request / Webhook**: Chamadas REST completas (GET, POST, PUT, DELETE) com headers e passagem de JSON para os nós seguintes.
- **Nó Code-Box (Python / JavaScript)**: Processamento de dados e regras de negócio com payload encadeado.
- Streaming em tempo real de logs de execução via Server-Sent Events (SSE).

### 7. 📦 Task Runner & Scripts com Autodescoberta
- Painel dedicado de execução de rotinas e scripts com auto-detecção de processos em execução.
- Varredura de scripts disponíveis no `package.json` e rotinas automatizadas.
- Inclui script de demonstração integrado `timestamp-logger.js` gerado automaticamente para onboarding de novos desenvolvedores.

### 8. 🛡️ Segurança Corporativa, MFA/2FA & Configurações Globais
- **Barreira de Login em Tela Cheia (`FullScreenLoginGate`)**: Proteção total do canvas 3D contra acessos externos não autenticados.
- **Gerenciamento Centralizado no Painel de Configurações**:
  - **Alteração de Senha de Administrador**: Atualização de credenciais com persistência automática no `/data/auth-config.json` sem necessidade de reiniciar containers.
  - **Autenticação em Dois Fatores (TOTP / 2FA)**: Geração de QR Code nítido para pareamento com Google Authenticator, Authy, Microsoft Authenticator e 1Password, com confirmação de 6 dígitos.
  - **Revogação de Dispositivos & Desativação Segura**: Desativação de MFA mediante confirmação da senha administrativa.
- **Isolamento de Diretórios (`NEBULA_ROOTS`)**: Proteção estrita contra *path traversal* em todas as operações de I/O.

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

O repositório já disponibiliza na raiz um template pronto para uso (`docker-compose.yml` e `docker-compose.yml.example`):

```bash
docker compose up -d --build
```

Configuração de exemplo do `docker-compose.yml`:
```yaml
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
      - NEBULA_PASSWORD=sua_senha_segura
      - NEBULA_ADMIN_PASSWORD=sua_senha_segura
      - NEBULA_ADMIN_USER=admin
      - NEBULA_MFA_SETUP=true
      - NEBULA_JWT_SECRET=troque_por_uma_string_longa_e_aleatoria_com_32_chars
      - NEBULA_ROOTS=/:/workspace:/data
      - NEBULA_READONLY=false
    volumes:
      # Persistência de dados, notas, senhas alteradas e auth-config.json
      - ./data:/data
      # Volume com os projetos e código fonte
      - ./workspace:/workspace
```

---

## 🔒 Variáveis de Ambiente

| Variável | Padrão | Descrição |
|---|---|---|
| `PORT` | `3000` | Porta HTTP em que o servidor Express escutará. |
| `NODE_ENV` | `development` | Ambiente de execução (`development` ou `production`). |
| `NEBULA_PASSWORD` / `NEBULA_ADMIN_PASSWORD` | `admin123` | Senha inicial de acesso administrativo. Suporta texto puro ou hash bcrypt. |
| `NEBULA_ADMIN_USER` | `admin` | Nome de usuário exibido no emissor de QR Code TOTP. |
| `NEBULA_MFA_SETUP` | `true` | Habilita a geração e configuração de 2FA/MFA nas Configurações Globais. |
| `NEBULA_MFA_SECRET` | *Vazio* | Secret base32 pré-definido para TOTP (opcional; pode ser ativado pela interface). |
| `NEBULA_JWT_SECRET` | *Chave padrão* | Chave secreta usada para assinar os tokens JWT de sessão (mínimo 32 caracteres). |
| `NEBULA_ROOTS` | `/:/workspace:/data` | Lista de diretórios autorizados separados por dois-pontos. Protege contra *path traversal*. |
| `NEBULA_READONLY` | `false` | Se `true`, bloqueia todas as requisições de escrita, criação de arquivos e execução de shell. |
| `GEMINI_API_KEY` | *Opcional* | Chave de API Google Gemini gerenciada no servidor para o assistente de código. |

---

## 💾 Persistência & Recuperação de Falhas

- Todo o estado do workspace (posição de cada janela, dimensões, degrau no eixo Z, z-index e estado de abas/notas) é salvo continuamente no **IndexedDB** local (`nebula_windows_state_v2`).
- Caso deseje restaurar o arranjo original de fábrica ou purgar estados legados, clique no **ícone de redefinição** (seta circular) na barra superior do workspace.

---

## 📄 Licença

Distribuído sob a licença **GNU General Public License v3.0 (GPLv3)**. Consulte o arquivo [LICENSE](LICENSE) para mais detalhes.

Software Livre: Você tem a liberdade de executar, estudar, modificar e redistribuir este software sob os termos da GNU GPLv3. Quaisquer trabalhos derivados devem obrigatoriamente manter o código aberto sob a mesma licença GPLv3.
