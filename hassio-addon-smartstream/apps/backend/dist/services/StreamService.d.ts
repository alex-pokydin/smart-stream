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
    private spawnFFmpegProcess;
    private buildFFmpegArgs;
    private setupProcessHandlers;
    private parseFFmpegProgress;
    private waitForStreamStart;
    healthCheck(): Promise<boolean>;
}
//# sourceMappingURL=StreamService.d.ts.map