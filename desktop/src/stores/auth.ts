import { create } from 'zustand';
import { crypto } from '@/lib/tauri-crypto';
import { useOrgs } from '@/stores/org';
import {
  api,
  ApiError,
  clearTokens,
  getRefreshToken,
  onAuthLostHandler,
  onRefreshRotatedHandler,
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
  /** Display name, kept alongside the email so headers can greet by first name. */
  name: string | null;
  error: string | null;
  /** Informational message — a state to explain, not a failure. */
  notice: string | null;
  busy: boolean;
  /** True when the user arrived at verification by returning, not by signing up. */
  resumedVerification: boolean;
  /** Transient secrets held only for multi-step flows (verification / 2FA). */
  pending: PendingCreds | null;
  /** One-time recovery keys, shown once right after signup, then wiped. */
  recoveryKey: string | null;
  orgRecoveryKey: string | null;
  recoveryCtx: RecoveryContext | null;

  /**
   * Proof that this client holds the server's ownership key. Set by the claim
   * step on a fresh self-hosted deployment and spent by the next signup; null
   * on every server that already has an owner.
   */
  claimTicket: string | null;
  /** Invitation token carried in from a pasted join key, redeemed after unlock. */
  pendingInviteToken: string | null;
  /**
   * A remembered session is on this device but the server did not answer at
   * launch, so it could be neither restored nor ruled out. Boot runs again
   * once the server is reachable.
   */
  restorePending: boolean;

  boot: () => Promise<void>;
  setOnboarding: (next: { claimTicket?: string | null; pendingInviteToken?: string | null }) => void;
  signup: (name: string, email: string, password: string, remember: boolean) => Promise<void>;
  setName: (name: string) => Promise<void>;
  acknowledgeRecoveryKey: () => void;
  verifyEmail: (code: string) => Promise<void>;
  /** Ask for a fresh verification code; resolves false if it could not be sent. */
  resendVerification: () => Promise<boolean>;
  login: (email: string, password: string, remember: boolean) => Promise<void>;
  submitTwoFactor: (otp: string) => Promise<void>;
  logout: () => Promise<void>;
  /** Escape any pre-unlock flow (verify / 2FA / recovery) back to the sign-in screen. */
  returnToLogin: () => void;

  enterRecovery: () => void;
  cancelRecovery: () => void;
  startRecovery: (email: string) => Promise<void>;
  verifyRecoveryCode: (otp: string) => Promise<void>;
  completeRecovery: (recoveryKey: string, newPassword: string, remember: boolean) => Promise<void>;

  clearError: () => void;
}

/** Name for the organization every account is given at signup. Renameable later. */
const DEFAULT_ORG_NAME = 'Personal Space';

/** Pull the display name in behind an unlock; a failure here must not block it. */
async function hydrateProfile(set: (partial: Partial<AuthState>) => void): Promise<void> {
  try {
    const profile = await api.me();
    set({ name: profile.name ?? null });
  } catch {
    // Profile is cosmetic — the vault is already open.
  }
}

function toMessage(err: unknown): string {
  if (err instanceof ApiError) return err.message;
  if (err instanceof Error) return err.message;
  return 'Something went wrong. Please try again.';
}

