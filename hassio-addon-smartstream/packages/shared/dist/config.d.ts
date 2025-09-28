import { CameraConfig } from './camera';
export interface AppConfig {
    cams: Record<string, CameraConfig>;
    server?: ServerConfig;
    streaming?: StreamingConfig;
}
export interface ServerConfig {
    port?: number;
    host?: string;
    cors?: {
        origin: string | string[];
        credentials: boolean;
    };
    compression?: boolean;
    logging?: {
        level: 'debug' | 'info' | 'warn' | 'error';
        format: 'json' | 'text';
    };
}
export interface StreamingConfig {
    defaultQuality?: string;
    defaultFps?: number;
    defaultResolution?: string;
    outputPath?: string;
    maxConcurrentStreams?: number;
    ffmpegPath?: string;
}
export interface HomeAssistantConfig {
    supervisor?: {
        token: string;
        url: string;
    };
    addon?: {
        name: string;
        version: string;
        slug: string;
    };
    options?: Record<string, unknown>;
}
//# sourceMappingURL=config.d.ts.map