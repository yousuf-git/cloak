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
      if (key === 'query') {
        // req.query is a getter in Express 5 that re-parses the URL on every
        // read, so assigning into it is lost and handlers saw raw strings — a
        // date filter reached the CSV export as text and crashed it. Shadow the
        // getter with the parsed value instead.
        Object.defineProperty(req, 'query', {
          value: result.data,
          writable: true,
          configurable: true,
          enumerable: true,
        });
      } else {
        Object.assign(req[key] as object, result.data);
      }
    }
    next();
  };
