import axios from 'axios';
import { 
  ApiResponse, 
  CameraConfig, 
  CameraDiscoveryResult,
  StreamStatus,
  HealthCheckResponse,
  AddCameraRequest,
  UpdateCameraRequest,
  StartStreamRequest
} from '@smart-stream/shared';

// Detect API base URL for Home Assistant ingress compatibility
const getApiBaseURL = (): string => {
  if (typeof window !== 'undefined') {
    const pathname = window.location.pathname;
    // Home Assistant ingress URLs look like: /api/hassio_ingress/TOKEN/
    const ingressMatch = pathname.match(/^(\/api\/hassio_ingress\/[^\/]+)/);
    if (ingressMatch) {
      return `${ingressMatch[1]}/api/v1`;
    }
  }
  return '/api/v1';
};

// Create axios instance with default config
const api = axios.create({
  baseURL: getApiBaseURL(),
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Response interceptor for error handling
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const message = error.response?.data?.message || error.message || 'An error occurred';
    throw new Error(message);
  }
);

// Camera API
export const cameraService = {
  async getCameras(): Promise<Record<string, CameraConfig>> {
    const response = await api.get<ApiResponse<{ cameras: Record<string, CameraConfig> }>>('/cameras');
    return response.data.data?.cameras || {};
  },

  async getCamera(hostname: string): Promise<CameraConfig> {
    const response = await api.get<ApiResponse<CameraConfig>>(`/cameras/${hostname}`);
    if (!response.data.data) throw new Error('Camera not found');
    return response.data.data;
  },

  async addCamera(camera: AddCameraRequest): Promise<CameraConfig> {
    const response = await api.post<ApiResponse<CameraConfig>>('/cameras', camera);
    if (!response.data.data) throw new Error('Failed to add camera');
    return response.data.data;
  },

  async updateCamera(hostname: string, updates: UpdateCameraRequest): Promise<CameraConfig> {
    const response = await api.put<ApiResponse<CameraConfig>>(`/cameras/${hostname}`, updates);
    if (!response.data.data) throw new Error('Failed to update camera');
    return response.data.data;
  },

  async deleteCamera(hostname: string): Promise<void> {
    await api.delete(`/cameras/${hostname}`);
  },

  async discoverCameras(): Promise<{ cameras: CameraDiscoveryResult[]; duration: number }> {
    const response = await api.post<ApiResponse<{ cameras: CameraDiscoveryResult[]; duration: number }>>('/cameras/discover');
    if (!response.data.data) throw new Error('Discovery failed');
    return response.data.data;
  },

  async testCamera(hostname: string): Promise<{ connected: boolean; timestamp: string }> {
    const response = await api.get<ApiResponse<{ connected: boolean; timestamp: string }>>(`/cameras/${hostname}/test`);
    if (!response.data.data) throw new Error('Test failed');
    return response.data.data;
  },

  async toggleAutostart(hostname: string): Promise<CameraConfig> {
    const response = await api.post<ApiResponse<CameraConfig>>(`/cameras/${hostname}/toggle`);
    if (!response.data.data) throw new Error('Toggle failed');
    return response.data.data;
  },
};

// Stream API
export const streamService = {
  async getStreams(): Promise<Record<string, StreamStatus>> {
    const response = await api.get<ApiResponse<{ streams: Record<string, StreamStatus> }>>('/streams');
    return response.data.data?.streams || {};
  },

  async getStream(streamId: string): Promise<StreamStatus> {
    const response = await api.get<ApiResponse<StreamStatus>>(`/streams/${streamId}`);
    if (!response.data.data) throw new Error('Stream not found');
    return response.data.data;
  },

  async startStream(request: StartStreamRequest): Promise<StreamStatus> {
    const response = await api.post<ApiResponse<StreamStatus>>('/streams', request);
    if (!response.data.data) throw new Error('Failed to start stream');
    return response.data.data;
  },

  async startYouTubeStream(hostname: string, streamKey: string, config?: Partial<StartStreamRequest['config']>): Promise<StreamStatus> {
    const request: StartStreamRequest = {
      hostname,
      platform: 'youtube',
      streamKey,
      config
    };
    return this.startStream(request);
  },

  async startTwitchStream(hostname: string, streamKey: string, config?: Partial<StartStreamRequest['config']>): Promise<StreamStatus> {
    const request: StartStreamRequest = {
      hostname,
      platform: 'twitch', 
      streamKey,
      config
    };
    return this.startStream(request);
  },

  async stopStream(streamId: string): Promise<void> {
    await api.delete(`/streams/${streamId}`);
  },

  async getStreamStats(streamId: string): Promise<{
    streamId: string;
    stats: StreamStatus['stats'];
    status: StreamStatus['status'];
    startTime: StreamStatus['startTime'];
    duration: number;
  }> {
    const response = await api.get(`/streams/${streamId}/stats`);
    if (!response.data.data) throw new Error('Failed to get stream stats');
    return response.data.data;
  },

  async restartStream(streamId: string): Promise<StreamStatus> {
    const response = await api.post<ApiResponse<StreamStatus>>(`/streams/${streamId}/restart`);
    if (!response.data.data) throw new Error('Failed to restart stream');
    return response.data.data;
  },

  async getStreamDiagnostics(streamId: string): Promise<{
    streamId: string;
    status: StreamStatus;
    networkConnectivity: any;
    ffmpegInfo: any;
    timestamp: string;
  }> {
    const response = await api.get(`/streams/${streamId}/diagnostics`);
    if (!response.data.data) throw new Error('Failed to get stream diagnostics');
    return response.data.data;
  },

  async testRtspConnection(hostname: string): Promise<{
    success: boolean;
    data: {
      hostname: string;
      rtspUrl: string;
      testResult: {
        success: boolean;
        error?: string;
        outputLength: number;
      };
    };
    message: string;
  }> {
    const response = await api.post('/streams/test-rtsp', { hostname });
    return response.data;
  },
};

// Health API
export const healthService = {
  async getHealth(): Promise<HealthCheckResponse> {
    const response = await api.get<HealthCheckResponse>('/health');
    return response.data;
  },

  async getDatabaseHealth(): Promise<{ service: string; status: string; timestamp: string }> {
    const response = await api.get('/health/database');
    return response.data;
  },

  async getOnvifHealth(): Promise<{ service: string; status: string; timestamp: string }> {
    const response = await api.get('/health/onvif');
    return response.data;
  },

  async getStreamingHealth(): Promise<{ service: string; status: string; timestamp: string }> {
    const response = await api.get('/health/streaming');
    return response.data;
  },
};

// General API info
export const apiService = {
  async getApiInfo(): Promise<{
    name: string;
    version: string;
    endpoints: Record<string, string>;
    timestamp: string;
  }> {
    const response = await api.get<ApiResponse<{
      name: string;
      version: string;
      endpoints: Record<string, string>;
      timestamp: string;
    }>>('/');
    if (!response.data.data) throw new Error('Failed to get API info');
    return response.data.data;
  },
};

export default api;
