/**
 * SSH key file detection for the import-only UX.
 *
 * Cloak manages the four AWS EC2 key-pair variants. We never let the user paste
 * key material by hand — a file is imported, its header is inspected, and the
 * key type + format are derived from that header (never trusted from the user).
 *
 *   | Key type | Format | Header                                |
 *   |----------|--------|---------------------------------------|
 *   | RSA      | PEM    | -----BEGIN RSA PRIVATE KEY-----       |
 *   | RSA      | PPK    | PuTTY-User-Key-File-N: ssh-rsa        |
 *   | ED25519  | PEM    | -----BEGIN OPENSSH PRIVATE KEY-----   |
 *   | ED25519  | PPK    | PuTTY-User-Key-File-N: ssh-ed25519    |
 */

import type { SshKeyType, SshKeyFormat } from '@/lib/api';

export interface SshKeyVariant {
  key_type: SshKeyType;
  format: SshKeyFormat;
  label: string;
  ext: string;
  usedWith: string;
}

/** The four supported variants — drives the guidance shown before/after import. */
export const SSH_KEY_VARIANTS: SshKeyVariant[] = [
  { key_type: 'RSA', format: 'PEM', label: 'RSA · PEM', ext: '.pem', usedWith: 'OpenSSH, Linux/macOS, AWS CLI' },
  { key_type: 'RSA', format: 'PPK', label: 'RSA · PuTTY', ext: '.ppk', usedWith: 'PuTTY (Windows client)' },
  { key_type: 'ED25519', format: 'PEM', label: 'ED25519 · PEM', ext: '.pem', usedWith: 'OpenSSH v6.5+, Linux/macOS' },
  { key_type: 'ED25519', format: 'PPK', label: 'ED25519 · PuTTY', ext: '.ppk', usedWith: 'PuTTY (Windows client)' },
];

export interface DetectedSshKey {
  key_type: SshKeyType;
  format: SshKeyFormat;
  comment?: string;
  variant: SshKeyVariant;
}

const variantOf = (key_type: SshKeyType, format: SshKeyFormat): SshKeyVariant =>
  SSH_KEY_VARIANTS.find((v) => v.key_type === key_type && v.format === format)!;

/** Read the `Comment:` header from a PuTTY .ppk file, if present. */
function ppkComment(text: string): string | undefined {
  const match = text.match(/^Comment:\s*(.+)$/m);
  return match?.[1]?.trim() || undefined;
}

/**
 * Detect the SSH key variant from a file's contents. Returns `null` when the
 * file is not one of the four supported formats (unencrypted private keys,
 * public keys, DSA/ECDSA, etc.).
 */
export function detectSshKey(text: string): DetectedSshKey | null {
  const src = text.replace(/^﻿/, '').trimStart();

  // PuTTY .ppk — algorithm token follows the header line.
  const ppk = src.match(/^PuTTY-User-Key-File-\d+:\s*(\S+)/);
  if (ppk) {
    const algo = ppk[1];
    if (algo === 'ssh-rsa') return { key_type: 'RSA', format: 'PPK', comment: ppkComment(src), variant: variantOf('RSA', 'PPK') };
    if (algo === 'ssh-ed25519') return { key_type: 'ED25519', format: 'PPK', comment: ppkComment(src), variant: variantOf('ED25519', 'PPK') };
    return null; // PuTTY key of an unsupported algorithm
  }

  // PEM — the header banner identifies the key type.
  if (src.startsWith('-----BEGIN RSA PRIVATE KEY-----')) {
    return { key_type: 'RSA', format: 'PEM', variant: variantOf('RSA', 'PEM') };
  }
  if (src.startsWith('-----BEGIN OPENSSH PRIVATE KEY-----')) {
    return { key_type: 'ED25519', format: 'PEM', variant: variantOf('ED25519', 'PEM') };
  }

  return null;
}
