import { CameraConfig, CameraDiscoveryResult } from './camera';
import { StreamStatus, StreamConfig } from './stream';
export interface AddCameraRequest {
    hostname: string;
    port: number;
    username: string;
    password: string;
    autostart?: boolean;
}
export interface UpdateCameraRequest extends Partial<AddCameraRequest> {
    hostname: string;
}
export interface StartStreamRequest {
    hostname: string;
    config?: Partial<StreamConfig>;
}
export interface ApiResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: string;
    message?: string;
}
export interface CameraListResponse {
    cameras: Record<string, CameraConfig>;
}
export interface DiscoveryResponse {
    cameras: CameraDiscoveryResult[];
    duration: number;
}
export interface StreamStatusResponse {
    streams: Record<string, StreamStatus>;
}
export interface HealthCheckResponse {
    status: 'healthy' | 'unhealthy';
    timestamp: string;
    services: {
        database: boolean;
        onvif: boolean;
        streaming: boolean;
    };
}
export interface ApiError {
    code: string;
    message: string;
    details?: Record<string, unknown>;
}
export declare class ValidationError extends Error {
    field: string;
    value: unknown;
    constructor(message: string, field: string, value: unknown);
}
export declare class CameraNotFoundError extends Error {
    constructor(hostname: string);
}
export declare class StreamError extends Error {
    streamId?: string | undefined;
    cause?: Error | undefined;
    constructor(message: string, streamId?: string | undefined, cause?: Error | undefined);
}
//# sourceMappingURL=api.d.ts.map