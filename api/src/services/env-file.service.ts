import { EnvFile, type EnvTag } from '../models/env-file.model.js';
import { Project } from '../models/project.model.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';
import type { Scope } from './vault.service.js';

/** The blob is base64-transported; we persist the decoded text. */
function decodeBlob(contentB64: string): string {
  return Buffer.from(contentB64, 'base64').toString('utf8');
}

/**
 * Variable names and their (encrypted) values, keyed by name.
 *
 * dotenvx keeps keys in the clear and encrypts only values, so the server
 * already holds the names — reading them here to describe an edit reveals
 * nothing it could not already see, and values are never read out.
 */
function parseEnvEntries(content: string): Map<string, string> {
  const entries = new Map<string, string>();
  for (const line of content.split('\n')) {
    const match = /^\s*(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=(.*)$/.exec(line);
    if (match) entries.set(match[1]!, match[2]!.trim());
  }
  return entries;
}

export interface EnvChanges {
  added: string[];
  removed: string[];
  /** Names whose value changed. The values themselves never leave this module. */
  updated: string[];
}

/** Which variables an edit touched, by name. */
export function diffEnvContent(before: string, after: string): EnvChanges {
  const previous = parseEnvEntries(before);
  const next = parseEnvEntries(after);

  return {
    added: [...next.keys()].filter((k) => !previous.has(k)),
    removed: [...previous.keys()].filter((k) => !next.has(k)),
    updated: [...next.keys()].filter((k) => previous.has(k) && previous.get(k) !== next.get(k)),
  };
}

export function listEnvFiles({ orgId }: Scope, projectId?: string) {
  const filter: Record<string, unknown> = { org_id: orgId };
  if (projectId) filter.project_id = projectId;
  // Exclude the (large) content blob from list responses; fetched on demand.
  return EnvFile.find(filter).select('-content').sort({ created_at: -1 }).lean();
}

export interface CreateEnvInput {
  project_id: string;
  label: string;
  tag: EnvTag;
  encrypted_dotenvx_key: string | null;
  content_b64: string;
  variable_count: number;
}

export async function createEnvFile({ orgId, userId }: Scope, input: CreateEnvInput) {
  const project = await Project.exists({ _id: input.project_id, org_id: orgId });
  if (!project) throw new ValidationError('Unknown project for this organization');

  const doc = await EnvFile.create({
    org_id: orgId,
    created_by: userId,
    project_id: input.project_id,
    label: input.label,
    tag: input.tag,
    encrypted_dotenvx_key: input.encrypted_dotenvx_key,
    content: decodeBlob(input.content_b64),
    variable_count: input.variable_count,
  });
  // Never return the blob on create.
  const obj = doc.toObject();
  delete (obj as { content?: string }).content;
  return obj;
}

/** The whole record: the blob to hand back, and the identity to audit it under. */
export async function getEnvFile({ orgId }: Scope, id: string) {
  const doc = await EnvFile.findOne({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('Env file not found');
  return doc;
}

export interface UpdateEnvInput {
  label?: string;
  tag?: EnvTag;
  encrypted_dotenvx_key?: string | null;
  content_b64?: string;
  variable_count?: number;
}

export async function updateEnvFile({ orgId }: Scope, id: string, input: UpdateEnvInput) {
  const doc = await EnvFile.findOne({ _id: id, org_id: orgId });
  if (!doc) throw new NotFoundError('Env file not found');

  let changes: EnvChanges | undefined;
  const renamedFrom = input.label !== undefined && input.label !== doc.label ? doc.label : undefined;

  if (input.content_b64 !== undefined) {
    const next = decodeBlob(input.content_b64);
    changes = diffEnvContent(doc.content, next);
    doc.content = next;
  }
  if (input.label !== undefined) doc.label = input.label;
  if (input.tag !== undefined) doc.tag = input.tag;
  if (input.encrypted_dotenvx_key !== undefined) doc.encrypted_dotenvx_key = input.encrypted_dotenvx_key;
  if (input.variable_count !== undefined) doc.variable_count = input.variable_count;

  await doc.save();
  const obj = doc.toObject();
  delete (obj as { content?: string }).content;
  return { file: obj, changes, renamedFrom };
}

export async function deleteEnvFile({ orgId }: Scope, id: string) {
  const doc = await EnvFile.findOneAndDelete({ _id: id, org_id: orgId }).select('-content').lean();
  if (!doc) throw new NotFoundError('Env file not found');
  return doc;
}
