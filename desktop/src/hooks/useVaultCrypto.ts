import { useCallback } from 'react';
import { crypto } from '@/lib/tauri-crypto';
import { useAppMode } from '@/stores/app-mode';
import { sbEncrypt, sbDecrypt } from '@/lib/sandbox-cipher';

/**
 * Field-level crypto bound to the current mode. In Sandbox we use a reversible
 * encrypted-looking transform so stored values render as ciphertext (matching
 * the real UI); in the real app they call the Rust core using the Vault DEK.
 */
export function useVaultCrypto() {
  const sandbox = useAppMode((s) => s.sandbox);

  const encrypt = useCallback(
    (plaintext: string) =>
      sandbox ? Promise.resolve(sbEncrypt(plaintext)) : crypto.encryptField(plaintext),
    [sandbox],
  );

  const decrypt = useCallback(
    (ciphertext: string) =>
      sandbox ? Promise.resolve(sbDecrypt(ciphertext)) : crypto.decryptField(ciphertext),
    [sandbox],
  );

  return { encrypt, decrypt, sandbox };
}
