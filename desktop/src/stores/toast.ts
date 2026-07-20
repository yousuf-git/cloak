import { create } from 'zustand';

export type ToastVariant = 'success' | 'error';

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

interface ToastState {
  toasts: Toast[];
  show: (message: string, variant?: ToastVariant, duration?: number) => void;
  dismiss: (id: number) => void;
}

let seq = 0;

/**
 * Tiny transient-notification store. Toasts auto-dismiss after `duration` ms
 * (0 keeps them until dismissed). Usable outside React via `useToast.getState()`.
 */
export const useToast = create<ToastState>((set, get) => ({
  toasts: [],
  show: (message, variant = 'success', duration = 4000) => {
    const id = ++seq;
    set((s) => ({ toasts: [...s.toasts, { id, message, variant }] }));
    if (duration > 0) setTimeout(() => get().dismiss(id), duration);
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

/** Convenience helpers for non-component code (e.g. lib/native-fs). */
export const toast = {
  success: (message: string) => useToast.getState().show(message, 'success'),
  error: (message: string) => useToast.getState().show(message, 'error'),
};
