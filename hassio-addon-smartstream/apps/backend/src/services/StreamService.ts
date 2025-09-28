import { spawn, ChildProcess } from 'child_process';
import debug from 'debug';
import { DatabaseService } from './DatabaseService';
import { 
  StreamConfig, 
  StreamStatus, 
  StreamStats, 
  FFmpegOptions,
  StreamError 
} from '@smart-stream/shared';

const log = debug('smart-stream:stream');

export class StreamService {
  private database: DatabaseService | null = null;
  private activeStreams: Map<string, ActiveStream> = new Map();
  private streamCounter = 0;

  public async initialize(database: DatabaseService): Promise<void> {
    try {
      log('Initializing Stream service...');
      this.database = database;
      
      log('Stream service initialized successfully');
    } catch (error) {
      log('Error initializing Stream service:', error);
      throw error;
    }
  }

  public async startStream(config: StreamConfig): Promise<StreamStatus> {
    const streamId = this.generateStreamId();
    
    try {
      log('Starting stream %s with config:', streamId, config);
      
      const ffmpegOptions = this.buildFFmpegOptions(config);
      const process = this.spawnFFmpegProcess(ffmpegOptions);
      
      const stream: ActiveStream = {
        id: streamId,
        config,
        process,
        status: 'starting',
        startTime: new Date(),
        stats: {
          fps: 0,
          size: '0B',
          time: '00:00:00.00',
          bitrate: '0kbits/s',
          speed: '0x',
          cpu: [0, 0, 0]
        }
      };

      this.activeStreams.set(streamId, stream);
      this.setupProcessHandlers(stream);

      // Wait a moment to see if the process starts successfully
      await this.waitForStreamStart(stream);

      return this.getStreamStatus(streamId);
    } catch (error) {
      log('Error starting stream %s:', streamId, error);
      throw new StreamError(`Failed to start stream: ${(error as Error).message}`, streamId, error as Error);
    }
  }

  public async stopStream(streamId: string): Promise<void> {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      throw new StreamError(`Stream ${streamId} not found`, streamId);
    }

