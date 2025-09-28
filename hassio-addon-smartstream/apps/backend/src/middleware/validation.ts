import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema, ZodError } from 'zod';
import { ValidationError } from '@smart-stream/shared';

export interface ValidatedRequest<T = unknown> extends Request {
  validatedBody: T;
}

export function validateBody<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.body);
      (req as ValidatedRequest<T>).validatedBody = validatedData;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        if (firstError) {
          const field = firstError.path.join('.');
          const message = `Validation failed for field '${field}': ${firstError.message}`;
          const receivedValue = 'received' in firstError ? firstError.received : undefined;
          
          next(new ValidationError(message, field, receivedValue));
        } else {
          next(new ValidationError('Validation failed', '', undefined));
        }
      } else {
        next(error);
      }
    }
  };
}

export function validateQuery<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.query);
      req.query = validatedData as unknown as typeof req.query;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        if (firstError) {
          const field = firstError.path.join('.');
          const message = `Query validation failed for field '${field}': ${firstError.message}`;
          const receivedValue = 'received' in firstError ? firstError.received : undefined;
          
          next(new ValidationError(message, field, receivedValue));
        } else {
          next(new ValidationError('Query validation failed', '', undefined));
        }
      } else {
        next(error);
      }
    }
  };
}

export function validateParams<T>(schema: ZodSchema<T>) {
  return (req: Request, res: Response, next: NextFunction): void => {
    try {
      const validatedData = schema.parse(req.params);
      req.params = validatedData as unknown as typeof req.params;
      next();
    } catch (error) {
      if (error instanceof ZodError) {
        const firstError = error.errors[0];
        if (firstError) {
          const field = firstError.path.join('.');
          const message = `Parameter validation failed for field '${field}': ${firstError.message}`;
          const receivedValue = 'received' in firstError ? firstError.received : undefined;
          
          next(new ValidationError(message, field, receivedValue));
        } else {
          next(new ValidationError('Parameter validation failed', '', undefined));
        }
      } else {
        next(error);
      }
    }
  };
}

// Common validation schemas
export const commonSchemas = {
  hostname: z.string()
    .min(1, 'Hostname is required')
    .max(253, 'Hostname too long')
    .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid hostname format'),
  
  port: z.coerce.number()
    .int('Port must be an integer')
    .min(1, 'Port must be at least 1')
    .max(65535, 'Port must be at most 65535'),
  
  username: z.string()
    .min(1, 'Username is required')
    .max(50, 'Username too long'),
  
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password too long'),
  
  streamId: z.string()
    .min(1, 'Stream ID is required')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid stream ID format')
};
