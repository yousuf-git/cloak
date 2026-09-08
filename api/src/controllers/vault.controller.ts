import type { Request, Response } from 'express';
import { asyncHandler, created, ok } from '../lib/http.js';
import { UnauthorizedError, ForbiddenError } from '../lib/errors.js';
import { assertCan, type Action } from '../lib/permissions.js';
import * as vault from '../services/vault.service.js';
import * as envFiles from '../services/env-file.service.js';
import { recordAudit } from '../services/audit.service.js';
import type { Scope } from '../services/vault.service.js';

/**
 * Resolve the acting scope and check the caller's role in one step. Every
 * handler goes through here, so a missing permission check is visible as a
 * missing argument rather than a silently absent line.
 */
function scope(req: Request, action: Action): Scope {
  if (!req.user) throw new UnauthorizedError();
  if (!req.org) throw new ForbiddenError('No organization selected');
  assertCan(req.org.role, action);
  return { orgId: req.org.id, userId: req.user.sub };
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function audit(req: Request, action: string, resource: string, resourceId: string) {
  return recordAudit({
    action,
    orgId: req.org?.id,
    userId: req.user?.sub,
    resource,
    resourceId,
    req,
  });
}

// ---------- Credentials ----------
export const listCreds = asyncHandler(async (req, res) =>
  ok(res, await vault.listCreds(scope(req, 'vault:read'))),
);
export const createCred = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createCred(scope(req, 'vault:write'), req.body);
  await audit(req, 'cred:create', 'Cred', doc.id);
  created(res, doc);
});
export const updateCred = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateCred(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'cred:update', 'Cred', param(req, 'id'));
  ok(res, doc);
});
export const deleteCred = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteCred(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'cred:delete', 'Cred', param(req, 'id'));
  ok(res, { success: true });
});

// ---------- API Keys ----------
export const listApiKeys = asyncHandler(async (req, res) =>
  ok(res, await vault.listApiKeys(scope(req, 'vault:read'))),
);
export const createApiKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createApiKey(scope(req, 'vault:write'), req.body);
  await audit(req, 'apikey:create', 'ApiKey', doc.id);
  created(res, doc);
});
export const updateApiKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateApiKey(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'apikey:update', 'ApiKey', param(req, 'id'));
  ok(res, doc);
});
export const deleteApiKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteApiKey(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'apikey:delete', 'ApiKey', param(req, 'id'));
  ok(res, { success: true });
});

// ---------- Access Keys ----------
export const listAccessKeys = asyncHandler(async (req, res) =>
  ok(res, await vault.listAccessKeys(scope(req, 'vault:read'))),
);
export const createAccessKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createAccessKey(scope(req, 'vault:write'), req.body);
  await audit(req, 'accesskey:create', 'AccessKey', doc.id);
  created(res, doc);
});
export const updateAccessKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateAccessKey(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'accesskey:update', 'AccessKey', param(req, 'id'));
  ok(res, doc);
});
export const deleteAccessKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteAccessKey(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'accesskey:delete', 'AccessKey', param(req, 'id'));
  ok(res, { success: true });
});

// ---------- SSH Keys ----------
export const listSshKeys = asyncHandler(async (req, res) =>
  ok(res, await vault.listSshKeys(scope(req, 'vault:read'))),
);
export const createSshKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createSshKey(scope(req, 'vault:write'), req.body);
  await audit(req, 'sshkey:create', 'SshKey', doc.id);
  created(res, doc);
});
export const updateSshKey = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateSshKey(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'sshkey:update', 'SshKey', param(req, 'id'));
  ok(res, doc);
});
export const deleteSshKey = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteSshKey(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'sshkey:delete', 'SshKey', param(req, 'id'));
  ok(res, { success: true });
});

// ---------- Platforms + backup codes ----------
export const listPlatforms = asyncHandler(async (req, res) =>
  ok(res, await vault.listPlatforms(scope(req, 'vault:read'))),
);
export const createPlatform = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createPlatform(scope(req, 'vault:write'), req.body);
  await audit(req, 'platform:create', 'Platform', doc.id);
  created(res, doc);
});
export const updatePlatform = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updatePlatform(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'platform:update', 'Platform', param(req, 'id'));
  ok(res, doc);
});
export const deletePlatform = asyncHandler(async (req: Request, res: Response) => {
  await vault.deletePlatform(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'platform:delete', 'Platform', param(req, 'id'));
  ok(res, { success: true });
});
export const addBackupCodes = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.addBackupCodes(
    scope(req, 'vault:write'),
    param(req, 'id'),
    req.body.backup_codes,
  );
  await audit(req, 'platform:codes_add', 'Platform', param(req, 'id'));
  ok(res, doc);
});
export const setBackupCodeUsed = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.setBackupCodeUsed(
    scope(req, 'vault:write'),
    param(req, 'id'),
    param(req, 'codeId'),
    req.body.is_used,
  );
  await audit(req, 'platform:code_used', 'Platform', param(req, 'id'));
  ok(res, doc);
});
export const deleteBackupCode = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.deleteBackupCode(
    scope(req, 'vault:write'),
    param(req, 'id'),
    param(req, 'codeId'),
  );
  await audit(req, 'platform:code_delete', 'Platform', param(req, 'id'));
  ok(res, doc);
});

// ---------- Projects ----------
export const listProjects = asyncHandler(async (req, res) =>
  ok(res, await vault.listProjects(scope(req, 'vault:read'))),
);
export const createProject = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.createProject(scope(req, 'vault:write'), req.body);
  await audit(req, 'project:create', 'Project', doc.id);
  created(res, doc);
});
export const updateProject = asyncHandler(async (req: Request, res: Response) => {
  const doc = await vault.updateProject(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'project:update', 'Project', param(req, 'id'));
  ok(res, doc);
});
export const deleteProject = asyncHandler(async (req: Request, res: Response) => {
  await vault.deleteProject(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'project:delete', 'Project', param(req, 'id'));
  ok(res, { success: true });
});

// ---------- Env files ----------
export const listEnvFiles = asyncHandler(async (req: Request, res: Response) => {
  const projectId = typeof req.query.project_id === 'string' ? req.query.project_id : undefined;
  ok(res, await envFiles.listEnvFiles(scope(req, 'vault:read'), projectId));
});
export const createEnvFile = asyncHandler(async (req: Request, res: Response) => {
  const doc = await envFiles.createEnvFile(scope(req, 'vault:write'), req.body);
  await audit(req, 'env:create', 'EnvFile', String(doc._id));
  created(res, doc);
});
export const getEnvRaw = asyncHandler(async (req: Request, res: Response) => {
  const content = await envFiles.getEnvRaw(scope(req, 'vault:read'), param(req, 'id'));
  await audit(req, 'env:view', 'EnvFile', param(req, 'id'));
  ok(res, { content });
});
export const updateEnvFile = asyncHandler(async (req: Request, res: Response) => {
  const doc = await envFiles.updateEnvFile(scope(req, 'vault:write'), param(req, 'id'), req.body);
  await audit(req, 'env:update', 'EnvFile', param(req, 'id'));
  ok(res, doc);
});
export const deleteEnvFile = asyncHandler(async (req: Request, res: Response) => {
  await envFiles.deleteEnvFile(scope(req, 'vault:write'), param(req, 'id'));
  await audit(req, 'env:delete', 'EnvFile', param(req, 'id'));
  ok(res, { success: true });
});
