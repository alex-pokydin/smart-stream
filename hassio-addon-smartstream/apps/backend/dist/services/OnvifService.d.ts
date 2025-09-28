import { DatabaseService } from './DatabaseService';
import { CameraDiscoveryResult, OnvifCamera } from '@smart-stream/shared';
export declare class OnvifService {
    private database;
    private discoveryCache;
    private lastDiscovery;
    initialize(database: DatabaseService): Promise<void>;
    discoverCameras(timeout?: number): Promise<CameraDiscoveryResult[]>;
    getCamera(options: {
        hostname: string;
        port: number;
        username?: string;
        password?: string;
    }): Promise<OnvifCamera>;
    getCameraStreams(camera: OnvifCamera): Promise<Array<{
        uri: string;
    }>>;
    getCameraSnapshot(camera: OnvifCamera): Promise<{
        uri: string;
    }>;
    testCameraConnection(config: {
        hostname: string;
        port: number;
        username: string;
        password: string;
    }): Promise<boolean>;
    getDiscoveryCache(): {
        cameras: CameraDiscoveryResult[];
        lastDiscovery: Date | null;
        cacheAge: number | null;
    };
    refreshDiscovery(): Promise<CameraDiscoveryResult[]>;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=OnvifService.d.ts.map