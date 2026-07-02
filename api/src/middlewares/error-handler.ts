import type { Request, Response, NextFunction } from 'express';
import { AppError } from '../lib/errors.js';
import { logger } from '../lib/logger.js';

/** 404 for unmatched routes. Registered after all routes. */
export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    status: 'error',
    code: 'NOT_FOUND',
    message: `Route ${req.method} ${req.path} not found`,
  });
}

/** Global error handler. MUST be registered last. */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  _next: NextFunction,
): void {
  if (err instanceof AppError) {
    if (!err.isOperational || err.statusCode >= 500) {
      req.log?.error({ err }, 'Operational server error');
    }
    res.status(err.statusCode).json({
      status: 'error',
      code: err.code,
      message: err.message,
      ...(err.details ? { errors: err.details } : {}),
    });
    return;
  }

  (req.log ?? logger).error({ err }, 'Unexpected error');
  res.status(500).json({
    status: 'error',
    code: 'INTERNAL_ERROR',
    message: 'Something went wrong',
  });
}
