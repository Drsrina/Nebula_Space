# Nebula Workspace v2.8.1 — Release & Changelog

## 🚀 Novidades e Melhorias da Versão 2.8.1

### 1. 🏗️ Sub-Containers Leves para VPS (Opcionais via Docker Compose Profiles)
- **Abordagem padrão ultra-leve**: container principal otimizado para servidores modestos e VPSs compactas (~1GB de RAM).
- **Sidecar Runners opcionais**: runners isolados de Python (`runner-python`) e Node.js (`runner-node`) foram configurados com `profiles: ["runners"]`.
- Não consomem CPU nem RAM por padrão; para ativá-los em VPS maiores, basta rodar:
  ```bash
  docker compose --profile runners up -d
  ```
- Mapeamento pronto e seguro do socket Docker (`/var/run/docker.sock`) descomentado e documentado.

---

### 2. 🌳 Window Graph: Árvore Visual de Pastas em Node Graph
- **Leitura da Raiz**: escaneia recursivamente as pastas do workspace ativo usando `useFSStore.readDir`.
- **Node Graph Conectado**: renderização SVG de nós hierárquicos com curvas Bézier conectando pastas pai e filhas.
- **Navegação Direta no Clique**: clicar em qualquer nó de pasta abre instantaneamente o Explorador de Arquivos (`file-browser`) já posicionado e navegando dentro daquela pasta.
- **Lazy Loading**: integrado ao `Window.tsx` com `React.lazy` para carregamento rápido sob demanda.

---

### 3. 🧹 HUD Inferior Mais Clean
- Removido o card inferior com dicas de teclas e pan de fundo ("Pan: arraste o fundo - degraus teclas 1 2 3 - arrastar janelas").
- Removido o seletor flutuante de planos ("Plano: 0 foco 1 contexto 2 arquivo").
- A viewport agora fica livre de poluição visual, mantendo a experiência espacial limpa e moderna.

---

### 4. 🌐 Navegador Web Interno Efetivo (Proxy com Suporte a Redirects)
- **Seguimento de Redirects (301, 302, 307, 308)**: o proxy backend `/api/proxy/web` agora segue até 3 redirecionamentos com validação estrita anti-SSRF em cada salto.
- **Anti-Framebusting & CSP Stripping**: cabeçalhos restritivos como `x-frame-options` e `content-security-policy` são removidos para permitir exibição correta no iframe do Nebula.
- **Injeção de `<base href>`**: links relativos de CSS e imagens passam a carregar sem quebra.
- **DuckDuckGo HTML Embutido**: busca nativa amigável para iframes, com atalhos diretos para DevDocs, MDN, Wikipedia, GitHub e npm.

---

### 5. 🐳 Docker Monitor Híbrido Conectado
- **Detecção Real de Containers**: suporte a Linux (`/var/run/docker.sock`), Windows Named Pipe (`//./pipe/docker_engine`) e fallback automático para Docker CLI (`docker ps -a`).
- **Gerenciamento de Ciclo de Vida**: botões de iniciar, pausar/parar e reiniciar containers.
- **Visualizador de Logs em Tempo Real**: modal embutido para inspecionar saídas de stdout/stderr de qualquer container do sistema.
- **Status do Daemon**: banner indicando se a Docker Engine está conectada ou ausente.

---

### 6. 📋 Kanban com Sub-Tarefas Robustas
- **Sub-tarefas Reais e Persistentes**: funcionalidade completa de adicionar, alternar estado concluído, renomear in-place e excluir sub-tarefas individualmente.
- **Barra de Progresso Percentual**: indicador dinâmico do percentual de conclusão das sub-tarefas em cada card.
- **Níveis de Prioridade**: badges visuais neon (Baixa, Média, Alta, Urgente).
- **Persistência Completa**: dados salvos no `localStorage` sob a chave `nebula_kanban_boards`.

---

### 7. 🎨 Temas Globais do Workspace & CSS Personalizado
- **3 Modos Globais**:
  - **Dark (Deep Space)**: tema clássico escuro cyberpunk com vidro azul/ciano.
  - **Light (Nebula Day)**: tema claro refinado para ambientes iluminados e leitura diurna.
  - **Personalizado**: cores de realce customizáveis com injeção de CSS em tempo real.
- **Paleta de Destaques (Accent Colors)**:
  - Nebula Cyan (`#5eead4`)
  - Cobalt Deep Blue (`#3ba9ff`)
  - Neon Synthwave Purple (`#c084fc`)
  - Matrix Emerald (`#34d399`)
  - Solar Flare Amber (`#fbbf24`)
  - Cyber Sakura Rose (`#fb7185`)
- **Editor de Folha de Estilos Customizada (CSS)**:
  - Injeção em tempo real no documento via tag `<style id="nebula-custom-user-css">`.
  - Botão de upload para importar qualquer arquivo `.css` local do computador.
  - Botão de carregamento de exemplos prontos e botão de limpeza.
  - Chave de ativação/desativação instantânea (toggle).

---

### 8. 🛡️ Qualidade & Confiabilidade
- **100% dos testes unitários passando**: 74 testes automatizados em 16 suítes com 0 falhas.
- **Zero erros no bundle de produção**: TypeScript e Vite gerando pacotes otimizados.
