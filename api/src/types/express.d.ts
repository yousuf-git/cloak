import 'express';
import type { Role } from '../models/membership.model.js';

declare global {
  namespace Express {
    interface Request {
      user?: {
        sub: string;
        email: string;
      };
      /** Set by requireOrg: the org this request acts on, and the caller's role in it. */
      org?: {
        id: string;
        role: Role;
      };
    }
  }
}

export {};
