# Avaliação Geral de UX e Usabilidade: Nebula Workspace

O **Nebula Workspace** apresenta uma proposta ambiciosa e inovadora: um ambiente espacial 3D para gerenciamento de código, arquivos e automações. Com base na análise técnica do código fonte (focada nos componentes da interface, navegação 3D, gerenciamento de janelas e editor), apresento a seguinte avaliação heurística e de usabilidade.

---

## 1. Navegação Espacial 3D (Z-Depth, Pan & Zoom)

### Pontos Fortes
- **Paradigma Cognitivo Claro**: A divisão em 3 "Degraus" (Foco, Contexto, Arquivo) mapeados no eixo Z é um modelo mental muito forte. Reduz a confusão de janelas sobrepostas tradicionais.
- **Minimap Interativo**: O minimap (Mini-radar) no canto inferior é excelente. Permitir arrastar a "câmera" pelo minimap é um recurso vital para se orientar em workspaces muito grandes.
- **Atalhos Globais**: O uso das teclas numéricas (`1`, `2`, `3`) e `Esc` para transitar instantaneamente entre as camadas agiliza o fluxo de trabalho dos "power users".
- **Movimentação WASD**: O suporte a movimentação WASD (com aceleração via `Shift`) é amigável para usuários acostumados com interfaces de jogos 3D.

### Pontos de Melhoria (Fraquezas)
- **Descoberta de Atalhos (Discoverability)**: Os atalhos (WASD, 1-2-3, Pan com o mouse) não são imediatamente óbvios. Embora exista uma dica inicial (Tooltip) na inicialização, usuários que a fecham podem esquecer como navegar.
- **Conflito de Scroll/Zoom**: O zoom na roda do mouse (Wheel) pode conflitar se o usuário tentar dar zoom e o cursor estiver sobre uma área rolável (como uma div de código ou árvore de arquivos). O código tenta mitigar isso com verificações de `closest`, mas em interfaces complexas isso pode falhar ou gerar uma UX intermitente.
- **Escala e Perda de Contexto**: Se o usuário se afastar demais (zoom out máximo) em um espaço vazio, pode ser difícil encontrar o caminho de volta sem usar o botão de "Resetar Câmera".

---

## 2. Gerenciamento de Janelas e Interação (Occlusion Engine)

### Pontos Fortes
- **Oclusão Visual e Funcional**: A escolha arquitetural de transformar janelas em planos inferiores em "vidro fosco" inerte (`pointer-events: none`) resolve um enorme problema de 3D na web: cliques acidentais em botões que estão "atrás" visualmente, mas na frente no DOM.
- **Botão Rápido de Mudança de Plano**: O cabeçalho (header) das janelas inclui controles rápidos e claros (▲ e ▼) e botões de `D0`, `D1`, `D2`, permitindo que o usuário empurre ou puxe a janela no espaço 3D sem precisar arrastá-la.
- **Snap Magnético (Grudar)**: O recurso de snap para alinhar janelas auxilia muito na organização do espaço (layout tiling), algo crucial para desenvolvedores.
- **Pop-out Funcional**: A capacidade de destacar a janela (Pop-out) usando React Portals é um recurso avançado e muito desejado para setups multi-monitor.

### Pontos de Melhoria
- **Sutileza no Redimensionamento**: A alça de redimensionamento no canto inferior direito (`cursor-se-resize`) é muito pequena e não tem um hitbox estendido. Em telas de alta resolução, pode ser frustrante tentar "agarrar" os exatos 6x6 pixels para redimensionar.
- **Complexidade do Header**: O cabeçalho das janelas, especialmente em janelas menores, está muito cheio de botões (ícone, título, botões de profundidade, duplicar, pop-out, minimizar, maximizar, fechar). Isso pode causar cliques acidentais e poluição visual.

---

## 3. Experiência de Edição e IDE (Monaco Editor)

### Pontos Fortes
- **Menu Clássico de App**: A barra de menus nativa (Arquivo, Editar, View, Tools, Help) dentro da janela do editor proporciona uma familiaridade imediata de IDE tradicional (estilo VS Code).
- **Resolução de Bugs de UX (Theme Picker)**: Notado na leitura do código, o "Theme Picker Modal" foi corrigido para flutuar acima da interface e não sofrer "clipping" (`overflow-x-hidden`), demonstrando atenção a detalhes irritantes.
- **Tabs Independentes**: O suporte a abas independentes dentro do Monaco com indicação de caminhos melhora a organização de arquivos relacionados em um único cluster visual.

### Pontos de Melhoria
- **Menu Drops Contextuais**: Certificar-se de que os menus suspensos fechem automaticamente quando o usuário clica fora da janela ou inicia uma ação de arraste (Drag) 3D. A combinação de DOM 2D flutuante sobre um canvas 3D em movimento pode deixar "menus órfãos" visíveis de forma esquisita se não houver um `onBlur` global robusto.

---

## 4. Onboarding, Login e Segurança

### Pontos Fortes
- **Design de Autenticação Premium**: A tela de login (Gate) tem um design impecável, com gradientes ("Nebula glowing") e feedback visual imediato.
- **Facilidade de Teste**: Exibir explicitamente no frontend as "Credenciais Padrão" (admin/admin123) remove o atrito para novos usuários testarem a aplicação localmente.
- **Integração MFA Clara**: O fluxo de 2FA/TOTP com QR code embutido de forma contínua no processo de login transmite segurança e foco enterprise/devops.

---

## 5. Acessibilidade (A11y) e Consistência (Tailwind)

### Pontos Fortes
- **Consistência Visual**: A aplicação usa uma paleta muito rigorosa e coesa (Deep Space, azul neon `#3ba9ff`, teal `#5eead4`) via Tailwind, resultando em uma UI altamente profissional estilo "Cyber/Dev".
- **Gestão de Foco Oculto**: A inclusão de `tabIndex={isOccluded ? -1 : 0}` e `aria-hidden={isOccluded}` nas janelas ocluídas é uma excelente prática técnica. Impede que o teclado consiga acessar inputs de janelas que o usuário não pode interagir visualmente.

### Pontos de Melhoria
- **Falta de Atributos ARIA (Aria-labels)**: Diversos botões de controle das janelas dependem exclusivamente de seus ícones (Feather/Lucide Icons). Embora haja atributos `title`, falha-se na utilização extensa de `aria-labels` e roles semânticas.
- **Navegabilidade Exclusiva por Teclado**: Em um ambiente estritamente 3D, a navegação com teclado (Tab) para navegar pelas diferentes janelas no canvas é um desafio. Se houver janelas espalhadas, usar apenas `Tab` seguirá a ordem do DOM, não a ordem visual/espacial. Faltam recursos semânticos para pular direto para áreas de trabalho (Landmarks).

---

## 💡 Resumo de Recomendações e Próximos Passos (Actionables)

1. **Aumentar Hitbox de Redimensionamento**:
   - Aumente o *padding* invisível em volta do handler de redimensionamento no canto inferior direito das janelas.
2. **Despoluir Cabeçalhos (Header Clean-up)**:
   - Ocultar (ou diminuir opacidade) botões avançados (Duplicar, Pop-out, Move Depth) em janelas inativas, revelando-os 100% apenas em `hover`.
3. **Reforçar Feedback de Navegação**:
   - Para evitar que o usuário se perca, crie um atalho visível ou bússola que leve-o de volta à "Janela Ativa" se ela estiver fora do Viewport atual do canvas.
4. **Melhoria Crítica de Acessibilidade (A11y)**:
   - Revisar todos os `<button>` com ícones para adicionar `aria-label` descritivos, beneficiando leitores de tela e testes automatizados.