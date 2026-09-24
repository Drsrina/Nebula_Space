import { create } from 'zustand';

export type ThemeMode = 'dark' | 'light' | 'custom';

export type AccentPreset = 'cyan' | 'blue' | 'purple' | 'emerald' | 'amber' | 'rose';

export interface AccentColorDef {
  id: AccentPreset;
  name: string;
  primary: string;
  glow: string;
  border: string;
  rgb: string;
}

export const ACCENT_PRESETS: Record<AccentPreset, AccentColorDef> = {
  cyan: {
    id: 'cyan',
    name: 'Nebula Cyan (Padrão)',
    primary: '#5eead4',
    glow: 'rgba(94, 234, 212, 0.4)',
    border: 'rgba(94, 234, 212, 0.3)',
    rgb: '94, 234, 212',
  },
  blue: {
    id: 'blue',
    name: 'Cobalt Deep Blue',
    primary: '#3ba9ff',
    glow: 'rgba(59, 169, 255, 0.4)',
    border: 'rgba(59, 169, 255, 0.3)',
    rgb: '59, 169, 255',
  },
  purple: {
    id: 'purple',
    name: 'Neon Synthwave Purple',
    primary: '#c084fc',
    glow: 'rgba(192, 132, 252, 0.4)',
    border: 'rgba(192, 132, 252, 0.3)',
    rgb: '192, 132, 252',
  },
  emerald: {
    id: 'emerald',
    name: 'Matrix Emerald',
    primary: '#34d399',
    glow: 'rgba(52, 211, 153, 0.4)',
    border: 'rgba(52, 211, 153, 0.3)',
    rgb: '52, 211, 153',
  },
  amber: {
    id: 'amber',
    name: 'Solar Flare Amber',
    primary: '#fbbf24',
    glow: 'rgba(251, 191, 36, 0.4)',
    border: 'rgba(251, 191, 36, 0.3)',
    rgb: '251, 191, 36',
  },
  rose: {
    id: 'rose',
    name: 'Cyber Sakura Rose',
    primary: '#fb7185',
    glow: 'rgba(251, 113, 133, 0.4)',
    border: 'rgba(251, 113, 133, 0.3)',
    rgb: '251, 113, 133',
  },
};

interface ThemeState {
  themeMode: ThemeMode;
  accent: AccentPreset;
  customCss: string;
  customCssEnabled: boolean;
  setThemeMode: (mode: ThemeMode) => void;
  setAccent: (accent: AccentPreset) => void;
  setCustomCss: (css: string) => void;
  setCustomCssEnabled: (enabled: boolean) => void;
  applyTheme: () => void;
}

const STORAGE_KEY = 'nebula_global_theme_settings';

const loadSavedTheme = (): Partial<ThemeState> => {
  if (typeof localStorage === 'undefined') return {};
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {
    // fallback
  }
  return {};
};

const saveTheme = (state: {
  themeMode: ThemeMode;
  accent: AccentPreset;
  customCss: string;
  customCssEnabled: boolean;
}) => {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // ignore
  }
};

export const useThemeStore = create<ThemeState>((set, get) => {
  const initial = loadSavedTheme();
  const defaultMode: ThemeMode = (initial.themeMode as ThemeMode) || 'dark';
  const defaultAccent: AccentPreset = (initial.accent as AccentPreset) || 'cyan';
  const defaultCustomCss =
    initial.customCss !== undefined
      ? initial.customCss
      : `/* Custom CSS do Nebula Workspace */
/* Exemplo: estilize janelas ou botões conforme desejar */
/*
.window-container {
  backdrop-filter: blur(20px);
}
*/`;
  const defaultCustomCssEnabled = initial.customCssEnabled ?? false;

  const applyThemeToDOM = (
    mode: ThemeMode,
    accentPreset: AccentPreset,
    css: string,
    cssEnabled: boolean
  ) => {
    if (typeof document === 'undefined') return;

    const body = document.body;
    const accentDef = ACCENT_PRESETS[accentPreset] || ACCENT_PRESETS.cyan;

    // 1. Atualizar classes de tema no body
    body.classList.remove('theme-dark', 'theme-light', 'theme-custom');
    body.classList.add(`theme-${mode}`);

    // 2. Injetar Variáveis CSS Globais
    let varStyle = document.getElementById('nebula-theme-vars') as HTMLStyleElement | null;
    if (!varStyle) {
      varStyle = document.createElement('style');
      varStyle.id = 'nebula-theme-vars';
      document.head.appendChild(varStyle);
    }

    varStyle.textContent = `
:root {
  --nebula-accent: ${accentDef.primary};
  --nebula-accent-glow: ${accentDef.glow};
  --nebula-accent-border: ${accentDef.border};
  --nebula-accent-rgb: ${accentDef.rgb};
}
`;

    // 3. Injetar CSS Customizado do Usuário
    let customStyleTag = document.getElementById('nebula-custom-user-css') as HTMLStyleElement | null;
    if (!customStyleTag) {
      customStyleTag = document.createElement('style');
      customStyleTag.id = 'nebula-custom-user-css';
      document.head.appendChild(customStyleTag);
    }

    if (cssEnabled && css.trim()) {
      customStyleTag.textContent = css;
    } else {
      customStyleTag.textContent = '';
    }
  };

  // Inicializar tema no DOM imediatamente
  applyThemeToDOM(defaultMode, defaultAccent, defaultCustomCss, defaultCustomCssEnabled);

  return {
    themeMode: defaultMode,
    accent: defaultAccent,
    customCss: defaultCustomCss,
    customCssEnabled: defaultCustomCssEnabled,

    setThemeMode: (themeMode: ThemeMode) => {
      set({ themeMode });
      const s = get();
      saveTheme({
        themeMode,
        accent: s.accent,
        customCss: s.customCss,
        customCssEnabled: s.customCssEnabled,
      });
      applyThemeToDOM(themeMode, s.accent, s.customCss, s.customCssEnabled);
    },

    setAccent: (accent: AccentPreset) => {
      set({ accent });
      const s = get();
      saveTheme({
        themeMode: s.themeMode,
        accent,
        customCss: s.customCss,
        customCssEnabled: s.customCssEnabled,
      });
      applyThemeToDOM(s.themeMode, accent, s.customCss, s.customCssEnabled);
    },

    setCustomCss: (customCss: string) => {
      set({ customCss });
      const s = get();
      saveTheme({
        themeMode: s.themeMode,
        accent: s.accent,
        customCss,
        customCssEnabled: s.customCssEnabled,
      });
      applyThemeToDOM(s.themeMode, s.accent, customCss, s.customCssEnabled);
    },

    setCustomCssEnabled: (customCssEnabled: boolean) => {
      set({ customCssEnabled });
      const s = get();
      saveTheme({
        themeMode: s.themeMode,
        accent: s.accent,
        customCss: s.customCss,
        customCssEnabled,
      });
      applyThemeToDOM(s.themeMode, s.accent, s.customCss, customCssEnabled);
    },

    applyTheme: () => {
      const s = get();
      applyThemeToDOM(s.themeMode, s.accent, s.customCss, s.customCssEnabled);
    },
  };
});
