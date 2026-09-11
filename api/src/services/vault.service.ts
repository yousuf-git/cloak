import { Types } from 'mongoose';
import { Cred } from '../models/cred.model.js';
import { ApiKey } from '../models/api-key.model.js';
import { AccessKey } from '../models/access-key.model.js';
import { SshKey } from '../models/ssh-key.model.js';
import { Platform } from '../models/platform.model.js';
import { Project } from '../models/project.model.js';
import { NotFoundError, ValidationError } from '../lib/errors.js';

type Id = Types.ObjectId | string;

/** Who is acting, and in which org. Scope is the org; the user is attribution. */
export interface Scope {
  orgId: Id;
  userId: Id;
}

/** Project name for audit context; undefined when the resource has no project. */
export async function projectName(orgId: Id, projectId?: Id | null): Promise<string | undefined> {
  if (!projectId || !Types.ObjectId.isValid(projectId.toString())) return undefined;
  const project = await Project.findOne({ _id: projectId, org_id: orgId }).select('name').lean();
  return project?.name;
}

/**
 * A resource may only point at a project owned by the same org. Without this a
 * caller could file their secrets under another org's project id.
 */
async function assertProjectInOrg(orgId: Id, data: Record<string, unknown>): Promise<void> {
  const projectId = data.project_id;
  if (projectId === undefined || projectId === null) return;
  const exists = await Project.exists({ _id: projectId, org_id: orgId });
  if (!exists) throw new ValidationError('Unknown project for this organization');
}

// ---------- Credentials ----------
export function listCreds({ orgId }: Scope) {
  return Cred.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export async function createCred({ orgId, userId }: Scope, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  return Cred.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updateCred({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  const doc = await Cred.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Credential not found');
  return doc;
}

export async function deleteCred({ orgId }: Scope, id: string) {
  const doc = await Cred.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('Credential not found');
  return doc;
}

// ---------- API Keys ----------
export function listApiKeys({ orgId }: Scope) {
  return ApiKey.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export async function createApiKey({ orgId, userId }: Scope, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  return ApiKey.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updateApiKey({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  const doc = await ApiKey.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('API key not found');
  return doc;
}

export async function deleteApiKey({ orgId }: Scope, id: string) {
  const doc = await ApiKey.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('API key not found');
  return doc;
}

// ---------- Access Keys ----------
export function listAccessKeys({ orgId }: Scope) {
  return AccessKey.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export async function createAccessKey({ orgId, userId }: Scope, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  return AccessKey.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updateAccessKey({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  const doc = await AccessKey.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Access key not found');
  return doc;
}

export async function deleteAccessKey({ orgId }: Scope, id: string) {
  const doc = await AccessKey.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('Access key not found');
  return doc;
}

// ---------- SSH Keys ----------
export function listSshKeys({ orgId }: Scope) {
  return SshKey.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export async function createSshKey({ orgId, userId }: Scope, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  return SshKey.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updateSshKey({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  const doc = await SshKey.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('SSH key not found');
  return doc;
}

export async function deleteSshKey({ orgId }: Scope, id: string) {
  const doc = await SshKey.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('SSH key not found');
  return doc;
}

// ---------- Platforms + backup codes ----------
export function listPlatforms({ orgId }: Scope) {
  return Platform.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export async function createPlatform({ orgId, userId }: Scope, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  return Platform.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updatePlatform({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  await assertProjectInOrg(orgId, data);
  const doc = await Platform.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Platform not found');
  return doc;
}

export async function deletePlatform({ orgId }: Scope, id: string) {
  const doc = await Platform.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('Platform not found');
  return doc;
}

export async function addBackupCodes(
  { orgId }: Scope,
  id: string,
  codes: { encrypted_code: string }[],
) {
  const platform = await Platform.findOne({ _id: id, org_id: orgId });
  if (!platform) throw new NotFoundError('Platform not found');
  for (const c of codes) {
    platform.backup_codes.push({ encrypted_code: c.encrypted_code, is_used: false });
  }
  await platform.save();
  return platform;
}

export async function setBackupCodeUsed(
  { orgId }: Scope,
  id: string,
  codeId: string,
  isUsed: boolean,
) {
  const platform = await Platform.findOne({ _id: id, org_id: orgId });
  if (!platform) throw new NotFoundError('Platform not found');
  const code = platform.backup_codes.id(codeId);
  if (!code) throw new NotFoundError('Backup code not found');
  code.is_used = isUsed;
  code.used_at = isUsed ? new Date() : undefined;
  await platform.save();
  return platform;
}

export async function deleteBackupCode({ orgId }: Scope, id: string, codeId: string) {
  const platform = await Platform.findOne({ _id: id, org_id: orgId });
  if (!platform) throw new NotFoundError('Platform not found');
  const code = platform.backup_codes.id(codeId);
  if (!code) throw new NotFoundError('Backup code not found');
  code.deleteOne();
  await platform.save();
  return platform;
}

// ---------- Projects ----------
export function listProjects({ orgId }: Scope) {
  return Project.find({ org_id: orgId }).sort({ created_at: -1 }).lean();
}

export function createProject({ orgId, userId }: Scope, data: Record<string, unknown>) {
  return Project.create({ ...data, org_id: orgId, created_by: userId });
}

export async function updateProject({ orgId }: Scope, id: string, data: Record<string, unknown>) {
  const doc = await Project.findOneAndUpdate({ _id: id, org_id: orgId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Project not found');
  return doc;
}

export async function deleteProject({ orgId }: Scope, id: string) {
  const doc = await Project.findOneAndDelete({ _id: id, org_id: orgId }).lean();
  if (!doc) throw new NotFoundError('Project not found');
  return doc;
}
