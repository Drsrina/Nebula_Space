# Nebula Workspace — Build 2.6.1 Features & Hardening

Documento de referência da Build 2.6.1, cobrindo a consolidação de qualidade, suíte de testes automatizados de integração/segurança, mitigação de vulnerabilidades e validação de container Docker Desktop.

---

## ✅ Entregas Concluídas na 2.6.1 (Eixo 1)

### 1. Suíte de Testes Automatizados (Node.js 24 Test Runner Nativo + tsx)
- Integração do script `npm test` usando o runner nativo `node --import tsx --test "tests/**/*.test.ts"`.
- Zero dependências pesadas adicionais de teste (aproveitamento do Node 24 + TSX já instalado).
- **20 testes automatizados** distribuídos em 4 suítes, rodando em **< 1 segundo**.

#### Suíte 1: Proxy Routes & Proteção contra SSRF (`tests/proxy.test.ts`)
- Rejeição de URLs sem parâmetro ou com formato inválido (400 Bad Request).
- Bloqueio de protocolos inseguros (`file:///etc/passwd`, `ftp://`, `javascript:`).
- Bloqueio de hosts de loopback (`localhost`, `127.0.0.1`, `::1`, `0.0.0.0`).
- Bloqueio de metadados de Cloud AWS e GCP (`169.254.169.254`, `metadata.google.internal`, `instance-data`).
- Bloqueio de faixas de IP privadas RFC 1918 (`10.0.0.0/8`, `172.16.0.0/12`, `192.168.0.0/16`).
- Bloqueio de domínios internos (`.local`, `.internal`).

#### Suíte 2: Crontab API & Path Traversal Protection (`tests/cron.test.ts`)
- Validação estrita de expressões cron via `node-cron` com rejeição de sintaxes inválidas (400).
- Rejeição de criação com campos obrigatórios ausentes (`name`, `expression`, `command`).
- Proteção contra Path Traversal em todos os endpoints parametrizados por `:id` (rejeitando `../../etc/passwd`, `..%2F..%2F`, etc.).
- Ciclo de vida CRUD completo (Create, List, Update, Run Now, Logs, Delete).
- Execução imediata (`POST /api/cron/jobs/:id/run`) com isolamento seguro de comandos e persistência de logs.

#### Suíte 3: Workflows Mini-n8n & SSE Streaming (`tests/workflows.test.ts`)
- Proteção contra Path Traversal em `:id` em rotas de leitura, gravação, exclusão, histórico e execução.
- CRUD completo de workflows persistidos em arquivos JSON em `data/workflows/`.
- Execução com streaming em tempo real via Server-Sent Events (`event: start`, `event: node`, `event: done`).
- Histórico de execuções persistido e limitado às últimas 50 execuções.
- Execução isolada de scripts JS em endpoint `/api/workflows/exec-js`.

#### Suíte 4: Motor de Execução de Workflows (`tests/workflow-engine.test.ts`)
- Ordenação topológica dos nós via algoritmo de Kahn.
- Execução de nó `trigger` com propagação de payload para downstream.
- Execução de nó `code-box` isolado em sandbox `node:vm`.
- Avaliação de nó `condition`: desvio correto entre ramos `true` e `false`, marcando os nós do ramo oposto como `skipped`.
- Tratamento resiliente de falhas: nó com erro marca status global como `partial` e permite continuidade dos nós independentes.
- Isolamento estrito de sandbox: garantia de que `process` e APIs do sistema não vazam para o contexto do usuário.

---

### 2. Validação Docker Compose & Persistência

- **Build Multi-stage**:
  - Imagem `nebula_gitv2-nebula:latest` compilada e empacotada usando Node 22 Alpine.
  - Otimização de camadas de build com `npm ci` para cacheamento.
- **Correção de Healthcheck IPv4 no Alpine**:
  - Ajuste de `localhost` para `http://127.0.0.1:3000/api/health` em `Dockerfile` e `docker-compose.yml`, resolvendo colisão com IPv6 `[::1]` no musl libc.
  - Container atingindo status **`Up (healthy)`** de forma contínua.
- **Persistência de Volumes**:
  - Subdiretórios `/data/workflows`, `/data/cron-logs`, `/data/plugins` e `/workspace` garantidos na imagem.
  - Bind mounts `./data` e `./workspace` validados: workflows criados persistem integralmente após `docker compose restart`.
- **Separação de Roots no Linux/Docker**:
  - Atualização em `security.ts` para suportar tanto `/data:/workspace` (dois-pontos em Linux) quanto vírgulas, mantendo compatibilidade com Windows (`C:\`).

---

## 📊 Matriz de Status dos Testes

| Suíte | Testes | Status | Duração |
|---|---|---|---|
| `proxy.test.ts` (SSRF & Security) | 7 | ✅ Pass | ~250ms |
| `cron.test.ts` (Crontab API & PT) | 4 | ✅ Pass | ~614ms |
| `workflow-engine.test.ts` (Kahn & Sandbox) | 4 | ✅ Pass | ~10ms |
| `workflows.test.ts` (CRUD & SSE) | 5 | ✅ Pass | ~735ms |
| **Total** | **20** | **100% Pass** | **< 1s** |
