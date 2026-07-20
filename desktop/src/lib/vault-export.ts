/**
 * Credential export helpers.
 *
 * Two portable formats:
 *  - Google-compatible plaintext CSV (`name,url,username,password,note`) — the
 *    same shape Google Password Manager imports, so an export round-trips back
 *    into Cloak (or any other manager). Plaintext, gated behind an explicit
 *    confirmation in the UI.
 *  - An encrypted `.cloak` backup: a passphrase-sealed JSON envelope
 *    (PBKDF2-SHA256 → AES-256-GCM via the WebCrypto SubtleCrypto API). Self
 *    contained and decryptable on any device with the passphrase, independent
 *    of the vault DEK.
 */

import type { ImportRow } from './csv-parse';

const CSV_HEADER = ['name', 'url', 'username', 'password', 'note'] as const;

function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
}

/** Build a Google-compatible plaintext CSV from credential rows. */
export function credsToCsv(rows: ImportRow[]): string {
  const lines = [CSV_HEADER.join(',')];
  for (const r of rows) {
    lines.push([r.name, r.url, r.username, r.password, r.note].map((v) => csvEscape(v ?? '')).join(','));
  }
  return lines.join('\r\n');
}

/** Trigger a browser download of a text blob. */
// ---- Encrypted backup (passphrase → PBKDF2 → AES-GCM) ----

const PBKDF2_ITERATIONS = 210_000;
const BACKUP_MAGIC = 'cloak.backup';
const BACKUP_VERSION = 1;

interface BackupEnvelope {
  magic: typeof BACKUP_MAGIC;
  v: number;
  kdf: { name: 'PBKDF2'; hash: 'SHA-256'; iterations: number; salt: string };
  cipher: 'AES-GCM';
  iv: string;
  data: string;
}

function toB64(bytes: Uint8Array): string {
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s);
}

function fromB64(b64: string): Uint8Array {
  const s = atob(b64);
  const out = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) out[i] = s.charCodeAt(i);
  return out;
}

async function deriveKey(passphrase: string, salt: Uint8Array): Promise<CryptoKey> {
  const material = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(passphrase) as BufferSource,
    'PBKDF2',
    false,
    ['deriveKey'],
  );
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', hash: 'SHA-256', salt: salt as BufferSource, iterations: PBKDF2_ITERATIONS },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  );
}

/** Seal arbitrary plaintext (a CSV or JSON payload) into a `.cloak` envelope. */
export async function encryptBackup(passphrase: string, plaintext: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKey(passphrase, salt);
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      new TextEncoder().encode(plaintext) as BufferSource,
    ),
  );
  const envelope: BackupEnvelope = {
    magic: BACKUP_MAGIC,
    v: BACKUP_VERSION,
    kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: PBKDF2_ITERATIONS, salt: toB64(salt) },
    cipher: 'AES-GCM',
    iv: toB64(iv),
    data: toB64(ct),
  };
  return JSON.stringify(envelope, null, 2);
}

/** Return the parsed envelope if `text` looks like a Cloak encrypted backup. */
export function asBackupEnvelope(text: string): BackupEnvelope | null {
  try {
    const obj = JSON.parse(text) as BackupEnvelope;
    return obj && obj.magic === BACKUP_MAGIC && obj.cipher === 'AES-GCM' ? obj : null;
  } catch {
    return null;
  }
}

/** Decrypt a `.cloak` envelope back to plaintext. Throws on a wrong passphrase. */
export async function decryptBackup(passphrase: string, envelope: BackupEnvelope): Promise<string> {
  const salt = fromB64(envelope.kdf.salt);
  const iv = fromB64(envelope.iv);
  const key = await deriveKey(passphrase, salt);
  try {
    const pt = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: iv as BufferSource },
      key,
      fromB64(envelope.data) as BufferSource,
    );
    return new TextDecoder().decode(pt);
  } catch {
    throw new Error('Wrong passphrase or corrupted backup file.');
  }
}
