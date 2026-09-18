# 🚀 Nebula Workspace - Build 2.5 (`feat2-5.md`)

Este documento confirma e detalha a execução completa das **duas etapas** planejadas para a **Build 2.5** do Nebula Workspace, focada em deploy robusto para VPS Linux, segurança com MFA por QR Code, controles de navegação 3D aperfeiçoados e Hub fixo personalizável.

---

## ✅ Status de Execução das Etapas

| Etapa | Foco Principal | Status |
|---|---|---|
| **Etapa 1** | Infraestrutura VPS Linux, Docker, Segurança Admin & MFA com QR Code | **CONCLUÍDA (100%)** |
| **Etapa 2** | Navegação Espacial (WASD + Shift), Controle de Angulação da Câmera, Hub Fixo Aninhado & Paleta Ctrl+P | **CONCLUÍDA (100%)** |

---

## 🛠️ Detalhamento da Etapa 1: Infraestrutura VPS & Segurança

### 1. Preparação para VPS Linux e Docker Compose
- **`Dockerfile`**: Imagem multi-stage de produção leve e segura construída com `node:22-alpine`, compilação estática do frontend (Vite) e empacotamento do backend (esbuild), executando com usuário desprivilegiado `nebula`.
- **`docker-compose.yml`**: Orquestração completa de containers com reinicialização automática (`unless-stopped`), mapeamento de portas (`3000:3000`), volumes persistentes para notas e dados locais, e injeção de variáveis de ambiente.
- **`.env.example`**: Modelo de variáveis de ambiente documentado para fácil configuração em servidores remotos (`NEBULA_ADMIN_PASSWORD`, `NEBULA_MFA_SECRET`, `JWT_SECRET`, etc.).
- **`deploy.sh`**: Script bash automatizado de um comando para provisionamento, build, atualização e inicialização em servidores Linux:
  ```bash
  bash deploy.sh
  ```

### 2. Autenticação Administrativa e MFA com QR Code (TOTP)
- **Backend (`server/lib/auth.ts` e `server/routes/authRoutes.ts`)**:
  - Hashing seguro de senhas com `bcryptjs`.
  - Assinatura e verificação de tokens JWT para sessões de administrador.
  - Implementação RFC 6238 de TOTP com biblioteca `otplib` (v13) e geração de QR Codes com `qrcode`.
  - Endpoints implementados:
    - `POST /api/auth/login`: Autentica senha de administrador do Docker/env e valida token TOTP.
    - `GET /api/auth/mfa-setup`: Gera chave secreta e QR Code DataURL para configuração em apps autenticadores (Google Authenticator, Microsoft Authenticator, Authy, 1Password, etc.).
    - `POST /api/auth/verify-totp`: Validação independente e instantânea de código de 6 dígitos.
- **Frontend (`src/components/windows/LoginWindow.tsx`)**:
  - Interface com 3 estágios visuais e transições suaves:
    1. **Entrada de Senha Master**: Validação contra o backend.
    2. **Código TOTP de 6 dígitos**: Inputs individuais com auto-focus e avanço automático ao digitar.
    3. **Setup de MFA com QR Code**: Exibição do QR Code escaneável e chave de texto manual para backup.

---

## 🎮 Detalhamento da Etapa 2: Navegação Espacial, Câmera, Hub e Ações

### 1. Navegação Espacial com WASD e Shift (2x Turbo)
- **Implementado em `src/components/Canvas3D.tsx`**:
  - Quando nenhuma janela de edição de texto ou formulário está com foco ativo (ou ao interagir com o fundo do canvas 3D), as teclas **W, A, S, D** movem a câmera tridimensional com suavidade pelo espaço infinito:
    - **W**: Move a câmera para cima / frente.
    - **S**: Move a câmera para baixo / trás.
    - **A**: Move a câmera para a esquerda.
    - **D**: Move a câmera para a direita.
  - Segurar a tecla **Shift** ativa o modo Turbo, dobrando a velocidade de movimentação da câmera (**2x Speed**).
  - Possui salvaguarda contra interceptação indevida quando o usuário estiver digitando no Monaco Editor, inputs ou textareas.

### 2. Ajuste Fino da Angulação da Câmera (Mouse Tilt)
- **Redução de 25% na sensibilidade padrão**: A inclinação tridimensional gerada pelo movimento do mouse foi reduzida em 25% para eliminar qualquer sensação de desorientação.
- **Controle Total via Configurações**:
  - Adicionado campo `tiltIntensity` (0.0 a 1.0) no Zustand store (`src/store/useCanvasStore.ts`).
  - Permite zerar completamente a angulação da câmera (intensidade = 0) para usuários que preferem visão totalmente plana/estática, ou calibrar ao seu gosto pessoal.

### 3. Hub Fixo Aninhado (TopBar Dropdowns)
- **Componente `src/components/HubDropdown.tsx` integrado ao `src/components/TopBar.tsx`**:
  - **🛠️ Ferramentas**: AI Chat, Git, Editor de Código, Terminal, Task Runner, Graph View, Docker Monitor.
  - **📁 Arquivos**: Navegador de Pastas/Arquivos e Criar Nova Nota.
  - **⚡ Ações**: Organizar Janelas em Grade, Resetar Câmera, Alternar Grid Cósmico, Alternar Modo Foco, Alternar Tela Cheia.

### 4. Recurso "Fixar no Hub" (Pin Window)
- Cada janela aberta pode ser fixada na barra superior do Hub através do botão de fixação (ícone de alfinete/pin) ou via menu de contexto.
- Janelas fixadas aparecem como abas/botões de acesso rápido integrados diretamente ao Hub central, permitindo minimizar, restaurar ou trazer ao foco imediato com um único clique.

### 5. Paleta de Comandos (`Ctrl+P`) Turbinada
- **`src/components/windows/LauncherWindow.tsx`**:
  - Além da pesquisa difusa (fuzzy search) de arquivos do workspace, a paleta de comandos `Ctrl+P` agora suporta comandos e ações do sistema:
    - Comandos de layout e organização de janelas.
    - Abertura rápida de qualquer ferramenta do sistema.
    - Comandos de reset e ajuste de visualização da câmera.
    - Ações de autenticação e configuração.
  - Suporta navegação por setas do teclado e execução imediata com `Enter`.

---

## 🧪 Validação Técnica Realizada

1. **TypeScript Type Check**: `tsc --noEmit` executado sem erros (código 0).
2. **Vite Production Build**: Compilação de frontend minificado em `dist/assets/` bem-sucedida.
3. **Backend Server Bundle**: `server.ts` empacotado para `dist/server.cjs` via `esbuild` sem falhas.
4. **Git Version Control**: Alterações consolidadas e commitadas no branch `vscode-nebula`.

---

## 🚢 Como Testar e Subir em VPS Linux

```bash
# 1. No servidor Linux VPS:
git clone <URL_DO_REPOSITORIO>
cd nebula_git/nebula_gitv2

# 2. Configurar variáveis de ambiente:
cp .env.example .env
nano .env   # Defina NEBULA_ADMIN_PASSWORD e NEBULA_MFA_SECRET

# 3. Executar o script de deploy automatizado:
bash deploy.sh

# 4. Acessar no navegador:
# http://<IP_DO_SERVIDOR>:3000
```
