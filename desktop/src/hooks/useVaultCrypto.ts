import { useCallback } from 'react';
import { crypto } from '@/lib/tauri-crypto';
import { useAppMode } from '@/stores/app-mode';
import { useOrg } from '@/hooks/useOrg';
import { sbEncrypt, sbDecrypt } from '@/lib/sandbox-cipher';

/**
 * Field-level crypto bound to the current mode and organization. In Sandbox we
 * use a reversible encrypted-looking transform so stored values render as
 * ciphertext (matching the real UI); in the real app they call the Rust core
 * using the active org's DEK.
 */
export function useVaultCrypto() {
  const sandbox = useAppMode((s) => s.sandbox);
  const { orgId } = useOrg();

  const encrypt = useCallback(
    (plaintext: string) => {
      if (sandbox) return Promise.resolve(sbEncrypt(plaintext));
      if (!orgId) return Promise.reject(new Error('No organization selected'));
      return crypto.encryptField(orgId, plaintext);
    },
    [sandbox, orgId],
  );

  const decrypt = useCallback(
    (ciphertext: string) => {
      if (sandbox) return Promise.resolve(sbDecrypt(ciphertext));
      if (!orgId) return Promise.reject(new Error('No organization selected'));
      return crypto.decryptField(orgId, ciphertext);
    },
    [sandbox, orgId],
  );

  return { encrypt, decrypt, sandbox, orgId };
}
