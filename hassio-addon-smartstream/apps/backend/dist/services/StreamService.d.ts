import { DatabaseService } from './DatabaseService';
import { StreamConfig, StreamStatus } from '@smart-stream/shared';
export declare class StreamService {
    private database;
    private activeStreams;
    private streamCounter;
    initialize(database: DatabaseService): Promise<void>;
    startStream(config: StreamConfig): Promise<StreamStatus>;
    stopStream(streamId: string): Promise<void>;
    getStreamStatus(streamId: string): StreamStatus;
    getAllStreams(): Record<string, StreamStatus>;
    private generateStreamId;
    private buildFFmpegOptions;
    private buildPlatformUrl;
    private buildYouTubeUrl;
    private buildTwitchUrl;
    private spawnFFmpegProcess;
    private buildFFmpegArgs;
    private setupProcessHandlers;
    private parseFFmpegProgress;
    private setupStreamMonitoring;
    private waitForStreamStart;
    testRtspConnection(rtspUrl: string): Promise<{
        success: boolean;
        output: string;
        error?: string;
    }>;
    getFFmpegInfo(): {
        path: string;
        version: string;
    };
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=StreamService.d.ts.map