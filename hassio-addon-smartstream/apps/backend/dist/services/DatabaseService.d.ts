import { CameraConfig, AppConfig, CameraOperations } from '@smart-stream/shared';
export declare class DatabaseService {
    private db;
    private config;
    constructor(dbPath?: string);
    initialize(): Promise<void>;
    private loadConfig;
    get<T = unknown>(path?: string): Promise<T>;
    set<T = unknown>(path: string, value: T): Promise<T>;
    delete(path: string): Promise<void>;
    exists(path: string): Promise<boolean>;
    getCameras(): Promise<Record<string, CameraConfig>>;
    getCamera(hostname: string): Promise<CameraConfig | null>;
    addCamera(camera: CameraConfig): Promise<CameraConfig>;
    updateCamera(hostname: string, updates: Partial<CameraConfig>): Promise<CameraConfig>;
    deleteCamera(hostname: string): Promise<void>;
    setCameras(cameras: CameraConfig[]): Promise<void>;
    getCameraOperations(hostname: string): CameraOperations;
    getConfig(): Promise<AppConfig>;
    updateConfig(updates: Partial<AppConfig>): Promise<AppConfig>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=DatabaseService.d.ts.map