    try {
      log('Stopping stream %s', streamId);
      
      stream.status = 'stopping';
      
      // Gracefully terminate the FFmpeg process
      if (stream.process && !stream.process.killed) {
        stream.process.kill('SIGTERM');
        
        // Force kill after 5 seconds if it doesn't stop gracefully
        setTimeout(() => {
          if (stream.process && !stream.process.killed) {
            log('Force killing stream %s process', streamId);
            stream.process.kill('SIGKILL');
          }
        }, 5000);
      }

      stream.endTime = new Date();
      this.activeStreams.delete(streamId);
      
      log('Stream %s stopped successfully', streamId);
    } catch (error) {
      log('Error stopping stream %s:', streamId, error);
      throw new StreamError(`Failed to stop stream: ${(error as Error).message}`, streamId, error as Error);
    }
  }

  public getStreamStatus(streamId: string): StreamStatus {
    const stream = this.activeStreams.get(streamId);
    if (!stream) {
      throw new StreamError(`Stream ${streamId} not found`, streamId);
    }

    const status: StreamStatus = {
      id: stream.id,
      status: stream.status,
      startTime: stream.startTime,
      stats: stream.stats
    };

    if (stream.endTime) {
      status.endTime = stream.endTime;
    }

    if (stream.errorMessage) {
      status.errorMessage = stream.errorMessage;
    }

    return status;
  }

  public getAllStreams(): Record<string, StreamStatus> {
    const result: Record<string, StreamStatus> = {};
    
    for (const [id, stream] of this.activeStreams) {
      const status: StreamStatus = {
        id: stream.id,
        status: stream.status,
        startTime: stream.startTime,
        stats: stream.stats
      };

      if (stream.endTime) {
        status.endTime = stream.endTime;
      }

      if (stream.errorMessage) {
        status.errorMessage = stream.errorMessage;
      }

      result[id] = status;
    }

    return result;
  }

  private generateStreamId(): string {
    this.streamCounter++;
    return `stream-${Date.now()}-${this.streamCounter}`;
  }

  private buildFFmpegOptions(config: StreamConfig): FFmpegOptions {
    const options: FFmpegOptions = {
      input: config.inputUrl,
      videoCodec: 'libx264',
      audioCodec: 'aac',
      preset: 'veryfast',
      crf: 23,
      maxrate: config.bitrate || '2M',
      bufsize: '4M',
      keyint: 60,
      framerate: config.fps || 30,
      resolution: config.resolution || '1920x1080',
      customArgs: [
        '-f', 'flv',
        '-reconnect', '1',
        '-reconnect_streamed', '1',
        '-reconnect_delay_max', '5'
      ]
    };
    
    // Only set output if it's provided
    if (config.outputUrl) {
      options.output = config.outputUrl;
    }
    
    return options;
  }

  private spawnFFmpegProcess(options: FFmpegOptions): ChildProcess {
    const args = this.buildFFmpegArgs(options);
    
    log('Spawning FFmpeg with args:', args);
    
    const process = spawn('ffmpeg', args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    return process;
  }

  private buildFFmpegArgs(options: FFmpegOptions): string[] {
    const args: string[] = [];

    // Input options
    args.push('-i', options.input);

    // Video codec options
    if (options.videoCodec) {
      args.push('-c:v', options.videoCodec);
    }

    // Audio codec options
    if (options.audioCodec) {
      args.push('-c:a', options.audioCodec);
    }

    // Quality options
    if (options.preset) {
      args.push('-preset', options.preset);
    }
    if (options.crf) {
      args.push('-crf', options.crf.toString());
    }
    if (options.maxrate) {
      args.push('-maxrate', options.maxrate);
    }
    if (options.bufsize) {
      args.push('-bufsize', options.bufsize);
    }

    // Frame rate
    if (options.framerate) {
      args.push('-r', options.framerate.toString());
    }

    // Resolution
    if (options.resolution) {
      args.push('-s', options.resolution);
    }

    // Key frame interval
    if (options.keyint) {
      args.push('-g', options.keyint.toString());
    }

    // Custom arguments
    if (options.customArgs) {
      args.push(...options.customArgs);
    }

    // Output
    if (options.output) {
      args.push(options.output);
    }

    return args;
  }

  private setupProcessHandlers(stream: ActiveStream): void {
    const { process, id } = stream;

    process.on('spawn', () => {
      log('Stream %s process spawned', id);
      stream.status = 'running';
    });

    process.on('error', (error) => {
      log('Stream %s process error:', id, error);
      stream.status = 'error';
      stream.errorMessage = error.message;
      stream.endTime = new Date();
    });

    process.on('exit', (code, signal) => {
      log('Stream %s process exited with code %s, signal %s', id, code, signal);
      
      if (stream.status !== 'stopping') {
        stream.status = 'error';
        stream.errorMessage = `Process exited unexpectedly (code: ${code}, signal: ${signal})`;
      } else {
        stream.status = 'idle';
      }
      
      stream.endTime = new Date();
    });

    // Parse FFmpeg stderr for progress information
    process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.parseFFmpegProgress(stream, output);
    });

    process.stdout?.on('data', (data) => {
      // Handle stdout if needed
      log('Stream %s stdout:', id, data.toString().trim());
    });
  }

  private parseFFmpegProgress(stream: ActiveStream, output: string): void {
    // Parse FFmpeg progress from stderr
    // This is a simplified parser - you might want to use ffmpeg-progress-stream
    const lines = output.split('\n');
    
    for (const line of lines) {
      if (line.includes('fps=')) {
        const fpsMatch = line.match(/fps=\s*(\d+(?:\.\d+)?)/);
        if (fpsMatch && fpsMatch[1]) {
          stream.stats.fps = parseFloat(fpsMatch[1]);
        }
      }
      
      if (line.includes('size=')) {
        const sizeMatch = line.match(/size=\s*(\S+)/);
        if (sizeMatch && sizeMatch[1]) {
          stream.stats.size = sizeMatch[1];
        }
      }
      
      if (line.includes('time=')) {
        const timeMatch = line.match(/time=\s*(\S+)/);
        if (timeMatch && timeMatch[1]) {
          stream.stats.time = timeMatch[1];
        }
      }
      
      if (line.includes('bitrate=')) {
        const bitrateMatch = line.match(/bitrate=\s*(\S+)/);
        if (bitrateMatch && bitrateMatch[1]) {
          stream.stats.bitrate = bitrateMatch[1];
        }
      }
      
      if (line.includes('speed=')) {
        const speedMatch = line.match(/speed=\s*(\S+)/);
        if (speedMatch && speedMatch[1]) {
          stream.stats.speed = speedMatch[1];
        }
      }
    }
  }

  private async waitForStreamStart(stream: ActiveStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        if (stream.status === 'starting') {
          reject(new Error('Stream start timeout'));
        }
      }, 10000); // 10 second timeout

      const checkStatus = () => {
        if (stream.status === 'running') {
          clearTimeout(timeout);
          resolve();
        } else if (stream.status === 'error') {
          clearTimeout(timeout);
          reject(new Error(stream.errorMessage || 'Stream failed to start'));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      setTimeout(checkStatus, 100);
    });
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // In development mode, consider the service healthy if it's initialized
      // In production (Home Assistant), check if FFmpeg is available
      const isDevelopment = process.env.NODE_ENV === 'development' || process.env.NODE_ENV !== 'production';
      
      if (isDevelopment) {
        // For development, just check if the service is initialized
        return this.database !== null;
      }
      
      // For production, check if FFmpeg is available
      const testProcess = spawn('ffmpeg', ['-version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        testProcess.on('exit', (code) => {
          resolve(code === 0);
        });
        
        testProcess.on('error', () => {
          log('FFmpeg not available for streaming service');
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          testProcess.kill();
          resolve(false);
        }, 5000);
      });
    } catch {
      return false;
    }
  }
}

interface ActiveStream {
  id: string;
  config: StreamConfig;
  process: ChildProcess;
  status: StreamStatus['status'];
  startTime: Date;
  endTime?: Date;
  errorMessage?: string;
  stats: StreamStats;
}
