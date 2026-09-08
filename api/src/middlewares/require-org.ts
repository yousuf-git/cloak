import type { Request, Response, NextFunction } from 'express';
import { Membership } from '../models/membership.model.js';
import { ForbiddenError, UnauthorizedError, ValidationError } from '../lib/errors.js';

const ORG_HEADER = 'x-cloak-org';
const OBJECT_ID = /^[a-f\d]{24}$/i;

/**
 * Resolve the org the request acts on and the caller's role in it. Reads the
 * `:orgId` route param when present, otherwise the X-Cloak-Org header. Only an
 * active membership counts — a member awaiting their key grant has no access.
 *
 * Mount after requireAuth.
 */
export function requireOrg(req: Request, _res: Response, next: NextFunction): void {
  if (!req.user) throw new UnauthorizedError();

  const header = req.headers[ORG_HEADER];
  const fromHeader = Array.isArray(header) ? header[0] : header;
  const fromParams = req.params.orgId;
  const orgId = typeof fromParams === 'string' ? fromParams : fromHeader;

  if (!orgId || !OBJECT_ID.test(orgId)) {
    throw new ValidationError('Missing or malformed organization id');
  }

  Membership.findOne({ org_id: orgId, user_id: req.user.sub, status: 'active' })
    .lean()
    .then((membership) => {
      if (!membership) {
        throw new ForbiddenError('You are not a member of this organization');
      }
      req.org = { id: orgId, role: membership.role };
      next();
    })
    .catch(next);
}
