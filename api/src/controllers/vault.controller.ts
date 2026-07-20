import type { Request, Response } from 'express';
import { asyncHandler, created, ok } from '../lib/http.js';
import { UnauthorizedError } from '../lib/errors.js';
import * as vault from '../services/vault.service.js';
import * as envFiles from '../services/env-file.service.js';
import { recordAudit } from '../services/audit.service.js';

function uid(req: Request): string {
  if (!req.user) throw new UnauthorizedError();
  return req.user.sub;
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

// ---------- Credentials ----------
export const listCreds = asyncHandler(async (req, res) => ok(res, await vault.listCreds(uid(req))));
export const createCred = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createCred(uid(req), req.body);
  await recordAudit({ action: 'cred:create', userId: uid(req), resource: 'Cred', resourceId: doc.id, req });
  created(res, doc);
});
export const updateCred = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateCred(uid(req), param(req, 'id'), req.body);
  await recordAudit({ action: 'cred:update', userId: uid(req), resource: 'Cred', resourceId: param(req, 'id'), req });
  ok(res, doc);
});
export const deleteCred = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteCred(uid(req), param(req, 'id'));
  await recordAudit({ action: 'cred:delete', userId: uid(req), resource: 'Cred', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});

// ---------- API Keys ----------
export const listApiKeys = asyncHandler(async (req, res) => ok(res, await vault.listApiKeys(uid(req))));
export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createApiKey(uid(req), req.body);
  await recordAudit({ action: 'apikey:create', userId: uid(req), resource: 'ApiKey', resourceId: doc.id, req });
  created(res, doc);
});
export const updateApiKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateApiKey(uid(req), param(req, 'id'), req.body);
  await recordAudit({ action: 'apikey:update', userId: uid(req), resource: 'ApiKey', resourceId: param(req, 'id'), req });
  ok(res, doc);
});
export const deleteApiKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteApiKey(uid(req), param(req, 'id'));
  await recordAudit({ action: 'apikey:delete', userId: uid(req), resource: 'ApiKey', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});

// ---------- Access Keys ----------
export const listAccessKeys = asyncHandler(async (req, res) => ok(res, await vault.listAccessKeys(uid(req))));
export const createAccessKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createAccessKey(uid(req), req.body);
  await recordAudit({ action: 'accesskey:create', userId: uid(req), resource: 'AccessKey', resourceId: doc.id, req });
  created(res, doc);
});
export const updateAccessKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateAccessKey(uid(req), param(req, 'id'), req.body);
  await recordAudit({ action: 'accesskey:update', userId: uid(req), resource: 'AccessKey', resourceId: param(req, 'id'), req });
  ok(res, doc);
});
export const deleteAccessKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteAccessKey(uid(req), param(req, 'id'));
  await recordAudit({ action: 'accesskey:delete', userId: uid(req), resource: 'AccessKey', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});

// ---------- SSH Keys ----------
export const listSshKeys = asyncHandler(async (req, res) => ok(res, await vault.listSshKeys(uid(req))));
export const createSshKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createSshKey(uid(req), req.body);
  await recordAudit({ action: 'sshkey:create', userId: uid(req), resource: 'SshKey', resourceId: doc.id, req });
  created(res, doc);
});
export const updateSshKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateSshKey(uid(req), param(req, 'id'), req.body);
  await recordAudit({ action: 'sshkey:update', userId: uid(req), resource: 'SshKey', resourceId: param(req, 'id'), req });
  ok(res, doc);
});
export const deleteSshKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteSshKey(uid(req), param(req, 'id'));
  await recordAudit({ action: 'sshkey:delete', userId: uid(req), resource: 'SshKey', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});

// ---------- Platforms + backup codes ----------
export const listPlatforms = asyncHandler(async (req, res) => ok(res, await vault.listPlatforms(uid(req))));
export const createPlatform = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createPlatform(uid(req), req.body);
  await recordAudit({ action: 'platform:create', userId: uid(req), resource: 'Platform', resourceId: doc.id, req });
  created(res, doc);
});
export const updatePlatform = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updatePlatform(uid(req), param(req, 'id'), req.body);
  ok(res, doc);
});
export const deletePlatform = asyncHandler(async (req: Request, res: Response) => {
  await vault.deletePlatform(uid(req), param(req, 'id'));
  await recordAudit({ action: 'platform:delete', userId: uid(req), resource: 'Platform', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});
export const addBackupCodes = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.addBackupCodes(uid(req), param(req, 'id'), req.body.backup_codes);
  ok(res, doc);
});
export const setBackupCodeUsed = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.setBackupCodeUsed(uid(req), param(req, 'id'), param(req, 'codeId'), req.body.is_used);
  ok(res, doc);
});
export const deleteBackupCode = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.deleteBackupCode(uid(req), param(req, 'id'), param(req, 'codeId'));
  ok(res, doc);
});

// ---------- Projects ----------
export const listProjects = asyncHandler(async (req, res) => ok(res, await vault.listProjects(uid(req))));
export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createProject(uid(req), req.body);
  created(res, doc);
});
export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateProject(uid(req), param(req, 'id'), req.body);
  ok(res, doc);
});
export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteProject(uid(req), param(req, 'id'));
  ok(res, { success: true });
});

// ---------- Env files ----------
export const listEnvFiles = asyncHandler(async (req: Request, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  ok(res, await envFiles.listEnvFiles(uid(req), projectId));
});
export const createEnvFile = asyncHandler(async (req: Request, res: Response) => {
  const doc = await envFiles.createEnvFile(uid(req), req.body);
  await recordAudit({ action: 'env:create', userId: uid(req), resource: 'EnvFile', resourceId: String(doc._id), req });
  created(res, doc);
});
export const getEnvRaw = asyncHandler(async (req: Request, res: Response) => {
  const content = await envFiles.getEnvRaw(uid(req), param(req, 'id'));
  await recordAudit({ action: 'env:view', userId: uid(req), resource: 'EnvFile', resourceId: param(req, 'id'), req });
  ok(res, { content });
});
export const updateEnvFile = asyncHandler(async (req: Request, res: Response) => {
  const doc = await envFiles.updateEnvFile(uid(req), param(req, 'id'), req.body);
  await recordAudit({ action: 'env:update', userId: uid(req), resource: 'EnvFile', resourceId: param(req, 'id'), req });
  ok(res, doc);
});
export const deleteEnvFile = asyncHandler(async (req: Request, res: Response) => {
  await envFiles.deleteEnvFile(uid(req), param(req, 'id'));
  await recordAudit({ action: 'env:delete', userId: uid(req), resource: 'EnvFile', resourceId: param(req, 'id'), req });
  ok(res, { success: true });
});
