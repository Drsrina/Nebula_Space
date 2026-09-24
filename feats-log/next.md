1. Próximos Passos Imediatos: Estabilidade & DevOps (v2.7.6 / Quick Wins)
GitHub Actions (CI Automatizado):
Configurar workflow de CI (.github/workflows/ci.yml) para rodar npm test, npm run lint e npm run build em todo push e Pull Request. Como o repositório agora é público, isso protege a branch main de regressões.
Desacoplamento de Imports Circulares do Bundler:
Resolver os avisos de build do Vite em useEditorStore.ts (que faz import() dinâmico de useFSStore e useWindowsStore enquanto outros módulos os importam estaticamente). Podemos extrair eventos leves (window.dispatchEvent ou callbacks) para deixar o grafo de módulos 100% limpo.
Backup & Restore do Workspace (.nebula.json):
Criar uma opção em Configurações / TopBar para exportar e importar o estado completo do workspace (janelas abertas, posições 3D, notas salvas no IndexedDB, crontabs locais) em um único arquivo JSON. Isso permite migrar entre navegadores sem perder o setup.

adicionalmente
o botao desencaixar ainda nao solta a janela ou nao fasta ela definitivamente, oque resulta em que ela esteja sempre grudada, vamos povoar as configurações globais, dentro do frontend/  ux de configurações globais nao há nada, nenhum botao e devemos preencher lá, a começar pela op~ção de ativar ou desativar o encaixe e agrupamento de janelas - coloque um botao toggle



2. Produtividade & Cloud IDE: O Salto para v2.8.0
Terminal Web Interativo Real (xterm.js + node-pty via WebSocket):
Hoje temos o Task Runner (execução de scripts do package.json).
Adicionar uma janela de Terminal Web Real conectada a uma sessão de shell (/bin/bash ou sh dentro do container Docker) transformaria o Nebula em um ambiente de desenvolvimento completo e autossuficiente no navegador.
Git Sync Remoto (Push, Pull, Fetch):
O painel Git atual faz stage, unstage, commit, diff e log local.
Adicionar suporte a git push e git pull com suporte a autenticação por Personal Access Token (PAT) ou chaves SSH configuráveis.
Layout Presets Espaciais (Workspaces Salvos):
Permitir salvar "cenas" completas de janelas nos 3 degraus:
Ex: Preset "Coding": Editor no D0, Diff no D1, Git Panel no D2.
Ex: Preset "Review/Notes": Duas notas lado a lado no D0, File Browser no D1.
Alternar entre presets em 1 clique ou via Command Palette (Ctrl+P).

adicionalmennte
mudar o nome git e forgejo para apenas git e versionamento, ou algo do genero.
vamos avançar nesta parte para garantir que o sistema de git permita gerenciamento de multiplos repositorios e vamos garantir conexão com forgejo, github e gitlab.
atualmente falta opções no git para subdivirmos os respositorios e termos maior controle, assim como o github desktop faz


3. Workflow Engine (Mini-Workflows) & Automação [x CONCLUÍDO na v2.8.0 - ver feats-log/feat2-8-0.md]
- [x] Renomeação completa de Mini-n8n para Mini-Workflows.
- [x] Encadeamento de I/O de nós ($input, $json, items, $prev) e interpolação de templates {{ $json.prop }}.
- [x] Nó HTTP Request com chamadas reais externas e repasse de $json para nós seguintes (Code-Box JS/Py).
- [x] Gerenciamento de arquivos de workflow: Salvar, No Workspace (/workflows/), Exportar JSON, Importar JSON e Gaveta de Workflows.
- [x] Gatilhos reais integrados com o Crontab a partir de nós Trigger (modo cron) e no CrontabWindow.
- [x] Backup, Exportação e Importação de Crontab (JSON e Workspace).
- [x] Auto-descoberta no Task Runner (.py, .sh, .js), status ativo e botão de parada.
- [x] Script utilitário scripts/timestamp_logger.py e notas de tutorial para novos usuários.



4. Documentação & Comunidade Open-Source
Template docker-compose.yml Pronto para Uso:
Disponibilizar na raiz um docker-compose.yml bem documentado com montagem de volumes (./workspace:/data), mapeamento de portas e variáveis (NEBULA_ROOTS, NEBULA_PASSWORD, NEBULA_MFA_SETUP).
Atualização do README e Screenshots/GIFs da 2.7.5:
Atualizar os Readmes (EN e PT-BR) destacando os novos recursos: Command Palette (Ctrl+P), editor de notas com exportação HTML/PDF/MD, editor de código avançado e navegação 3D aperfeiçoada.

adicionalmente sobre segurança - mfa nao deve estar na tela de loguin mas sim nas configs glovais -ainda nao temos opções de ativar, desativar ou configurar o mfa corretamente, vamos adicionar isso nas configurações globais, junto com uma opcao de desativar mfa ou remover dispositivos de mfa - adicionalmente verifique o codigo que gera o qr code pois parece quebrado- alem de adicionarmos a opcao de alterar senha no painel de config global 

avalie a utilidade - subir sub containers com python, nodejs ts js junto com o nebula - poderia ajudar na função principal de construir e rodar codigo e automações?

