import type { Types } from 'mongoose';
import { Cred } from '../models/cred.model.js';
import { ApiKey } from '../models/api-key.model.js';
import { AccessKey } from '../models/access-key.model.js';
import { SshKey } from '../models/ssh-key.model.js';
import { Platform } from '../models/platform.model.js';
import { User } from '../models/user.model.js';
import { NotFoundError } from '../lib/errors.js';

type Owner = Types.ObjectId | string;

// ---------- Credentials ----------
export function listCreds(userId: Owner) {
  return Cred.find({ user_id: userId }).sort({ created_at: -1 }).lean();
}

export function createCred(userId: Owner, data: Record<string, unknown>) {
  return Cred.create({ ...data, user_id: userId });
}

export async function updateCred(userId: Owner, id: string, data: Record<string, unknown>) {
  const doc = await Cred.findOneAndUpdate({ _id: id, user_id: userId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Credential not found');
  return doc;
}

export async function deleteCred(userId: Owner, id: string) {
  const res = await Cred.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('Credential not found');
}

// ---------- API Keys ----------
export function listApiKeys(userId: Owner) {
  return ApiKey.find({ user_id: userId }).sort({ created_at: -1 }).lean();
}

export function createApiKey(userId: Owner, data: Record<string, unknown>) {
  return ApiKey.create({ ...data, user_id: userId });
}

export async function updateApiKey(userId: Owner, id: string, data: Record<string, unknown>) {
  const doc = await ApiKey.findOneAndUpdate({ _id: id, user_id: userId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('API key not found');
  return doc;
}

export async function deleteApiKey(userId: Owner, id: string) {
  const res = await ApiKey.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('API key not found');
}

// ---------- Access Keys ----------
export function listAccessKeys(userId: Owner) {
  return AccessKey.find({ user_id: userId }).sort({ created_at: -1 }).lean();
}

export function createAccessKey(userId: Owner, data: Record<string, unknown>) {
  return AccessKey.create({ ...data, user_id: userId });
}

export async function updateAccessKey(userId: Owner, id: string, data: Record<string, unknown>) {
  const doc = await AccessKey.findOneAndUpdate({ _id: id, user_id: userId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Access key not found');
  return doc;
}

export async function deleteAccessKey(userId: Owner, id: string) {
  const res = await AccessKey.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('Access key not found');
}

// ---------- SSH Keys ----------
export function listSshKeys(userId: Owner) {
  return SshKey.find({ user_id: userId }).sort({ created_at: -1 }).lean();
}

export function createSshKey(userId: Owner, data: Record<string, unknown>) {
  return SshKey.create({ ...data, user_id: userId });
}

export async function updateSshKey(userId: Owner, id: string, data: Record<string, unknown>) {
  const doc = await SshKey.findOneAndUpdate({ _id: id, user_id: userId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('SSH key not found');
  return doc;
}

export async function deleteSshKey(userId: Owner, id: string) {
  const res = await SshKey.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('SSH key not found');
}

// ---------- Platforms + backup codes ----------
export function listPlatforms(userId: Owner) {
  return Platform.find({ user_id: userId }).sort({ created_at: -1 }).lean();
}

export function createPlatform(userId: Owner, data: Record<string, unknown>) {
  return Platform.create({ ...data, user_id: userId });
}

export async function updatePlatform(userId: Owner, id: string, data: Record<string, unknown>) {
  const doc = await Platform.findOneAndUpdate({ _id: id, user_id: userId }, { $set: data }, { new: true });
  if (!doc) throw new NotFoundError('Platform not found');
  return doc;
}

export async function deletePlatform(userId: Owner, id: string) {
  const res = await Platform.deleteOne({ _id: id, user_id: userId });
  if (res.deletedCount === 0) throw new NotFoundError('Platform not found');
}

export async function addBackupCodes(
  userId: Owner,
  id: string,
  codes: { encrypted_code: string }[],
) {
  const platform = await Platform.findOne({ _id: id, user_id: userId });
  if (!platform) throw new NotFoundError('Platform not found');
  for (const c of codes) {
    platform.backup_codes.push({ encrypted_code: c.encrypted_code, is_used: false });
  }
  await platform.save();
  return platform;
}

export async function setBackupCodeUsed(
  userId: Owner,
  id: string,
  codeId: string,
  isUsed: boolean,
) {
  const platform = await Platform.findOne({ _id: id, user_id: userId });
  if (!platform) throw new NotFoundError('Platform not found');
  const code = platform.backup_codes.id(codeId);
  if (!code) throw new NotFoundError('Backup code not found');
  code.is_used = isUsed;
  code.used_at = isUsed ? new Date() : undefined;
  await platform.save();
  return platform;
}

export async function deleteBackupCode(userId: Owner, id: string, codeId: string) {
  const platform = await Platform.findOne({ _id: id, user_id: userId });
  if (!platform) throw new NotFoundError('Platform not found');
  const code = platform.backup_codes.id(codeId);
  if (!code) throw new NotFoundError('Backup code not found');
  code.deleteOne();
  await platform.save();
  return platform;
}

// ---------- Projects (embedded on the user) ----------
export async function listProjects(userId: Owner) {
  const user = await User.findById(userId).select('projects');
  return user?.projects ?? [];
}

export async function createProject(userId: Owner, data: Record<string, unknown>) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  user.projects.push(data as never);
  await user.save();
  return user.projects[user.projects.length - 1];
}

export async function updateProject(userId: Owner, id: string, data: Record<string, unknown>) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const project = user.projects.id(id);
  if (!project) throw new NotFoundError('Project not found');
  project.set(data);
  await user.save();
  return project;
}

export async function deleteProject(userId: Owner, id: string) {
  const user = await User.findById(userId);
  if (!user) throw new NotFoundError('User not found');
  const project = user.projects.id(id);
  if (!project) throw new NotFoundError('Project not found');
  project.deleteOne();
  await user.save();
}
