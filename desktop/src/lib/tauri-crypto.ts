import { invoke } from '@tauri-apps/api/core';

export interface OrgBootstrapPayload {
  wrapped_org_dek_b64: string;
  org_recovery_salt_b64: string;
  org_recovery_wrapped_dek_b64: string;
  org_recovery_key: string;
}

export interface IdentityPayload {
  identity_public_key: string;
  wrapped_identity_sk_b64: string;
}

export interface SignupCryptoPayload {
  crypto_salt_b64: string;
  auth_hash_b64: string;
  wrapped_dek_b64: string;
  recovery_wrapped_dek_b64: string;
  recovery_key: string;
  identity_public_key: string;
  wrapped_identity_sk_b64: string;
  org: OrgBootstrapPayload;
}

export interface RecoveryResetPayload {
  crypto_salt_b64: string;
  auth_hash_b64: string;
  wrapped_dek_b64: string;
  recovery_wrapped_dek_b64: string;
}

export interface AuthDerivationResult {
  auth_hash_b64: string;
}

export interface EnvKeypair {
  public_key_hex: string;
  private_key_hex: string;
}

export interface EnvRevealEntry {
  key: string;
  value: string;
}

export interface RememberRestoreResult {
  email: string;
  refresh_token: string;
}

export const crypto = {
  appVersion: () => invoke<string>('app_version'),
  prepareSignup: (password: string, cryptoSaltB64?: string) =>
    invoke<SignupCryptoPayload>('crypto_prepare_signup', {
      password,
      cryptoSaltB64: cryptoSaltB64 ?? null,
    }),
  deriveAuthHash: (password: string, cryptoSaltB64: string) =>
    invoke<AuthDerivationResult>('crypto_derive_auth_hash', {
      password,
      cryptoSaltB64,
    }),
  recoveryReset: (
    recoveryKey: string,
    cryptoSaltB64: string,
    recoveryWrappedDekB64: string,
    newPassword: string,
  ) =>
    invoke<RecoveryResetPayload>('crypto_recovery_reset', {
      recoveryKey,
      cryptoSaltB64,
      recoveryWrappedDekB64,
      newPassword,
    }),
  unlockSession: (password: string, cryptoSaltB64: string, wrappedDekB64: string) =>
    invoke<AuthDerivationResult>('crypto_unlock_session', {
      password,
      cryptoSaltB64,
      wrappedDekB64,
    }),
  loadIdentity: (wrappedIdentitySkB64: string) =>
    invoke<string>('crypto_load_identity', { wrappedIdentitySkB64 }),
  createIdentity: () => invoke<IdentityPayload>('crypto_create_identity'),
  loadOrg: (orgId: string, wrappedOrgDekB64: string) =>
    invoke<void>('crypto_load_org', { orgId, wrappedOrgDekB64 }),
  bootstrapOrg: () => invoke<OrgBootstrapPayload>('crypto_bootstrap_org'),
  sealOrgDekFor: (orgId: string, recipientPublicKeyB64: string) =>
    invoke<string>('crypto_seal_org_dek_for', { orgId, recipientPublicKeyB64 }),
  orgRecoveryUnlock: (
    orgId: string,
    orgRecoveryKey: string,
    orgRecoverySaltB64: string,
    orgRecoveryWrappedDekB64: string,
  ) =>
    invoke<string>('crypto_org_recovery_unlock', {
      orgId,
      orgRecoveryKey,
      orgRecoverySaltB64,
      orgRecoveryWrappedDekB64,
    }),
  publicKeyFingerprint: (publicKeyB64: string) =>
    invoke<string>('crypto_public_key_fingerprint', { publicKeyB64 }),
  orgStatus: (orgId: string) => invoke<boolean>('crypto_org_status', { orgId }),
  identityStatus: () => invoke<boolean>('crypto_identity_status'),
  encryptField: (orgId: string, plaintext: string) =>
    invoke<string>('crypto_encrypt_field', { orgId, plaintext }),
  decryptField: (orgId: string, ciphertextB64: string) =>
    invoke<string>('crypto_decrypt_field', { orgId, ciphertextB64 }),
  generateEnvKeypair: () => invoke<EnvKeypair>('crypto_generate_env_keypair'),
  encryptEnvValue: (plaintext: string, publicKeyHex: string) =>
    invoke<string>('crypto_encrypt_env_value', { plaintext, publicKeyHex }),
  decryptEnvValue: (encrypted: string, privateKeyHex: string) =>
    invoke<string>('crypto_decrypt_env_value', { encrypted, privateKeyHex }),
  revealAllEnv: (envText: string, privateKeyHex: string) =>
    invoke<EnvRevealEntry[]>('crypto_reveal_all_env', { envText, privateKeyHex }),
  sessionClear: () => invoke<void>('crypto_session_clear'),
  sessionStatus: () => invoke<boolean>('crypto_session_status'),
  rememberEnable: (refreshToken: string, email: string) =>
    invoke<void>('remember_enable', { refreshToken, email }),
  rememberTryRestore: () => invoke<RememberRestoreResult | null>('remember_try_restore'),
  rememberClear: () => invoke<void>('remember_clear'),
  rememberStatus: () => invoke<boolean>('remember_status'),

  envEncryptNew: (orgId: string, plaintextEnv: string) =>
    invoke<{
      encrypted_env: string;
      wrapped_key_b64: string;
      public_key_hex: string;
      variable_count: number;
    }>('crypto_env_encrypt_new', { orgId, plaintextEnv }),
  envDecrypt: (orgId: string, encryptedEnv: string, wrappedKeyB64: string) =>
    invoke<{ plaintext_env: string; public_key_hex: string | null; variable_count: number }>(
      'crypto_env_decrypt',
      { orgId, encryptedEnv, wrappedKeyB64 },
    ),
  envEncryptExisting: (plaintextEnv: string, publicKeyHex: string) =>
    invoke<{ encrypted_env: string; variable_count: number }>('crypto_env_encrypt_existing', {
      plaintextEnv,
      publicKeyHex,
    }),
  envWrapKey: (orgId: string, privateKeyHex: string) =>
    invoke<string>('crypto_env_wrap_key', { orgId, privateKeyHex }),
  envCountVariables: (envText: string) =>
    invoke<number>('crypto_env_count_variables', { envText }),
};
