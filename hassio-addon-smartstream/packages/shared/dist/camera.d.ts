import { StreamStats } from './stream';
export interface CameraConfig {
    hostname: string;
    port: string | number;
    username: string;
    password: string;
    autostart?: boolean;
    stream_id?: string;
    rtspUrl?: string;
    snapshotUrl?: string;
    stats?: StreamStats;
    youtubeStreamKey?: string;
    twitchStreamKey?: string;
    defaultPlatform?: 'youtube' | 'twitch' | 'custom';
}
export interface CameraDiscoveryResult {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
}
export interface CameraOperations {
    get: <T>(key: string, defaultValue?: T) => Promise<T>;
    set: (key: string, value: unknown) => Promise<void>;
    del: () => Promise<void>;
    toggle: () => Promise<void>;
}
export interface OnvifCamera {
    hostname: string;
    port: number;
    username: string;
    password: string;
    getStreamUris: () => Promise<Array<{
        uri: string;
    }>>;
    getSnapshotUri: () => Promise<{
        uri: string;
    }>;
}
//# sourceMappingURL=camera.d.ts.map