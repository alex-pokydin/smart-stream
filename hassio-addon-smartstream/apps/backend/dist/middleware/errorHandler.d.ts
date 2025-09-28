import { Request, Response, NextFunction } from 'express';
export interface CustomError extends Error {
    status?: number;
    code?: string;
    details?: Record<string, unknown>;
}
export declare function errorHandler(error: CustomError, req: Request, res: Response, next: NextFunction): void;
//# sourceMappingURL=errorHandler.d.ts.map