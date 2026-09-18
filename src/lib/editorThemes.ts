export interface EditorThemeConfig {
  id: string;
  name: string;
  badgeColor: string;
  definition: {
    base: 'vs-dark';
    inherit: boolean;
    rules: { token: string; foreground: string; fontStyle?: string }[];
    colors: Record<string, string>;
  };
}

export const EDITOR_THEMES: EditorThemeConfig[] = [
  {
    id: 'nebula-dark',
    name: 'Nebula Deep Space',
    badgeColor: '#3ba9ff',
    definition: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '526e8f', fontStyle: 'italic' },
        { token: 'keyword', foreground: '3ba9ff', fontStyle: 'bold' },
        { token: 'string', foreground: '5eead4' },
        { token: 'number', foreground: 'f59e0b' },
        { token: 'type', foreground: 'a78bfa' },
        { token: 'function', foreground: '60a5fa' },
        { token: 'variable', foreground: 'e2edff' },
        { token: 'operator', foreground: '38bdf8' },
      ],
      colors: {
        'editor.background': '#070c18',
        'editor.foreground': '#d1e0f5',
        'editor.lineHighlightBackground': '#0f1b33',
        'editorLineNumber.foreground': '#3e5473',
        'editorLineNumber.activeForeground': '#5eead4',
        'editor.selectionBackground': '#3ba9ff33',
        'editor.inactiveSelectionBackground': '#3ba9ff18',
        'editorCursor.foreground': '#5eead4',
        'editorIndentGuide.background': '#13213d',
        'editorIndentGuide.activeBackground': '#223861',
        'scrollbarSlider.background': '#1b2c4d66',
        'scrollbarSlider.hoverBackground': '#3ba9ff44',
        'scrollbarSlider.activeBackground': '#5eead466',
      },
    },
  },
  {
    id: 'tokyo-night',
    name: 'Tokyo Night',
    badgeColor: '#7aa2f7',
    definition: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '565f89', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'bb9af7', fontStyle: 'bold' },
        { token: 'string', foreground: '9ece6a' },
        { token: 'number', foreground: 'ff9e64' },
        { token: 'type', foreground: '2ac3de' },
        { token: 'function', foreground: '7aa2f7' },
        { token: 'variable', foreground: 'c0caf5' },
        { token: 'operator', foreground: '89ddff' },
      ],
      colors: {
        'editor.background': '#1a1b26',
        'editor.foreground': '#a9b1d6',
        'editor.lineHighlightBackground': '#24283b',
        'editorLineNumber.foreground': '#414868',
        'editorLineNumber.activeForeground': '#7aa2f7',
        'editor.selectionBackground': '#515c7e44',
        'editor.inactiveSelectionBackground': '#515c7e22',
        'editorCursor.foreground': '#7aa2f7',
        'editorIndentGuide.background': '#292e42',
        'editorIndentGuide.activeBackground': '#3b4261',
        'scrollbarSlider.background': '#292e4266',
        'scrollbarSlider.hoverBackground': '#7aa2f744',
        'scrollbarSlider.activeBackground': '#7aa2f766',
      },
    },
  },
  {
    id: 'one-dark-pro',
    name: 'One Dark Pro',
    badgeColor: '#61afef',
    definition: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '5c6370', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'c678dd', fontStyle: 'bold' },
        { token: 'string', foreground: '98c379' },
        { token: 'number', foreground: 'd19a66' },
        { token: 'type', foreground: 'e5c07b' },
        { token: 'function', foreground: '61afef' },
        { token: 'variable', foreground: 'abb2bf' },
        { token: 'operator', foreground: '56b6c2' },
      ],
      colors: {
        'editor.background': '#21252b',
        'editor.foreground': '#abb2bf',
        'editor.lineHighlightBackground': '#2c313a',
        'editorLineNumber.foreground': '#4b5263',
        'editorLineNumber.activeForeground': '#61afef',
        'editor.selectionBackground': '#3e445166',
        'editor.inactiveSelectionBackground': '#3e445133',
        'editorCursor.foreground': '#528bff',
        'editorIndentGuide.background': '#2d3139',
        'editorIndentGuide.activeBackground': '#3b4048',
        'scrollbarSlider.background': '#4e566644',
        'scrollbarSlider.hoverBackground': '#61afef44',
        'scrollbarSlider.activeBackground': '#61afef66',
      },
    },
  },
  {
    id: 'dracula-neon',
    name: 'Dracula Neon',
    badgeColor: '#bd93f9',
    definition: {
      base: 'vs-dark',
      inherit: true,
      rules: [
        { token: 'comment', foreground: '6272a4', fontStyle: 'italic' },
        { token: 'keyword', foreground: 'ff79c6', fontStyle: 'bold' },
        { token: 'string', foreground: 'f1fa8c' },
        { token: 'number', foreground: 'bd93f9' },
        { token: 'type', foreground: '8be9fd' },
        { token: 'function', foreground: '50fa7b' },
        { token: 'variable', foreground: 'f8f8f2' },
        { token: 'operator', foreground: 'ff79c6' },
      ],
      colors: {
        'editor.background': '#1e1f29',
        'editor.foreground': '#f8f8f2',
        'editor.lineHighlightBackground': '#282a36',
        'editorLineNumber.foreground': '#6272a4',
        'editorLineNumber.activeForeground': '#50fa7b',
        'editor.selectionBackground': '#44475a88',
        'editor.inactiveSelectionBackground': '#44475a44',
        'editorCursor.foreground': '#ff79c6',
        'editorIndentGuide.background': '#2b2d3c',
        'editorIndentGuide.activeBackground': '#44475a',
        'scrollbarSlider.background': '#44475a66',
        'scrollbarSlider.hoverBackground': '#bd93f944',
        'scrollbarSlider.activeBackground': '#bd93f966',
      },
    },
  },
];
