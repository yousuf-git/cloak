import { create } from 'zustand';

interface AppModeState {
  /** When true, the app renders scaffold pages backed by dummy data, with no
   * API/crypto calls — a safe "try it out" playground before signing in. */
  sandbox: boolean;
  enterSandbox: () => void;
  exitSandbox: () => void;
}

export const useAppMode = create<AppModeState>((set) => ({
  sandbox: false,
  enterSandbox: () => set({ sandbox: true }),
  exitSandbox: () => set({ sandbox: false }),
}));
