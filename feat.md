## [2.7.5] - 2026-09-23

### Fixed
- Reset de câmera agora centraliza nas bounding boxes das janelas (#camera-reset)
- Botão "Desencaixar" separa corretamente janelas agrupadas (#unsnap)
- Zoom do mouse centrado no cursor (#cursor-zoom)
- Pasta raiz do container lista arquivos próprios (#fs-root)
- Busca global movida para command palette centralizada (#command-palette)

### Added
- Opções de arquivo no editor de notas (Salvar como, Renomear, Exportar)
- Opções VS Code-like no editor de código (Ir para linha, Word wrap, etc.)

### Commits
- c8646f2 fix(fs): list children of root paths in file browser
- feaccb8 fix(attach): detach windows correctly
- 3bd661a fix(camera): zoom centered on mouse cursor
- f5224ec fix(camera): center reset on window bounds
- c549b8e fix(palette): move global search to fixed command palette overlay
- a37cc41 feat(notes): add file options to note editor
- b4a890c feat(editor): add save as and advanced vscode-like options
