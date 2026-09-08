import type { Request, Response } from 'express';
import { asyncHandler, created, ok } from '../lib/http.js';
import { ForbiddenError, UnauthorizedError } from '../lib/errors.js';
import { assertCan, type Action } from '../lib/permissions.js';
import type { Role } from '../models/membership.model.js';
import * as orgs from '../services/org.service.js';
import * as invitations from '../services/invitation.service.js';
import * as audit from '../services/audit-query.service.js';
import { recordAudit } from '../services/audit.service.js';
import { setIdentity } from '../services/auth.service.js';

function actor(req: Request): { userId: string; email: string } {
  if (!req.user) throw new UnauthorizedError();
  return { userId: req.user.sub, email: req.user.email };
}

function orgContext(req: Request, action: Action): { orgId: string; role: Role; userId: string } {
  const { userId } = actor(req);
  if (!req.org) throw new ForbiddenError('No organization selected');
  assertCan(req.org.role, action);
  return { orgId: req.org.id, role: req.org.role, userId };
}

function param(req: Request, key: string): string {
  const value = req.params[key];
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function trail(req: Request, action: string, resource: string, resourceId?: string) {
  return recordAudit({
    action,
    orgId: req.org?.id,
    userId: req.user?.sub,
    resource,
    resourceId,
    req,
  });
}

// ---------- Identity ----------
export const publishIdentity = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = actor(req);
  const { identity_public_key, wrapped_identity_sk } = req.body;
  await setIdentity(userId, identity_public_key, wrapped_identity_sk);
  ok(res, { identity_public_key });
});

// ---------- Organizations ----------
export const listOrgs = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = actor(req);
  ok(res, await orgs.listOrgsForUser(userId));
});

export const createOrg = asyncHandler(async (req: Request, res: Response) => {
  const { userId } = actor(req);
  const org = await orgs.createOrg(userId, req.body);
  await recordAudit({ action: 'org:create', orgId: org.id, userId, resource: 'Org', resourceId: org.id, req });
  created(res, org);
});

export const renameOrg = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'org:manage');
  const org = await orgs.renameOrg(orgId, req.body.name);
  await trail(req, 'org:rename', 'Org', orgId);
  ok(res, org);
});

export const deleteOrg = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = orgContext(req, 'org:own');
  // Audit before the delete: the org's own rows go with it.
  await trail(req, 'org:delete', 'Org', orgId);
  await orgs.deleteOrg(orgId, userId);
  ok(res, { success: true });
});

export const transferOwnership = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = orgContext(req, 'org:own');
  await orgs.transferOwnership(orgId, userId, req.body.user_id);
  await trail(req, 'org:transfer', 'Org', orgId);
  ok(res, { success: true });
});

// ---------- Members ----------
export const listMembers = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'vault:read');
  const status = req.query.status as 'pending_key' | 'active' | undefined;
  ok(res, await orgs.listMembers(orgId, status));
});

export const getMember = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'vault:read');
  ok(res, await orgs.getMemberDetail(orgId, param(req, 'userId')));
});

export const grantMemberKey = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = orgContext(req, 'member:manage');
  const targetId = param(req, 'userId');
  await orgs.grantMemberKey(orgId, targetId, req.body.wrapped_org_dek, userId);
  await trail(req, 'member:grant', 'Membership', targetId);
  ok(res, { success: true });
});

export const changeRole = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, role } = orgContext(req, 'member:manage');
  const targetId = param(req, 'userId');
  await orgs.changeRole(orgId, role, targetId, req.body.role);
  await trail(req, 'member:role_change', 'Membership', targetId);
  ok(res, { success: true });
});

export const removeMember = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, role } = orgContext(req, 'member:manage');
  const targetId = param(req, 'userId');
  await orgs.removeMember(orgId, role, targetId);
  await trail(req, 'member:remove', 'Membership', targetId);
  ok(res, { success: true });
});

// ---------- Invitations ----------
export const listInvitations = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'member:manage');
  ok(res, await invitations.listInvitations(orgId));
});

export const createInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = orgContext(req, 'member:manage');
  const invitation = await invitations.createInvitation(orgId, userId, req.body.email, req.body.role);
  await trail(req, 'member:invite', 'Invitation', invitation.id);
  created(res, invitation);
});

export const revokeInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'member:manage');
  const invitationId = param(req, 'invitationId');
  await invitations.revokeInvitation(orgId, invitationId);
  await trail(req, 'member:invite_revoke', 'Invitation', invitationId);
  ok(res, { success: true });
});

export const peekInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { email } = actor(req);
  ok(res, await invitations.peekInvitation(param(req, 'token'), email));
});

export const acceptInvitation = asyncHandler(async (req: Request, res: Response) => {
  const { userId, email } = actor(req);
  const result = await invitations.acceptInvitation(param(req, 'token'), userId, email);
  await recordAudit({
    action: 'member:accept',
    orgId: result.org_id,
    userId,
    resource: 'Membership',
    resourceId: userId,
    req,
  });
  created(res, result);
});

// ---------- Break-glass ----------
export const startBreakGlass = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'org:own');
  ok(res, await orgs.getRecoveryEnvelope(orgId));
});

export const finishBreakGlass = asyncHandler(async (req: Request, res: Response) => {
  const { orgId, userId } = orgContext(req, 'org:own');
  await orgs.restoreOwnerAccess(orgId, userId, req.body.wrapped_org_dek);
  await trail(req, 'org:break_glass', 'Org', orgId);
  ok(res, { success: true });
});

// ---------- Audit ----------
function auditFilter(req: Request) {
  const q = req.query as Record<string, unknown>;
  return {
    action: q.action as string | undefined,
    userId: q.user_id as string | undefined,
    from: q.from as Date | undefined,
    to: q.to as Date | undefined,
    cursor: q.cursor as string | undefined,
    limit: (q.limit as number | undefined) ?? 50,
  };
}

export const listAudit = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'audit:read');
  ok(res, await audit.listAuditLogs(orgId, auditFilter(req)));
});

export const exportAudit = asyncHandler(async (req: Request, res: Response) => {
  const { orgId } = orgContext(req, 'audit:read');
  const page = await audit.listAuditLogs(orgId, { ...auditFilter(req), limit: 5000 });
  await trail(req, 'audit:export', 'AuditLog');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="cloak-audit.csv"');
  res.send(audit.toCsv(page.entries));
});
