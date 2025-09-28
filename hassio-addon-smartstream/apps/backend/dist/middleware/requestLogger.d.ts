import { Request, Response, NextFunction } from 'express';
export interface LoggedRequest extends Request {
    startTime?: number;
    requestId?: string;
}
export declare function requestLogger(req: LoggedRequest, res: Response, next: NextFunction): void;
//# sourceMappingURL=requestLogger.d.ts.map