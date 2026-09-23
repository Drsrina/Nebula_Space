# Nebula Workspace — Build 2.6 Features

Documento de referência da Build 2.6, incluindo features planejadas, escopo e decisões de implementação.

## ✅ Features Confirmadas para a 2.6

### CORREÇÃO CRÍTICA — Multi-Instance Windows
- Abrir múltiplas janelas do mesmo tipo (editor, terminal, file-browser).
- Badge de instância no título (`Editor #2`, `Terminal #3`).
- Botão "Duplicar Janela" no header.

### CORREÇÃO CRÍTICA — Attach / Snap Magnético
- Janelas se encaixam como ímãs ao arrastar próximo (<40px de distância).
- Guia visual de snap (linha de alinhamento estilo Figma).
- Grupos de janelas snapped se movem juntas.

### NOVA — Pop-out Windows (React Portals + BroadcastChannel)
- Qualquer janela pode ser "destacada" para uma nova aba do browser.
- Estado sincronizado bidirecionalmente via `BroadcastChannel`.
- Canvas principal exibe fantasma da janela com badge `↗`.
- Estilos Tailwind injetados automaticamente no `<head>` da janela pop-out.

### NOVA — Mini-n8n (Workflow Canvas Window)
- Canvas 2D interno com nós draggáveis e conexões Bezier SVG.
- **Nós Fase 1:** Trigger (manual/webhook/cron), HTTP Request, Code Box (JS sandboxado), Condition (if/else), Log/Output.
- Execução em tempo real via SSE com highlight do nó atual.
- Histórico das últimas 50 execuções por fluxo.
- Persistência: IndexedDB (local) + `/api/workflows` (servidor).
- Motor inspirado no n8n (repositório de referência em `n8n-master/`).

### NOVA — Crontab (Agendador de Execuções)
- Lista de jobs: nome, expressão cron, status do último run.
- Criar/editar/pausar/deletar jobs.
- Log de cada execução (stdout, stderr, exit code, duração).
- Executar manualmente ("Run Now").
- Integração com Mini-n8n: nó Trigger→Cron usa o mesmo motor.
- Backend usa `node-cron`.

### NOVA — Minimap do Canvas
- Canto inferior direito, fixo na viewport.
- Todas as janelas representadas em miniatura, coloridas por depth.
- Retângulo mostrando posição atual da câmera.
- Clique para navegar.

### NOVA — Snippets Window
- CRUD de trechos de código com nome, tag, linguagem.
- Busca rápida.
- Inserir diretamente no Monaco Editor ativo com um clique.

### NOVA — Kanban / Todo Window
- Colunas configuráveis (padrão: Todo, In Progress, Done).
- Cards arrastáveis entre colunas.
- Cards com título, descrição, link para arquivo ou nota Nebula.

### NOVA — PDF / Image Viewer Window
- PDFs via PDF.js (CDN, sem dependência npm).
- Imagens com zoom/pan.
- Roteamento automático por extensão de arquivo.

### NOVA — Web Embed Window
- Iframe com barra de URL editável.
- Reload, histórico de navegação.
- Útil para documentação, Grafana, Jira, etc.

### NOVA — API Client Window (mini-Postman)
- Método, URL, headers, body.
- Resposta com syntax highlight.
- Coleções salvas em IndexedDB.
- Proxy backend para evitar CORS.

### NOVA — Live Preview Split
- Split horizontal dentro do Editor: código + preview.
- Markdown renderizado / HTML em iframe.

### NOVA — Plugin System (Fase 1)
- Endpoint `/api/plugins` lista plugins em `/plugins` no servidor.
- API frontend: `registerWindowType`, `registerCommand`, `registerHubItem`.
- Plugin de exemplo `hello-world` incluído.

---

## 📦 Novos Pacotes NPM

| Pacote | Uso |
|---|---|
| `node-cron` | Agendador de jobs cron no backend |
| `@types/node-cron` | Tipos TypeScript |

---

## 🏗️ Etapas de Implementação

| Etapa | Conteúdo | Status |
|---|---|---|
| **1** | Multi-instance windows + Attach Snap magnético (<40px, guias e grupos) | ✅ Concluído |
| **1b** | Pop-out Windows (React Portals + BroadcastChannel + style injection) | ✅ Concluído |
| **2** | Mini-n8n Workflow Engine (persistência JSON no servidor) + Crontab (node-cron) | ✅ Concluído |
| **3** | Minimap, Snippets, Kanban com checklist, PDF Viewer, Web Embed, API Client com Proxy, Live Preview Split, Plugin System | ✅ Concluído |

---

## ⚠️ Fora do Escopo da 2.6

- Nós de integração pronta no n8n (Slack, Discord, Telegram) → v2.7+
- Sandbox Python → v2.7+ (v2.6: apenas JS via `node:vm`)
- Credenciais criptografadas → v2.7+
- Retries automáticos de workflows → v2.7+
- Agendamento visual por calendário → v2.7+
- Watch Mode / Live Sync Indicator → v2.7+
