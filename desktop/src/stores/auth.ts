import { create } from 'zustand';
import { crypto } from '@/lib/tauri-crypto';
import {
  api,
  ApiError,
  clearTokens,
  getRefreshToken,
  onAuthLostHandler,
  setTokens,
  tryRefresh,
} from '@/lib/api';

export type AuthStatus =
  | 'booting'
  | 'locked'
  | 'show_recovery_key'
  | 'awaiting_verification'
  | 'awaiting_2fa'
  | 'recovery_email'
  | 'recovery_code'
  | 'recovery_reset'
  | 'unlocked';

interface PendingCreds {
  password: string;
  cryptoSalt: string;
  remember: boolean;
}

interface RecoveryContext {
  cryptoSalt: string;
  recoveryWrappedDEK: string;
  recoveryToken: string;
}

interface AuthState {
  status: AuthStatus;
  email: string | null;
  error: string | null;
  busy: boolean;
  /** Transient secrets held only for multi-step flows (verification / 2FA). */
  pending: PendingCreds | null;
  /** One-time recovery key, shown once right after signup, then wiped. */
  recoveryKey: string | null;
  recoveryCtx: RecoveryContext | null;

  boot: () => Promise<void>;
  signup: (email: string, password: string, remember: boolean) => Promise<void>;
  acknowledgeRecoveryKey: () => void;
  verifyEmail: (code: string) => Promise<void>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  submitTwoFactor: (otp: string) => Promise<void>;
  logout: () => Promise<void>;

  enterRecovery: () => void;
  cancelRecovery: () => void;
  startRecovery: (email: string) => Promise<void>;
  verifyRecoveryCode: (otp: string) => Promise<void>;
  completeRecovery: (recoveryKey: string, newPassword: string, remember: boolean) => Promise<void>;

  clearError: () => void;
}

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  email: null,
  error: null,
  busy: false,
  pending: null,
  recoveryKey: null,
  recoveryCtx: null,

  boot: async () => {
    try {
      const restored = await crypto.rememberTryRestore();
      if (restored) {
        setTokens({ refreshToken: restored.refresh_token });
        const ok = await tryRefresh();
        if (ok) {
          set({ status: 'unlocked', email: restored.email });
          return;
        }
        await crypto.rememberClear().catch(() => {});
        await crypto.sessionClear().catch(() => {});
        clearTokens();
      }
    } catch {
      // Keychain unavailable — degrade to normal login.
    }
    set({ status: 'locked' });
  },

  signup: async (email, password, remember) => {
    set({ busy: true, error: null });
    try {
      const payload = await crypto.prepareSignup(password);
      await api.signup({
        email,
        authHash: payload.auth_hash_b64,
        cryptoSalt: payload.crypto_salt_b64,
        wrappedDEK: payload.wrapped_dek_b64,
        recoveryWrappedDEK: payload.recovery_wrapped_dek_b64,
      });
      set({
        status: 'show_recovery_key',
        email,
        recoveryKey: payload.recovery_key,
        pending: { password, cryptoSalt: payload.crypto_salt_b64, remember },
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  acknowledgeRecoveryKey: () => set({ status: 'awaiting_verification', recoveryKey: null }),

  verifyEmail: async (code) => {
    const { email, pending } = get();
    if (!email || !pending) {
      set({ error: 'Session expired. Please start again.' });
      return;
    }
    set({ busy: true, error: null });
    try {
      await api.verifyEmail(email, code);
      set({ busy: false });
      await get().login(email, pending.password, pending.remember);
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  login: async (email, password, remember) => {
    set({ busy: true, error: null });
    try {
      const { crypto_salt } = await api.prelogin(email);
      const { auth_hash_b64 } = await crypto.deriveAuthHash(password, crypto_salt);
      const res = await api.login(email, auth_hash_b64);

      if (res.twoFactorRequired) {
        set({
          status: 'awaiting_2fa',
          email,
          pending: { password, cryptoSalt: crypto_salt, remember },
          busy: false,
        });
        return;
      }

      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      await crypto.unlockSession(password, crypto_salt, res.wrappedDEK!);
      if (remember && res.refreshToken) {
        await crypto.rememberEnable(res.refreshToken, email).catch(() => {});
      }
      set({ status: 'unlocked', email, pending: null, busy: false });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  submitTwoFactor: async (otp) => {
    const { email, pending } = get();
    if (!email || !pending) {
      set({ error: 'Session expired. Please sign in again.', status: 'locked' });
      return;
    }
    set({ busy: true, error: null });
    try {
      const res = await api.twoFactor(email, otp);
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      await crypto.unlockSession(pending.password, pending.cryptoSalt, res.wrappedDEK);
      if (pending.remember) {
        await crypto.rememberEnable(res.refreshToken, email).catch(() => {});
      }
      set({ status: 'unlocked', pending: null, busy: false });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  logout: async () => {
    set({ busy: true });
    try {
      await api.logout(getRefreshToken()).catch(() => {});
    } finally {
      await crypto.sessionClear().catch(() => {});
      await crypto.rememberClear().catch(() => {});
      clearTokens();
      set({ status: 'locked', email: null, pending: null, busy: false, error: null });
    }
  },

  enterRecovery: () => set({ status: 'recovery_email', error: null }),
  cancelRecovery: () =>
    set({ status: 'locked', error: null, recoveryCtx: null, pending: null }),

  startRecovery: async (email) => {
    set({ busy: true, error: null });
    try {
      await api.recoveryStart(email);
      set({ status: 'recovery_code', email, busy: false });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  verifyRecoveryCode: async (otp) => {
    const { email } = get();
    if (!email) {
      set({ error: 'Session expired. Start recovery again.', status: 'recovery_email' });
      return;
    }
    set({ busy: true, error: null });
    try {
      const res = await api.recoveryVerify(email, otp);
      set({
        status: 'recovery_reset',
        recoveryCtx: {
          cryptoSalt: res.crypto_salt,
          recoveryWrappedDEK: res.recovery_wrappedDEK,
          recoveryToken: res.recoveryToken,
        },
        busy: false,
      });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  completeRecovery: async (recoveryKey, newPassword, remember) => {
    const { email, recoveryCtx } = get();
    if (!email || !recoveryCtx) {
      set({ error: 'Recovery session expired. Start again.', status: 'recovery_email' });
      return;
    }
    set({ busy: true, error: null });
    try {
      // Unwrap the DEK with the recovery key, re-wrap under the new password.
      const payload = await crypto.recoveryReset(
        recoveryKey,
        recoveryCtx.cryptoSalt,
        recoveryCtx.recoveryWrappedDEK,
        newPassword,
      );
      const res = await api.recoveryReset({
        recoveryToken: recoveryCtx.recoveryToken,
        authHash: payload.auth_hash_b64,
        cryptoSalt: payload.crypto_salt_b64,
        wrappedDEK: payload.wrapped_dek_b64,
        recoveryWrappedDEK: payload.recovery_wrapped_dek_b64,
      });
      setTokens({ accessToken: res.accessToken, refreshToken: res.refreshToken });
      if (remember) {
        await crypto.rememberEnable(res.refreshToken, email).catch(() => {});
      }
      // Session was already established inside crypto.recoveryReset.
      set({ status: 'unlocked', recoveryCtx: null, pending: null, busy: false });
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  clearError: () => set({ error: null }),
}));

onAuthLostHandler(() => {
  crypto.sessionClear().catch(() => {});
  useAuth.setState({ status: 'locked', pending: null });
});
