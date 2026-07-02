import type { Request, Response, NextFunction, RequestHandler } from 'express';

/** Consistent success envelope. */
export interface Pagination {
  page: number;
  size: number;
  totalItems: number;
  totalPages: number;
}

export function ok<T>(res: Response, data: T, meta?: { pagination?: Pagination }): Response {
  return res.json(meta ? { data, meta } : { data });
}

export function created<T>(res: Response, data: T): Response {
  return res.status(201).json({ data });
}

/** Wrap async route handlers so thrown/rejected errors reach the error middleware. */
export const asyncHandler =
  (fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
