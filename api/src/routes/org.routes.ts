import { Router } from 'express';
import { requireAuth } from '../middlewares/require-auth.js';
import { requireOrg } from '../middlewares/require-org.js';
import { validate } from '../middlewares/validate.js';
import { authLimiter } from '../middlewares/rate-limit.js';
import {
  orgIdParamSchema,
  memberParamSchema,
  invitationParamSchema,
  tokenParamSchema,
  orgCreateSchema,
  orgUpdateSchema,
  transferOwnershipSchema,
  grantKeySchema,
  roleChangeSchema,
  invitationCreateSchema,
  breakGlassRestoreSchema,
  memberListQuerySchema,
  auditQuerySchema,
} from '../validators/org.validators.js';
import * as o from '../controllers/org.controller.js';

export const orgRouter = Router();
orgRouter.use(requireAuth);

// Collection-level: no org context yet.
orgRouter.get('/', o.listOrgs);
orgRouter.post('/', validate({ body: orgCreateSchema }), o.createOrg);

// Everything below resolves the org from :orgId and the caller's role in it.
const scoped = Router({ mergeParams: true });
scoped.use(validate({ params: orgIdParamSchema }), requireOrg);

scoped.patch('/', validate({ body: orgUpdateSchema }), o.renameOrg);
scoped.delete('/', o.deleteOrg);
scoped.post('/transfer', validate({ body: transferOwnershipSchema }), o.transferOwnership);

scoped.get('/members', validate({ query: memberListQuerySchema }), o.listMembers);
scoped.get('/members/:userId', validate({ params: memberParamSchema }), o.getMember);
scoped.post(
  '/members/:userId/grant',
  validate({ params: memberParamSchema, body: grantKeySchema }),
  o.grantMemberKey,
);
scoped.patch(
  '/members/:userId',
  validate({ params: memberParamSchema, body: roleChangeSchema }),
  o.changeRole,
);
scoped.delete('/members/:userId', validate({ params: memberParamSchema }), o.removeMember);

scoped.get('/invitations', o.listInvitations);
scoped.post(
  '/invitations',
  authLimiter,
  validate({ body: invitationCreateSchema }),
  o.createInvitation,
);
scoped.delete(
  '/invitations/:invitationId',
  validate({ params: invitationParamSchema }),
  o.revokeInvitation,
);

scoped.post('/break-glass', o.startBreakGlass);
scoped.post('/break-glass/restore', validate({ body: breakGlassRestoreSchema }), o.finishBreakGlass);

scoped.get('/audit', validate({ query: auditQuerySchema }), o.listAudit);
scoped.get('/audit/export.csv', validate({ query: auditQuerySchema }), o.exportAudit);

orgRouter.use('/:orgId', scoped);

// Invitations are answered by the invitee, who is not yet a member — so these
// live outside the org-scoped router.
export const invitationRouter = Router();
invitationRouter.use(requireAuth);
invitationRouter.get('/:token', validate({ params: tokenParamSchema }), o.peekInvitation);
invitationRouter.post(
  '/:token/accept',
  authLimiter,
  validate({ params: tokenParamSchema }),
  o.acceptInvitation,
);
