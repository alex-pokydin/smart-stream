import { Request, Response, NextFunction } from 'express';
import { z, ZodSchema } from 'zod';
export interface ValidatedRequest<T = unknown> extends Request {
    validatedBody: T;
}
export declare function validateBody<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateQuery<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateParams<T>(schema: ZodSchema<T>): (req: Request, res: Response, next: NextFunction) => void;
export declare const commonSchemas: {
    hostname: z.ZodString;
    port: z.ZodNumber;
    username: z.ZodString;
    password: z.ZodString;
    streamId: z.ZodString;
};
//# sourceMappingURL=validation.d.ts.map