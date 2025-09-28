import { CameraConfig, CameraDiscoveryResult } from './camera';
import { StreamStatus, StreamConfig } from './stream';

// API Request Types
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

// API Response Types
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

// Error Types
export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export class ValidationError extends Error {
  constructor(
    message: string,
    public field: string,
    public value: unknown
  ) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class CameraNotFoundError extends Error {
  constructor(hostname: string) {
    super(`Camera with hostname '${hostname}' not found`);
    this.name = 'CameraNotFoundError';
  }
}

export class StreamError extends Error {
  constructor(
    message: string,
    public streamId?: string,
    public cause?: Error
  ) {
    super(message);
    this.name = 'StreamError';
  }
}
