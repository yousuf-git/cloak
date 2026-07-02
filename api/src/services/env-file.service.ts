import type { Types } from 'mongoose';
import { EnvFile, type EnvTag } from '../models/env-file.model.js';
import { NotFoundError } from '../lib/errors.js';

type Owner = Types.ObjectId | string;

/** The blob is base64-transported; we persist the decoded text. */
function decodeBlob(contentB64: string): string {
  return Buffer.from(contentB64, 'base64').toString('utf8');
}

export function listEnvFiles(userId: Owner, projectId?: string) {
  const filter: Record<string, unknown> = { user_id: userId };
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

export async function createEnvFile(userId: Owner, input: CreateEnvInput) {
  const doc = await EnvFile.create({
    user_id: userId,
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

export async function getEnvRaw(userId: Owner, id: string): Promise<string> {
  const doc = await EnvFile.findOne({ _id: id, user_id: userId }).select('content');
  if (!doc) throw new NotFoundError('Env file not found');
  return doc.content;
}

export interface UpdateEnvInput {
  label?: string;
  tag?: EnvTag;
  encrypted_dotenvx_key?: string | null;
  content_b64?: string;
  variable_count?: number;
}

export async function updateEnvFile(userId: Owner, id: string, input: UpdateEnvInput) {
  const doc = await EnvFile.findOne({ _id: id, user_id: userId });
  if (!doc) throw new NotFoundError('Env file not found');

  if (input.content_b64 !== undefined) doc.content = decodeBlob(input.content_b64);
  if (input.label !== undefined) doc.label = input.label;
  if (input.tag !== undefined) doc.tag = input.tag;
  if (input.encrypted_dotenvx_key !== undefined) doc.encrypted_dotenvx_key = input.encrypted_dotenvx_key;
  if (input.variable_count !== undefined) doc.variable_count = input.variable_count;

  await doc.save();
  const obj = doc.toObject();
  delete (obj as { content?: string }).content;
  return obj;
}

export async function deleteEnvFile(userId: Owner, id: string) {
  const res = await EnvFile.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('Env file not found');
}
