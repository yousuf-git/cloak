import { Router } from 'express';
import { requireAuth } from '../middlewares/require-auth.js';
import { validate } from '../middlewares/validate.js';
import {
  idParamSchema,
  projectCreateSchema,
  projectUpdateSchema,
  credCreateSchema,
  credUpdateSchema,
  apiKeyCreateSchema,
  apiKeyUpdateSchema,
  accessKeyCreateSchema,
  accessKeyUpdateSchema,
  sshKeyCreateSchema,
  sshKeyUpdateSchema,
  platformCreateSchema,
  platformUpdateSchema,
  backupCodesAddSchema,
  backupCodeUsedSchema,
  codeParamSchema,
  envListQuerySchema,
  envCreateSchema,
  envUpdateSchema,
} from '../validators/vault.validators.js';
import * as v from '../controllers/vault.controller.js';

export const vaultRouter = Router();
vaultRouter.use(requireAuth);

// Credentials
vaultRouter.get('/creds', v.listCreds);
vaultRouter.post('/creds', validate({ body: credCreateSchema }), v.createCred);
vaultRouter.patch('/creds/:id', validate({ params: idParamSchema, body: credUpdateSchema }), v.updateCred);
vaultRouter.delete('/creds/:id', validate({ params: idParamSchema }), v.deleteCred);

// API keys
vaultRouter.get('/api-keys', v.listApiKeys);
vaultRouter.post('/api-keys', validate({ body: apiKeyCreateSchema }), v.createApiKey);
vaultRouter.patch('/api-keys/:id', validate({ params: idParamSchema, body: apiKeyUpdateSchema }), v.updateApiKey);
vaultRouter.delete('/api-keys/:id', validate({ params: idParamSchema }), v.deleteApiKey);

// Access keys (access key ID + secret access key)
vaultRouter.get('/access-keys', v.listAccessKeys);
vaultRouter.post('/access-keys', validate({ body: accessKeyCreateSchema }), v.createAccessKey);
vaultRouter.patch('/access-keys/:id', validate({ params: idParamSchema, body: accessKeyUpdateSchema }), v.updateAccessKey);
vaultRouter.delete('/access-keys/:id', validate({ params: idParamSchema }), v.deleteAccessKey);

// SSH keys (import-only)
vaultRouter.get('/ssh-keys', v.listSshKeys);
vaultRouter.post('/ssh-keys', validate({ body: sshKeyCreateSchema }), v.createSshKey);
vaultRouter.patch('/ssh-keys/:id', validate({ params: idParamSchema, body: sshKeyUpdateSchema }), v.updateSshKey);
vaultRouter.delete('/ssh-keys/:id', validate({ params: idParamSchema }), v.deleteSshKey);

// Platforms + backup codes
vaultRouter.get('/platforms', v.listPlatforms);
vaultRouter.post('/platforms', validate({ body: platformCreateSchema }), v.createPlatform);
vaultRouter.patch('/platforms/:id', validate({ params: idParamSchema, body: platformUpdateSchema }), v.updatePlatform);
vaultRouter.delete('/platforms/:id', validate({ params: idParamSchema }), v.deletePlatform);
vaultRouter.post('/platforms/:id/codes', validate({ params: idParamSchema, body: backupCodesAddSchema }), v.addBackupCodes);
vaultRouter.patch('/platforms/:id/codes/:codeId', validate({ params: codeParamSchema, body: backupCodeUsedSchema }), v.setBackupCodeUsed);
vaultRouter.delete('/platforms/:id/codes/:codeId', validate({ params: codeParamSchema }), v.deleteBackupCode);

// Env files (Cloudinary-backed encrypted blobs)
vaultRouter.get('/env-files', validate({ query: envListQuerySchema }), v.listEnvFiles);
vaultRouter.post('/env-files', validate({ body: envCreateSchema }), v.createEnvFile);
vaultRouter.get('/env-files/:id/raw', validate({ params: idParamSchema }), v.getEnvRaw);
vaultRouter.patch('/env-files/:id', validate({ params: idParamSchema, body: envUpdateSchema }), v.updateEnvFile);
vaultRouter.delete('/env-files/:id', validate({ params: idParamSchema }), v.deleteEnvFile);

// Projects (embedded)
vaultRouter.get('/projects', v.listProjects);
vaultRouter.post('/projects', validate({ body: projectCreateSchema }), v.createProject);
vaultRouter.patch('/projects/:id', validate({ params: idParamSchema, body: projectUpdateSchema }), v.updateProject);
vaultRouter.delete('/projects/:id', validate({ params: idParamSchema }), v.deleteProject);
