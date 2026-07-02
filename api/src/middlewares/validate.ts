import type { Request, Response, NextFunction, RequestHandler } from 'express';
import type { ZodTypeAny } from 'zod';

interface Schemas {
  body?: ZodTypeAny;
  params?: ZodTypeAny;
  query?: ZodTypeAny;
}

/** Validate request parts with Zod; replaces req parts with parsed, typed data. */
export const validate =
  (schemas: Schemas): RequestHandler =>
  (req: Request, res: Response, next: NextFunction) => {
    for (const key of ['body', 'params', 'query'] as const) {
      const schema = schemas[key];
      if (!schema) continue;
      const result = schema.safeParse(req[key]);
      if (!result.success) {
        return res.status(400).json({
          status: 'error',
          code: 'VALIDATION_ERROR',
          message: 'Validation failed',
          errors: result.error.flatten().fieldErrors,
        });
      }
      // req.query/params are read-only getters in Express 5; assign via defineProperty-safe cast.
      Object.assign(req[key] as object, result.data);
    }
    next();
  };
