## [2.7.5] - 2026-09-23

### Fixed
- Reset de câmera agora centraliza nas bounding boxes das janelas ativas em Degrau 0 quando vazio
- Botão "Desencaixar" separa corretamente janelas agrupadas mantendo coordenadas visuais e desencaixe em cascata
- Zoom do mouse centrado no cursor mantendo o ponto focal estacionário na tela
- Pasta raiz do container lista arquivos próprios e diferencia raízes configuradas de subdiretórios
- Busca global movida para command palette centralizada em overlay fixo com portal React, atalhos Ctrl+P e Ctrl+Shift+P

### Added
- Opções de arquivo no editor de notas (Salvar como, Renomear, Exportar HTML/PDF/MD, Fechar, Mostrar no explorador)
- Opções VS Code-like no editor de código (Salvar como Ctrl+Shift+S, Reverter alterações, Fechar outras/todas abas, Ir para linha Ctrl+G, Alternar word wrap Alt+Z, Formatar documento Shift+Alt+F, Encoding UTF-8/Latin-1, Line endings LF/CRLF, Copiar caminhos)
- Componente compartilhado e reutilizável `<EditorHeader>`

### Commits
- c8646f2 fix(fs): list children of root paths in file browser
- feaccb8 fix(attach): detach windows correctly
- 3bd661a fix(camera): zoom centered on mouse cursor
- f5224ec fix(camera): center reset on window bounds
- c549b8e fix(palette): move global search to fixed command palette overlay
- a37cc41 feat(notes): add file options to note editor
- b4a890c feat(editor): add save as and advanced vscode-like options