export const useAuth = create<AuthState>((set, get) => ({
  status: 'booting',
  email: null,
  name: null,
  error: null,
  notice: null,
  busy: false,
  resumedVerification: false,
  pending: null,
  recoveryKey: null,
  orgRecoveryKey: null,
  recoveryCtx: null,
  claimTicket: null,
  pendingInviteToken: null,
  restorePending: false,

  setOnboarding: (next) => set(next),

  boot: async () => {
    let pending = false;
    try {
      const restored = await crypto.rememberTryRestore();
      if (restored) {
        setTokens({ refreshToken: restored.refresh_token });
        const outcome = await tryRefresh();
        if (outcome === 'ok') {
          set({ status: 'unlocked', email: restored.email, restorePending: false });
          await Promise.all([useOrgs.getState().hydrate(), hydrateProfile(set)]);
          return;
        }
        // Only a rejected token ends the remembered session. An unreachable
        // server — the local backend still starting, a network drop — keeps it
        // for another try, instead of silently forgetting this device.
        if (outcome === 'rejected') await crypto.rememberClear().catch(() => {});
        await crypto.sessionClear().catch(() => {});
        clearTokens();
        pending = outcome === 'unreachable';
      }
    } catch {
      // Keychain unavailable — degrade to normal login.
    }
    // A re-run can finish after the user started signing in by hand; leave
    // that flow where it is rather than bouncing it back to the form.
    const { status } = get();
    set(
      status === 'booting' || status === 'locked'
        ? { status: 'locked', restorePending: pending }
        : { restorePending: false },
    );
  },

  signup: async (name, email, password, remember) => {
    set({ busy: true, error: null });
    try {
      const payload = await crypto.prepareSignup(password);
      await api.signup({
        email,
        name,
        authHash: payload.auth_hash_b64,
        cryptoSalt: payload.crypto_salt_b64,
        wrappedDEK: payload.wrapped_dek_b64,
        recoveryWrappedDEK: payload.recovery_wrapped_dek_b64,
        identityPublicKey: payload.identity_public_key,
        wrappedIdentitySk: payload.wrapped_identity_sk_b64,
        // Present only when claiming an unowned server. The server spends it
        // here, atomically, as the owner account is created.
        ...(get().claimTicket ? { claimTicket: get().claimTicket! } : {}),
        // Every account starts inside an organization, so signup mints its key
        // material in the same step.
        defaultOrg: {
          name: DEFAULT_ORG_NAME,
          wrapped_org_dek: payload.org.wrapped_org_dek_b64,
          org_recovery_salt: payload.org.org_recovery_salt_b64,
          org_recovery_wrappedDEK: payload.org.org_recovery_wrapped_dek_b64,
        },
      });
      set({
        status: 'show_recovery_key',
        email,
        name,
        recoveryKey: payload.recovery_key,
        orgRecoveryKey: payload.org.org_recovery_key,
        pending: { password, cryptoSalt: payload.crypto_salt_b64, remember },
        // Spent. Keeping it would let a later signup on the same launch try to
        // claim a server that now has an owner.
        claimTicket: null,
        busy: false,
      });
    } catch (err) {
      // The address is taken by an account that never finished verifying. Try
      // the credentials they just typed against it: if they match, login routes
      // them into verification; if not, login reports that plainly. Guessing
      // either way would be worse than letting the real check answer.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        set({ busy: false, error: null });
        await get().login(email, password, remember);
        if (get().error) {
          set({
            error:
              'That email already has an unverified account. Sign in with the password you first chose, to finish verifying it.',
          });
        }
        return;
      }
      set({ busy: false, error: toMessage(err) });
    }
  },

  acknowledgeRecoveryKey: () =>
    set({ status: 'awaiting_verification', recoveryKey: null, orgRecoveryKey: null }),

  resendVerification: async () => {
    const { email } = get();
    if (!email) return false;
    set({ error: null, notice: null });
    try {
      await api.resendVerification(email);
      set({ notice: `A new code is on its way to ${email}.` });
      return true;
    } catch (err) {
      set({ error: toMessage(err) });
      return false;
    }
  },

  verifyEmail: async (code) => {
    const { email, pending } = get();
    if (!email || !pending) {
      set({ error: 'Session expired. Please start again.' });
      return;
    }
    set({ busy: true, error: null });
    try {
      await api.verifyEmail(email, code);
      set({ busy: false, notice: null, resumedVerification: false });
      await get().login(email, pending.password, pending.remember);
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  login: async (email, password, remember) => {
    set({ busy: true, error: null, notice: null });
    // Hoisted: the unverified branch below needs the salt to stash pending creds.
    let crypto_salt = '';
    try {
      ({ crypto_salt } = await api.prelogin(email));
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
      await Promise.all([useOrgs.getState().hydrate(), hydrateProfile(set)]);
    } catch (err) {
      // The password was right; the address was simply never confirmed. The
      // server has already sent a fresh code, so go straight to the code screen
      // rather than reporting a failure the user cannot act on.
      if (err instanceof ApiError && err.code === 'EMAIL_NOT_VERIFIED') {
        set({
          status: 'awaiting_verification',
          email,
          pending: { password, cryptoSalt: crypto_salt, remember },
          resumedVerification: true,
          error: null,
          notice: 'Your account was created but never verified. We just sent a new code.',
          busy: false,
        });
        return;
      }
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
      await Promise.all([useOrgs.getState().hydrate(), hydrateProfile(set)]);
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
      useOrgs.getState().reset();
      set({
        status: 'locked',
        email: null,
        name: null,
        pending: null,
        busy: false,
        error: null,
        notice: null,
        resumedVerification: false,
      });
    }
  },

  returnToLogin: () =>
    set({
      status: 'locked',
      error: null,
      notice: null,
      resumedVerification: false,
      pending: null,
      recoveryKey: null,
      recoveryCtx: null,
    }),

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
      // Session was already established inside crypto.recoveryReset. The DEK is
      // unchanged, so the identity envelope it wraps still opens.
      set({ status: 'unlocked', recoveryCtx: null, pending: null, busy: false });
      await Promise.all([useOrgs.getState().hydrate(), hydrateProfile(set)]);
    } catch (err) {
      set({ busy: false, error: toMessage(err) });
    }
  },

  setName: async (name) => {
    const profile = await api.updateMe(name.trim());
    set({ name: profile.name ?? null });
  },

  clearError: () => set({ error: null }),
}));

onRefreshRotatedHandler((refreshToken) => {
  crypto.rememberUpdateToken(refreshToken).catch(() => {});
});

onAuthLostHandler(() => {
  // Only an established (unlocked) session can be "lost". A 401 while the user
  // is mid-flow (login / 2FA / email-verify / recovery) — e.g. a late, leftover
  // authed request from a previous session firing during re-login — must NOT
  // reset the flow, or it bounces the user back to the login screen right after
  // they submit their OTP.
  if (useAuth.getState().status !== 'unlocked') return;
  crypto.sessionClear().catch(() => {});
  useOrgs.getState().reset();
  useAuth.setState({ status: 'locked', pending: null });
});
