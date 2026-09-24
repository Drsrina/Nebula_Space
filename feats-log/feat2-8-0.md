# Nebula Space — Versão 2.8.0
**Data:** 24 de Setembro de 2026  
**Foco:** Workflow Engine (Mini-Workflows), I/O Encadeado de Nós, Integração Real com Crontab, Gerenciamento de Arquivos no Workspace, Auto-Descoberta de Scripts no Task Runner e Tutorial para Novos Usuários

---

### 1. Renomeação do Sistema de Workflows
- Transição completa da nomenclatura anterior "Mini-n8n" para **Mini-Workflows** na UI e na arquitetura.
- Atualizado na **TopBar** (`Mini-Workflows`), na **Command Palette** (`Abrir Mini-Workflows`), nos seletores do Crontab e nas rotas de documentação.

---

### 2. Motor de Execução e I/O Encadeado ($input, $json, items)
- **Topologia de Dados**: A saída de qualquer nó predecessor conectado a um nó sucessor agora é injetada automaticamente como entrada.
- **Variáveis de Contexto Padronizadas**:
  - `$input` / `$prev`: Representação crua da saída do nó anterior.
  - `$json`: Extração direta do payload JSON (para nós HTTP Request que retornam `{ status, body }`, `$json` expõe imediatamente o corpo deserializado).
  - `items`: Lista de itens estilo n8n (`Array.isArray($json) ? $json : [$json]`).
  - `$trigger` / `trigger`: Dados do gatilho inicial persistidos ao longo do fluxo.
- **Interpolação Dinâmica de Templates**:
  - URLs, corpos de requisição e mensagens de log agora suportam interpolação automática usando sintaxe de chaves duplas: `{{$json.chave}}`, `{{$input.id}}` ou `{{trigger.param}}`.
- **Nó HTTP Request**:
  - Faz chamadas reais externas (GET, POST, PUT, DELETE, PATCH).
  - Se nenhum corpo for explicitado em métodos POST/PUT/PATCH, repassa automaticamente o `$json` recebido do nó anterior.
- **Code Box (JavaScript & Python)**:
  - Nós JS em sandbox têm acesso a `$input`, `$json`, `items`, `trigger` e `response`.
  - Nós Python recebem `input_data`, `json_data`, `items` e `trigger` via subprocesso com serialização e retorno via JSON.

---

### 3. Gerenciamento Completo de Arquivos de Workflow
- **Persistência Real**: Corrigida a autenticação no frontend utilizando `authFetch` com headers JWT unificados, eliminando falhas silenciosas de salvamento.
- **Feedback Visual Instantâneo**: Adicionado toast verde flutuante de sucesso após cada operação.
- **Opções de Gerenciamento**:
  - **Salvar**: Salva e atualiza o workflow ativo no backend (`/api/workflows/:id`).
  - **No Workspace**: Grava o workflow diretamente como arquivo JSON em `workflows/<nome>.json` no sistema de arquivos do projeto, permitindo versionamento Git e visualização no Navegador de Arquivos.
  - **Exportar JSON**: Faz download imediato do arquivo `.json` no navegador do usuário.
  - **Importar JSON**: Permite carregar qualquer arquivo `.json` de automação para o canvas interativo.
  - **Gaveta de Workflows**: Permite listar, abrir, inspecionar e deletar workflows salvos no servidor com um clique.

---

### 4. Conexões Visuais e Abas de Inspeção de Nós
- **Portas de Conexão no Canvas**:
  - Porta de entrada na borda esquerda do nó.
  - Porta de saída na borda direita do nó.
  - Clicar na porta de saída ativa o modo de conexão e destaca os nós de destino.
  - Conexões existentes contam com área de interação ampliada e botão de exclusão rápida ao passar o mouse.
- **Painel Lateral com 3 Abas**:
  1. **Configuração**: Parâmetros específicos do nó, lista de conexões ativas de entrada/saída e botão rápido para ligar a outro nó.
  2. **Entrada ($input)**: Visualizador JSON dos dados recebidos do nó anterior com botão de cópia.
  3. **Saída ($output)**: Visualizador JSON dos dados produzidos na última execução com status e botão de cópia.

---

### 5. Gatilhos Reais Integrados com o Crontab
- **Agendamento a partir de Workflows**:
  - Nós do tipo `trigger` com modo `cron` agora contam com seleção de expressões (`0 8 * * *`, `*/5 * * * *`) e botão **"Agendar no Crontab"**, registrando o workflow diretamente no agendador do servidor.
- **Melhorias no Crontab**:
  - Autenticação padronizada com `authFetch`.
  - Seletor de Tipo de Gatilho: **Disparar Mini-Workflow** (dropdown listando workflows existentes) vs **Comando Shell**.
  - No histórico e lista de jobs, workflows vinculados recebem etiqueta estilizada em vez de texto bruto.
  - Botões para **Salvar Backup no Workspace**, **Exportar Crontab (JSON)** e **Importar Crontab (JSON)**.

---

### 6. Auto-Descoberta no Task Runner e Tutorial com `timestamp_logger.py`
- **Auto-descoberta Recursiva**: O Task Runner detecta scripts `.py`, `.sh` e `.js` no workspace e na pasta `scripts/`.
- **Monitoramento de Tarefas Ativas**: Visualização de tarefas em execução com contador e botão de interrupção forçada (**■ Parar**).
- **Script de Exemplo para Novos Usuários**:
  - Criado `scripts/timestamp_logger.py` com pulsos de log formatados com data e hora.
  - Criada documentação e nota inicial de tutorial no Degrau 2 do workspace (`notes/automacao_tutorial.md` e em `useWindowsStore.ts`).
