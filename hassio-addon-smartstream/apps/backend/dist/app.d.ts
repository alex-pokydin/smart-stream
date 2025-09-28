import express from 'express';
import { createServer } from 'http';
import { DatabaseService } from './services/DatabaseService';
import { OnvifService } from './services/OnvifService';
import { StreamService } from './services/StreamService';
export declare class SmartStreamApp {
    app: express.Application;
    server: ReturnType<typeof createServer>;
    database: DatabaseService;
    onvif: OnvifService;
    streaming: StreamService;
    constructor();
    initialize(): Promise<void>;
    private setupMiddleware;
    private initializeServices;
    private setupRoutes;
    private setupErrorHandling;
    private startAutostartCameras;
    start(port?: number): Promise<void>;
    stop(): Promise<void>;
}
//# sourceMappingURL=app.d.ts.map