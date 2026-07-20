/**
 * AWS credentials CSV helpers.
 *
 * The IAM console downloads a two-column, single-row CSV (with a UTF-8 BOM):
 *
 *   Access key ID,Secret access key
 *   <value>,<value>
 *
 * We only lift the ID + secret out of that file — title and note stay a manual
 * entry, since the AWS export carries neither.
 */

import { parseCsv } from '@/lib/csv-parse';

/** AWS credentials CSV header, with the UTF-8 BOM AWS emits. */
const ACCESS_KEY_CSV_HEADER = '﻿Access key ID,Secret access key';

/** Sample CSV offered via the "Download sample" button (leading BOM preserved). */
export const ACCESS_KEY_SAMPLE_CSV = `${ACCESS_KEY_CSV_HEADER}\n<value>,<value>\n`;

const csvCell = (value: string): string =>
  /[",\n\r]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;

/** Build an AWS-shaped credentials CSV for a single access-key pair. */
export function accessKeyToCsv(accessKeyId: string, secretAccessKey: string): string {
  return `${ACCESS_KEY_CSV_HEADER}\n${csvCell(accessKeyId)},${csvCell(secretAccessKey)}\n`;
}

export interface AccessKeyPair {
  accessKeyId: string;
  secretAccessKey: string;
}

const norm = (h: string) => h.trim().toLowerCase();

/**
 * Extract the single access-key pair from an AWS credentials CSV. Maps by
 * header name when present, else falls back to positional columns (ID, secret).
 * Returns `null` when no usable pair is found.
 */
export function parseAccessKeyCsv(text: string): AccessKeyPair | null {
  const { headers, rows } = parseCsv(text);
  const row = rows[0];
  if (!row) return null;

  const idIdx = headers.findIndex((h) => norm(h) === 'access key id');
  const secretIdx = headers.findIndex((h) => norm(h) === 'secret access key');

  const accessKeyId = (idIdx === -1 ? row[0] : row[idIdx])?.trim() ?? '';
  const secretAccessKey = (secretIdx === -1 ? row[1] : row[secretIdx])?.trim() ?? '';

  if (!accessKeyId && !secretAccessKey) return null;
  return { accessKeyId, secretAccessKey };
}
