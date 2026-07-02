import { useEffect } from 'react';
import { create } from 'zustand';

export type Theme = 'system' | 'light' | 'dark';

const STORAGE_KEY = 'cloak.theme';

function resolve(theme: Theme): 'light' | 'dark' {
  if (theme === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return theme;
}

function apply(theme: Theme) {
  const effective = resolve(theme);
  document.documentElement.classList.toggle('dark', effective === 'dark');
}

interface ThemeStore {
  theme: Theme;
  setTheme: (t: Theme) => void;
}

const initial = ((): Theme => {
  const saved = localStorage.getItem(STORAGE_KEY) as Theme | null;
  return saved ?? 'dark';
})();

apply(initial);

const useThemeStore = create<ThemeStore>((set) => ({
  theme: initial,
  setTheme: (theme) => {
    localStorage.setItem(STORAGE_KEY, theme);
    apply(theme);
    set({ theme });
  },
}));

export function useTheme() {
  const theme = useThemeStore((s) => s.theme);
  const setTheme = useThemeStore((s) => s.setTheme);

  useEffect(() => {
    if (theme !== 'system') return;
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const onChange = () => apply('system');
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [theme]);

  return { theme, setTheme };
}
