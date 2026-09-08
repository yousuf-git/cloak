import { z } from 'zod';
import { ROLES } from '../models/membership.model.js';

const objectId = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid id');
const b64 = z.string().min(1).max(4096);
const orgName = z.string().trim().min(1).max(80);
// A role that can actually be assigned — ownership moves via transfer only.
const assignableRole = z.enum(ROLES).exclude(['owner']);

export const orgIdParamSchema = z.object({ orgId: objectId });
export const memberParamSchema = z.object({ orgId: objectId, userId: objectId });
export const invitationParamSchema = z.object({ orgId: objectId, invitationId: objectId });
export const tokenParamSchema = z.object({ token: z.string().min(16).max(512) });

export const orgCreateSchema = z.object({
  name: orgName,
  wrapped_org_dek: b64,
  org_recovery_salt: z.string().min(16).max(512),
  org_recovery_wrappedDEK: b64,
});

export const orgUpdateSchema = z.object({ name: orgName });

export const transferOwnershipSchema = z.object({ user_id: objectId });

export const identitySchema = z.object({
  identity_public_key: z.string().min(32).max(512),
  wrapped_identity_sk: b64,
});

export const grantKeySchema = z.object({ wrapped_org_dek: b64 });

export const roleChangeSchema = z.object({ role: assignableRole });

export const invitationCreateSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  role: assignableRole,
});

export const breakGlassRestoreSchema = z.object({ wrapped_org_dek: b64 });

export const memberListQuerySchema = z.object({
  status: z.enum(['pending_key', 'active']).optional(),
});

export const auditQuerySchema = z.object({
  action: z.string().trim().max(64).optional(),
  user_id: objectId.optional(),
  from: z.coerce.date().optional(),
  to: z.coerce.date().optional(),
  cursor: z.string().max(64).optional(),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});
