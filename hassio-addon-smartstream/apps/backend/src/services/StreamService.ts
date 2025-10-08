import { spawn, ChildProcess } from 'child_process';
import debug from 'debug';
import ffmpegInstaller from '@ffmpeg-installer/ffmpeg';
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
  private autostartStreams: Map<string, { config: StreamConfig; cameraId: string; retryCount: number; lastRetry: Date }> = new Map();
  private recoveryInterval: NodeJS.Timeout | null = null;

  public async initialize(database: DatabaseService): Promise<void> {
    try {
      log('Initializing Stream service...');
      this.database = database;
      
      // Log FFmpeg information
      log('FFmpeg binary path: %s', ffmpegInstaller.path);
      log('FFmpeg version: %s', ffmpegInstaller.version);
      
      // Run network diagnostics on startup
      log('Running network connectivity diagnostics...');
      try {
        const networkTest = await this.testNetworkConnectivity();
        log('Network diagnostics completed - success: %s', networkTest.success);
        log('Network details: %j', networkTest.details);
        
        if (!networkTest.success) {
          log('⚠️ Network connectivity issues detected. Streaming may fail.');
        }
      } catch (error) {
        log('Network diagnostics failed:', error);
      }
      
      // Start the autostart stream recovery monitoring
      this.startRecoveryMonitoring();
      
      log('Stream service initialized successfully');
    } catch (error) {
      log('Error initializing Stream service:', error);
      throw error;
    }
  }

  public async startStream(config: StreamConfig, isAutostart: boolean = false, cameraId?: string): Promise<StreamStatus> {
    const streamId = this.generateStreamId();
    
    try {
      const platform = config.platform?.type || 'custom';
      log('🎬 Starting %s stream %s: %s → %s', 
          platform, streamId, 
          config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), 
          config.platform?.type === 'youtube' ? 'YouTube' : 
          config.platform?.type === 'twitch' ? 'Twitch' : 'Custom');
      
      const ffmpegOptions = await this.buildFFmpegOptions(config);
      
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
      this.setupStreamMonitoring(stream);

      // Track autostart streams for recovery
      if (isAutostart && cameraId) {
        this.autostartStreams.set(streamId, {
          config,
          cameraId,
          retryCount: 0,
          lastRetry: new Date()
        });
        log('📝 Tracking autostart stream %s for camera %s', streamId, cameraId);
      }

      // Wait a moment to see if the process starts successfully
      await this.waitForStreamStart(stream);

      const status = this.getStreamStatus(streamId);
      log('Stream %s startup completed, returning status: %s', streamId, status.status);
      return status;
    } catch (error) {
      log('Error starting stream %s:', streamId, error);
      
      // Check if this might be a network connectivity issue
      const errorMessage = (error as Error).message;
      if (errorMessage.includes('Name or service not known') || 
          errorMessage.includes('Network is unreachable') ||
          errorMessage.includes('Connection refused')) {
        log('Network connectivity issue detected for stream %s, running diagnostics...', streamId);
        
        // Run network diagnostics in the background (don't await to avoid blocking)
        this.testNetworkConnectivity().then(result => {
          log('Network diagnostics for stream %s:', streamId, result);
        }).catch(diagError => {
          log('Network diagnostics failed for stream %s:', streamId, diagError);
        });
      }
      
      // Clean up the failed stream if it was added to the map
      if (this.activeStreams.has(streamId)) {
        const failedStream = this.activeStreams.get(streamId);
        if (failedStream?.process && !failedStream.process.killed) {
          log('Cleaning up failed stream %s process', streamId);
          failedStream.process.kill('SIGTERM');
        }
        this.activeStreams.delete(streamId);
      }
      
      // Provide more helpful error messages for common issues
      let enhancedMessage = `Failed to start stream: ${errorMessage}`;
      if (errorMessage.includes('Name or service not known')) {
        enhancedMessage += '. This appears to be a DNS resolution issue. Please check your network connectivity and DNS settings.';
      } else if (errorMessage.includes('Network is unreachable')) {
        enhancedMessage += '. This appears to be a network connectivity issue. Please check your internet connection.';
      } else if (errorMessage.includes('Connection refused')) {
        enhancedMessage += '. The streaming server is refusing connections. Please verify your stream key and server settings.';
      }
      
      throw new StreamError(enhancedMessage, streamId, error as Error);
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
      
      // Clean up monitoring interval
      if ((stream as any).monitorInterval) {
        clearInterval((stream as any).monitorInterval);
        log('Stream %s monitoring interval cleared', streamId);
      }
      
      // Clean up heartbeat timer
      if ((stream as any).heartbeatTimer) {
        clearInterval((stream as any).heartbeatTimer);
        log('Stream %s heartbeat timer cleared', streamId);
      }
      
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

  private async buildFFmpegOptions(config: StreamConfig): Promise<FFmpegOptions> {
    const options: FFmpegOptions = {
      input: config.inputUrl,
      // Note: video and audio codecs are now handled in buildFFmpegArgs()
      // Using copy mode for video and AAC for audio with null source
      customArgs: [
        // RTMP reconnection settings for better reliability
        '-reconnect', '1',
        '-reconnect_streamed', '1', 
        '-reconnect_delay_max', '5'
      ]
    };
    
    // Build output URL based on platform configuration
    let outputUrl = config.outputUrl;
    
    // Handle platform-specific streaming
    if (config.platform?.type) {
      outputUrl = await this.buildPlatformUrl(config.platform);
    } else if (config.youtubeStreamKey) {
      // Legacy support for direct YouTube stream key
      outputUrl = await this.buildYouTubeUrl(config.youtubeStreamKey);
    }
    
    if (outputUrl) {
      options.output = outputUrl;
    }
    
    return options;
  }

  private async buildPlatformUrl(platform: { type: string; streamKey?: string; serverUrl?: string }): Promise<string> {
    log('Building platform URL - type: %s, hasStreamKey: %s, hasServerUrl: %s', 
        platform.type, !!platform.streamKey, !!platform.serverUrl);
    
    switch (platform.type) {
      case 'youtube':
        return await this.buildYouTubeUrl(platform.streamKey || '');
      case 'twitch':
        return this.buildTwitchUrl(platform.streamKey || '');
      case 'custom':
        if (platform.serverUrl && platform.streamKey) {
          const customUrl = `${platform.serverUrl}/${platform.streamKey}`;
          log('Built custom RTMP URL: %s', customUrl);
          return customUrl;
        }
        log('Custom platform missing serverUrl or streamKey, using serverUrl only: %s', platform.serverUrl);
        return platform.serverUrl || '';
      default:
        log('Unsupported platform type: %s', platform.type);
        throw new StreamError(`Unsupported platform type: ${platform.type}`);
    }
  }

  private async buildYouTubeUrl(streamKey: string): Promise<string> {
    if (!streamKey) {
      throw new StreamError('YouTube stream key is required');
    }
    
    // Use multiple YouTube RTMP endpoints for better reliability
    const rtmpEndpoints = [
      'a.rtmp.youtube.com',
      'b.rtmp.youtube.com', 
      'c.rtmp.youtube.com',
      'd.rtmp.youtube.com'
    ];
    
    // Try to resolve DNS for each endpoint and use the resolved IP directly
    log('Testing YouTube RTMP endpoints for best connectivity...');
    
    for (const endpoint of rtmpEndpoints) {
      try {
        const dns = require('dns').promises;
        const addresses = await dns.lookup(endpoint);
        log('✅ YouTube RTMP endpoint %s resolved to %s', endpoint, addresses.address);
        
        // Use the resolved IP address instead of hostname for FFmpeg
        // This bypasses any DNS issues that FFmpeg might have
        const ipBasedUrl = `rtmp://${addresses.address}/live2/${streamKey}`;
        log('🎯 Using resolved IP for FFmpeg: %s (was %s)', addresses.address, endpoint);
        return ipBasedUrl;
      } catch (error) {
        log('❌ YouTube RTMP endpoint %s failed DNS resolution: %s', endpoint, (error as Error).message);
        continue;
      }
    }
    
    // If all DNS lookups fail, try known IP addresses as fallback
    log('⚠️ All YouTube RTMP endpoints failed DNS resolution, trying static IP fallbacks...');
    
    // These are some known YouTube RTMP server IPs (may change over time)
    const fallbackIPs = [
      '216.58.215.76',   // Current a.rtmp.youtube.com IP from our logs
      '172.217.19.108',  // Current b.rtmp.youtube.com IP from our logs
      '142.250.191.110', // Google IP range
      '172.217.14.110',  // Google IP range
      '216.58.194.110'   // Google IP range
    ];
    
    for (const ip of fallbackIPs) {
      log('🔄 Trying YouTube RTMP static IP fallback: %s', ip);
      const testUrl = `rtmp://${ip}/live2/${streamKey}`;
      // We'll return the first IP and let FFmpeg handle the connection
      log('📡 Using YouTube RTMP static IP: %s', ip);
      return testUrl;
    }
    
    // Final fallback - use the original hostname and let FFmpeg handle it
    log('⚠️ Using original YouTube RTMP hostname as final fallback');
    return `rtmp://a.rtmp.youtube.com/live2/${streamKey}`;
  }

  private buildTwitchUrl(streamKey: string): string {
    if (!streamKey) {
      throw new StreamError('Twitch stream key is required');
    }
    return `rtmp://live.twitch.tv/app/${streamKey}`;
  }

  private spawnFFmpegProcess(options: FFmpegOptions): ChildProcess {
    const args = this.buildFFmpegArgs(options);
    
    log('🚀 Starting FFmpeg: %s → %s', 
        options.input.replace(/\/\/.*@/, '//[CREDENTIALS]@'), 
        options.output?.substring(0, 50) + '...' || 'stdout');
    
    const process = spawn(ffmpegInstaller.path, args, {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    log('FFmpeg process created with PID: %s', process.pid);

    return process;
  }

  private buildFFmpegArgs(options: FFmpegOptions): string[] {
    const args: string[] = [];

    // Always overwrite output files
    args.push('-y');

    // Add progress and verbosity options for better monitoring
    args.push('-loglevel', 'debug');
    args.push('-progress', 'pipe:2');
    
    // RTSP specific options for better reliability
    args.push('-rtsp_transport', 'tcp');  // Force TCP for more reliable connection
    args.push('-fflags', '+genpts');      // Generate presentation timestamps
    args.push('-re');                     // Read input at native frame rate (critical for live streaming)
    args.push('-stimeout', '10000000');   // 10 second connection timeout (microseconds)
    args.push('-analyzeduration', '5000000');  // 5 second analysis timeout
    args.push('-probesize', '1000000');   // Limit probe size to speed up detection

    // Input stream
    args.push('-i', options.input);

    // Add null audio source for video-only streams (YouTube requirement)
    args.push('-f', 'lavfi');
    args.push('-i', 'anullsrc');

    // Use wallclock timestamps for better sync
    args.push('-use_wallclock_as_timestamps', '1');

    // Video: copy without transcoding (much faster and preserves quality)
    args.push('-c:v', 'copy');

    // Audio: encode null audio to AAC (required by YouTube)
    args.push('-c:a', 'aac');

    // Use single thread for more predictable performance
    args.push('-threads', '1');

    // Output format: FLV for RTMP streaming
    args.push('-f', 'flv');

    // Add any remaining custom arguments (filtered to avoid conflicts)
    if (options.customArgs && options.customArgs.length > 0) {
      // Filter out args we've already set to avoid conflicts
      const predefinedArgs = ['-y', '-loglevel', '-progress', '-rtsp_transport', 
                             '-fflags', '-re', '-stimeout', '-analyzeduration', 
                             '-probesize', '-f', '-i', '-use_wallclock_as_timestamps',
                             '-c:v', '-c:a', '-threads'];
      
      const filteredCustomArgs: string[] = [];
      for (let i = 0; i < options.customArgs.length; i++) {
        const arg = options.customArgs[i];
        if (arg && !predefinedArgs.includes(arg)) {
          filteredCustomArgs.push(arg);
          // If this arg has a value, include it too
          const nextArg = options.customArgs[i + 1];
          if (nextArg && i + 1 < options.customArgs.length && !nextArg.startsWith('-')) {
            i++; // Skip to the value
            filteredCustomArgs.push(nextArg);
          }
        } else if (arg) {
          // Skip this predefined arg and its value if present
          const nextArg = options.customArgs[i + 1];
          if (nextArg && i + 1 < options.customArgs.length && !nextArg.startsWith('-')) {
            i++; // Skip the value too
          }
        }
      }
      args.push(...filteredCustomArgs);
    }

    // Output destination
    if (options.output) {
      args.push(options.output);
    }

    return args;
  }

  private setupProcessHandlers(stream: ActiveStream): void {
    const { process, id } = stream;

    process.on('spawn', () => {
      log('🎬 Stream %s process spawned successfully with PID: %s', id, process.pid);
      stream.status = 'running';
      
      // Log process details for debugging
      log('Stream %s process details - PID: %s, killed: %s, exitCode: %s', 
          id, process.pid, process.killed, process.exitCode);
    });

    process.on('error', (error) => {
      log('❌ Stream %s process spawn error:', id, error);
      log('Stream %s error details - name: %s, message: %s, code: %s, errno: %s, syscall: %s', 
          id, error.name, error.message, (error as any).code, (error as any).errno, (error as any).syscall);
      
      stream.status = 'error';
      stream.errorMessage = `Process spawn error: ${error.message}`;
      stream.endTime = new Date();
      
      // Log system information for debugging
      this.logSystemInfo(id, 'process_spawn_error');
    });

    process.on('exit', (code, signal) => {
      const exitReason = this.determineExitReason(code, signal);
      log('🚪 Stream %s process exited - code: %s, signal: %s, reason: %s', id, code, signal, exitReason);
      
      // Log detailed exit information
      log('Stream %s exit details - PID: %s, killed: %s, spawnTime: %s, duration: %dms', 
          id, process.pid, process.killed, stream.startTime.toISOString(), 
          Date.now() - stream.startTime.getTime());
      
      // Clean up monitoring interval
      if ((stream as any).monitorInterval) {
        clearInterval((stream as any).monitorInterval);
        log('Stream %s monitoring interval cleared', id);
      }
      
      if (stream.status !== 'stopping') {
        stream.status = 'error';
        stream.errorMessage = `Process exited unexpectedly: ${exitReason} (code: ${code}, signal: ${signal})`;
        log('❌ Stream %s marked as error due to unexpected exit - %s', id, exitReason);
        
        // Log final stream stats before failure
        log('Stream %s final stats before failure - FPS: %s, Size: %s, Time: %s, Speed: %s', 
            id, stream.stats.fps, stream.stats.size, stream.stats.time, stream.stats.speed);
        
        // Log system information for debugging
        this.logSystemInfo(id, 'unexpected_exit');
        
        // Trigger recovery for autostart streams
        this.handleStreamFailure(id, code, signal);
      } else {
        stream.status = 'idle';
        log('✅ Stream %s stopped gracefully', id);
        
        // Clean up autostart tracking for gracefully stopped streams
        this.autostartStreams.delete(id);
      }
      
      stream.endTime = new Date();
    });

    // Add process monitoring for unresponsive processes
    this.setupProcessHeartbeat(stream);

    // Parse FFmpeg stderr for progress information and errors
    process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.parseFFmpegProgress(stream, output);
      
      // Enhanced error detection and logging
      const trimmedOutput = output.trim();
      
      // Network-related errors
      if (output.includes('Connection refused') || output.includes('Network is unreachable')) {
        log('🌐 Stream %s NETWORK ERROR: %s', id, trimmedOutput);
        this.logNetworkError(stream, trimmedOutput);
      }
      else if (output.includes('Name or service not known') || output.includes('getaddrinfo failed')) {
        log('🔍 Stream %s DNS ERROR: %s', id, trimmedOutput);
        this.logNetworkError(stream, trimmedOutput);
      }
      else if (output.includes('Connection timed out') || output.includes('timeout')) {
        log('⏰ Stream %s TIMEOUT ERROR: %s', id, trimmedOutput);
        this.logNetworkError(stream, trimmedOutput);
      }
      
      // Codec/format errors
      else if (output.includes('Invalid data found') || output.includes('could not find codec')) {
        log('🎬 Stream %s CODEC/FORMAT ERROR: %s', id, trimmedOutput);
        this.logCodecError(stream, trimmedOutput);
      }
      else if (output.includes('Unsupported codec') || output.includes('codec not currently supported')) {
        log('❌ Stream %s UNSUPPORTED CODEC: %s', id, trimmedOutput);
        this.logCodecError(stream, trimmedOutput);
      }
      
      // File/permission errors
      else if (output.includes('Permission denied') || output.includes('No such file')) {
        log('🔒 Stream %s FILE/PERMISSION ERROR: %s', id, trimmedOutput);
        this.logFileError(stream, trimmedOutput);
      }
      else if (output.includes('No space left on device') || output.includes('disk full')) {
        log('💾 Stream %s DISK SPACE ERROR: %s', id, trimmedOutput);
        this.logSystemError(stream, trimmedOutput);
      }
      
      // RTSP specific errors
      else if (output.includes('RTSP') && (output.includes('failed') || output.includes('error'))) {
        log('📡 Stream %s RTSP ERROR: %s', id, trimmedOutput);
        this.logRtspError(stream, trimmedOutput);
      }
      else if (output.includes('401 Unauthorized') || output.includes('authentication failed')) {
        log('🔐 Stream %s AUTHENTICATION ERROR: %s', id, trimmedOutput);
        this.logAuthError(stream, trimmedOutput);
      }
      
      // Memory/resource errors
      else if (output.includes('Cannot allocate memory') || output.includes('out of memory')) {
        log('🧠 Stream %s MEMORY ERROR: %s', id, trimmedOutput);
        this.logSystemError(stream, trimmedOutput);
      }
      
      // Success indicators
      else if (output.includes('Input #0')) {
        log('✅ Stream %s Input source detected: %s', id, trimmedOutput);
      }
      else if (output.includes('Output #0')) {
        log('✅ Stream %s Output started: %s', id, trimmedOutput);
      }
      else if (output.includes('Stream mapping:')) {
        log('✅ Stream %s Stream mapping configured: %s', id, trimmedOutput);
      }
      else if (output.includes('Press [q] to stop') || output.includes('frame=')) {
        // These are normal progress indicators, log less frequently
        if (Math.random() < 0.01) { // Log 1% of these messages
          log('📊 Stream %s Progress: %s', id, trimmedOutput.substring(0, 100));
        }
      }
      
      // Other significant errors
      else if (output.includes('error') || output.includes('Error') || output.includes('failed') || output.includes('Failed')) {
        log('❌ Stream %s GENERAL ERROR: %s', id, trimmedOutput);
        this.logGeneralError(stream, trimmedOutput);
      }
      
      // Log any output that might indicate stream issues
      else if (output.includes('warning') || output.includes('Warning')) {
        if (Math.random() < 0.1) { // Log 10% of warnings
          log('⚠️ Stream %s WARNING: %s', id, trimmedOutput);
        }
      }
    });

    process.stdout?.on('data', (data) => {
      const output = data.toString().trim();
      if (output) {
        log('Stream %s stdout:', id, output);
      }
    });
  }

  private parseFFmpegProgress(stream: ActiveStream, output: string): void {
    // Parse FFmpeg progress from stderr
    // This is a simplified parser - you might want to use ffmpeg-progress-stream
    const lines = output.split('\n');
    
    for (const line of lines) {
      // Parse frame count - this is crucial for detecting stuck streams
      if (line.includes('frame=')) {
        const frameMatch = line.match(/frame=\s*(\d+)/);
        if (frameMatch && frameMatch[1]) {
          const currentFrame = parseInt(frameMatch[1]);
          const lastFrame = (stream as any).lastFrameCount || 0;
          
          // Store frame count and timestamp for monitoring
          (stream as any).lastFrameCount = currentFrame;
          (stream as any).lastFrameTime = Date.now();
          
          // Check if frame count is stuck (same frame for too long)
          if (currentFrame === lastFrame && lastFrame > 0) {
            const timeSinceLastFrame = Date.now() - ((stream as any).lastFrameTime || Date.now());
            if (timeSinceLastFrame > 30000) { // 30 seconds with same frame
              log('🚨 Stream %s FRAME STUCK - frame=%d for %dms', stream.id, currentFrame, timeSinceLastFrame);
              (stream as any).frameStuckCount = ((stream as any).frameStuckCount || 0) + 1;
              
              // Immediate restart for severely stuck frames (>2 minutes)
              if (timeSinceLastFrame > 120000) { // 2 minutes
                log('🚨 Stream %s SEVERELY STUCK FRAME - frame=%d for %dms - Triggering immediate restart!', stream.id, currentFrame, timeSinceLastFrame);
                this.handleImmediateRestart(stream.id, `Severely stuck frame: ${currentFrame} for ${Math.round(timeSinceLastFrame/1000)}s`);
              }
            }
          } else {
            // Frame count advanced, reset stuck counter
            (stream as any).frameStuckCount = 0;
          }
        }
      }
      
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
          
          // Check for abnormal speed values immediately
          const speedValue = this.parseSpeedValue(speedMatch[1]);
          if (speedValue > 10) { // Speed > 10x is definitely abnormal
            log('🚨 Stream %s ABNORMAL SPEED - speed=%s (parsed: %s)', stream.id, speedMatch[1], speedValue);
            (stream as any).abnormalSpeedCount = ((stream as any).abnormalSpeedCount || 0) + 1;
            
            // Immediate restart for extreme speed values (>50x)
            if (speedValue > 2) {
              log('🚨 Stream %s EXTREME SPEED - speed=%s (parsed: %s) - Triggering immediate restart!', stream.id, speedMatch[1], speedValue);
              
              // Trigger immediate restart for extreme speeds
              this.handleImmediateRestart(stream.id, `Extreme speed: ${speedValue}x`);
            }
          } else {
            (stream as any).abnormalSpeedCount = 0;
          }
        }
      }
    }
  }

  private parseSpeedValue(speedString: string): number {
    // Parse speed value from strings like "116x", "1.5x", "0x"
    if (!speedString || speedString === '0x' || speedString === '') {
      return 0;
    }
    
    // Remove the 'x' suffix and convert to number
    const numericPart = speedString.replace('x', '').trim();
    const value = parseFloat(numericPart);
    
    return isNaN(value) ? 0 : value;
  }

  private setupStreamMonitoring(stream: ActiveStream): void {
    let lastProgressTime = Date.now();
    let lastLogTime = Date.now();
    let lastRestartTime = 0; // Track last restart to prevent too frequent restarts
    
    const monitorInterval = setInterval(() => {
      if (stream.status !== 'running' || stream.process.killed) {
        clearInterval(monitorInterval);
        return;
      }
      
      const currentTime = Date.now();
      const timeSinceLastProgress = currentTime - lastProgressTime;
      const timeSinceLastLog = currentTime - lastLogTime;
      const timeSinceLastRestart = currentTime - lastRestartTime;
      
      // Check if we've had any progress updates
      if (stream.stats.fps > 0 || stream.stats.size !== '0B') {
        lastProgressTime = currentTime;
      }
      
      // Parse speed value (e.g., "116x" -> 116)
      const speedValue = this.parseSpeedValue(stream.stats.speed);
      
      // Enhanced failure detection
      const frameStuckCount = (stream as any).frameStuckCount || 0;
      const abnormalSpeedCount = (stream as any).abnormalSpeedCount || 0;
      const lastFrameCount = (stream as any).lastFrameCount || 0;
      const lastFrameTime = (stream as any).lastFrameTime || 0;
      
      // Check for various failure conditions
      const isLowFps = stream.stats.fps < 7;
      const isHighSpeed = speedValue > 2; // Lowered threshold from 2x to 5x for more sensitivity
      const isFrameStuck = frameStuckCount > 2; // Frame stuck for multiple checks
      const isAbnormalSpeed = abnormalSpeedCount > 3; // Abnormal speed for multiple checks
      const isNoProgress = timeSinceLastProgress > 60000; // No progress for 1 minute
      const isFrameNotAdvancing = lastFrameCount > 0 && (currentTime - lastFrameTime) > 60000; // Frame not advancing for 1 minute
      
      // Determine if stream has failed
      const isFailed = isLowFps || isHighSpeed || isFrameStuck || isAbnormalSpeed || isNoProgress || isFrameNotAdvancing;
      
      // Log detailed failure analysis
      if (isFailed && timeSinceLastRestart > 300000) { // 5 minute cooldown between restarts
        log('🚨 Stream %s FAILED - Analysis:', stream.id);
        log('  - FPS: %s (low: %s)', stream.stats.fps, isLowFps);
        log('  - Speed: %s (parsed: %s, high: %s)', stream.stats.speed, speedValue, isHighSpeed);
        log('  - Frame stuck count: %d (stuck: %s)', frameStuckCount, isFrameStuck);
        log('  - Abnormal speed count: %d (abnormal: %s)', abnormalSpeedCount, isAbnormalSpeed);
        log('  - No progress for: %dms (no progress: %s)', timeSinceLastProgress, isNoProgress);
        log('  - Frame not advancing: %s (stuck: %s)', isFrameNotAdvancing ? 'YES' : 'NO', isFrameNotAdvancing);
        log('  - Last frame: %d, time since: %dms', lastFrameCount, currentTime - lastFrameTime);
        
        lastRestartTime = currentTime;
        
        // Restart the stream in the background (don't await to avoid blocking monitoring)
        this.restartStream(stream.id).catch(error => {
          log('❌ Failed to restart stream %s:', stream.id, error);
        });
        
        return; // Exit this monitoring cycle as stream is being restarted
      }
      
      // Log warning conditions (not yet failed, but concerning)
      if (speedValue > 2 && speedValue <= 5) {
        log('⚠️ Stream %s HIGH SPEED WARNING - speed=%s (parsed: %s)', stream.id, stream.stats.speed, speedValue);
      }
      
      if (frameStuckCount > 0 && frameStuckCount <= 2) {
        log('⚠️ Stream %s FRAME STUCK WARNING - frame=%d, stuck count: %d', stream.id, lastFrameCount, frameStuckCount);
      }
      
      // Only log progress every 2 minutes when streaming is working fine
      if (timeSinceLastProgress > 30000) {
        log('Stream %s ⚠️  No progress for %dms. Status: %s, FPS: %s, Size: %s', 
            stream.id, timeSinceLastProgress, stream.status, stream.stats.fps, stream.stats.size);
        lastLogTime = currentTime;
        
        // If no progress for 2 minutes, log a warning
        if (timeSinceLastProgress > 120000) {
          log('Stream %s 🚨 WARNING - No FFmpeg progress for over 2 minutes, stream may be stalled', stream.id);
        }
      } else if (timeSinceLastLog > 120000 && stream.stats.fps > 0) {
        // Log progress every 2 minutes when everything is working
        log('Stream %s ✅ Streaming: %s FPS, %s, %s speed', 
            stream.id, stream.stats.fps, stream.stats.size, stream.stats.speed);
        lastLogTime = currentTime;
      }
    }, 30000); // Check every 30 seconds
    
    // Store the interval so we can clean it up
    (stream as any).monitorInterval = monitorInterval;
  }

  private async waitForStreamStart(stream: ActiveStream): Promise<void> {
    return new Promise((resolve, reject) => {
      const startTime = Date.now();
      log('Waiting for stream %s to start...', stream.id);
      
      const timeout = setTimeout(() => {
        if (stream.status === 'starting') {
          log('Stream %s start timeout after 10 seconds', stream.id);
          reject(new Error('Stream start timeout after 10 seconds'));
        }
      }, 10000); // 10 second timeout

      const checkStatus = () => {
        const elapsed = Date.now() - startTime;
        log('Stream %s status check - status: %s, elapsed: %dms', stream.id, stream.status, elapsed);
        
        if (stream.status === 'running') {
          log('Stream %s started successfully after %dms', stream.id, elapsed);
          clearTimeout(timeout);
          resolve();
        } else if (stream.status === 'error') {
          log('Stream %s failed to start after %dms - error: %s', stream.id, elapsed, stream.errorMessage);
          clearTimeout(timeout);
          reject(new Error(stream.errorMessage || 'Stream failed to start'));
        } else {
          setTimeout(checkStatus, 100);
        }
      };

      setTimeout(checkStatus, 100);
    });
  }

  // Test RTSP connectivity independently
  public async testRtspConnection(rtspUrl: string): Promise<{ success: boolean; output: string; error?: string }> {
    return new Promise((resolve) => {
      log('Testing RTSP connectivity to: %s', rtspUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'));
      
      const args = [
        '-loglevel', 'debug',
        '-rtsp_transport', 'tcp',
        '-stimeout', '10000000',  // 10 second timeout
        '-analyzeduration', '1000000',  // 1 second analysis
        '-probesize', '500000',   // Small probe
        '-i', rtspUrl,
        '-f', 'null',  // Null output - just test the input
        '-t', '5',     // Test for 5 seconds max
        '-'
      ];
      
      const process = spawn(ffmpegInstaller.path, args, { stdio: ['pipe', 'pipe', 'pipe'] });
      
      let stdout = '';
      let stderr = '';
      
      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });
      
      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });
      
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        resolve({
          success: false,
          output: stderr,
          error: 'RTSP test timeout after 15 seconds'
        });
      }, 15000);
      
      process.on('exit', (code, signal) => {
        clearTimeout(timeout);
        const success = code === 0 || stderr.includes('Input #0');
        
        log('RTSP test completed - code: %s, signal: %s, success: %s', code, signal, success);
        
        const result: { success: boolean; output: string; error?: string } = {
          success,
          output: stderr
        };
        
        if (!success) {
          result.error = `FFmpeg exit code: ${code}`;
        }
        
        resolve(result);
      });
      
      process.on('error', (error) => {
        clearTimeout(timeout);
        resolve({
          success: false,
          output: stderr,
          error: `Process error: ${error.message}`
        });
      });
    });
  }

  // Get FFmpeg information
  public getFFmpegInfo(): { path: string; version: string } {
    return {
      path: ffmpegInstaller.path,
      version: ffmpegInstaller.version
    };
  }

  // Network connectivity test
  public async testNetworkConnectivity(): Promise<{ success: boolean; details: any }> {
    const results: any = {};
    
    try {
      // Test DNS resolution for YouTube RTMP server
      log('Testing DNS resolution for YouTube RTMP servers...');
      
      const dns = require('dns').promises;
      
      // Test multiple YouTube RTMP endpoints
      const rtmpEndpoints = [
        'a.rtmp.youtube.com',
        'b.rtmp.youtube.com', 
        'c.rtmp.youtube.com',
        'd.rtmp.youtube.com'
      ];
      
      results.dns = {};
      let anyDnsSuccess = false;
      
      for (const endpoint of rtmpEndpoints) {
        try {
          const addresses = await dns.lookup(endpoint);
          results.dns[endpoint] = { success: true, address: addresses.address };
          anyDnsSuccess = true;
          log('DNS resolution successful for %s: %s', endpoint, addresses.address);
        } catch (error) {
          results.dns[endpoint] = { success: false, error: (error as Error).message };
          log('DNS resolution failed for %s: %s', endpoint, (error as Error).message);
        }
      }
      
      // Test HTTP connectivity to Google (general internet test)
      results.internet = await this.testHttpConnectivity('https://www.google.com');
      
      // Test general DNS with common providers
      results.generalDns = {};
      const dnsProviders = ['8.8.8.8', '1.1.1.1'];
      for (const provider of dnsProviders) {
        try {
          const testDns = require('dns');
          testDns.setServers([provider]);
          const addresses = await dns.lookup('google.com');
          results.generalDns[provider] = { success: true, address: addresses.address };
        } catch (error) {
          results.generalDns[provider] = { success: false, error: (error as Error).message };
        }
      }
      
      const overallSuccess = anyDnsSuccess && results.internet.success;
      
      log('Network connectivity test completed - success: %s', overallSuccess);
      return { success: overallSuccess, details: results };
      
    } catch (error) {
      log('Network connectivity test exception:', error);
      return { 
        success: false, 
        details: { error: (error as Error).message, results } 
      };
    }
  }
  
  private async testHttpConnectivity(url: string): Promise<{ success: boolean; error?: string; statusCode?: number }> {
    return new Promise((resolve) => {
      const protocol = url.startsWith('https') ? require('https') : require('http');
      const urlObj = new URL(url);
      
      const options = {
        hostname: urlObj.hostname,
        port: urlObj.port || (url.startsWith('https') ? 443 : 80),
        path: urlObj.pathname,
        method: 'HEAD',
        timeout: 5000
      };
      
      const req = protocol.request(options, (res: any) => {
        resolve({ success: res.statusCode < 400, statusCode: res.statusCode });
      });
      
      req.on('error', (error: Error) => {
        resolve({ success: false, error: error.message });
      });
      
      req.on('timeout', () => {
        req.destroy();
        resolve({ success: false, error: 'Request timeout' });
      });
      
      req.end();
    });
  }

  // Restart a stream by stopping and starting it again
  private async restartStream(streamId: string): Promise<void> {
    try {
      log('🔄 Restarting failed stream %s due to abnormal FPS/speed values', streamId);
      
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        log('Stream %s not found for restart', streamId);
        return;
      }
      
      const originalConfig = stream.config;
      const autostartInfo = this.autostartStreams.get(streamId);
      
      // Log restart reason and current stats
      log('🔄 Stream %s restart details - FPS: %s, Speed: %s, Size: %s, Duration: %dms', 
          streamId, stream.stats.fps, stream.stats.speed, stream.stats.size, 
          Date.now() - stream.startTime.getTime());
      
      // Stop the current stream completely
      await this.stopStream(streamId);
      
      // Wait a moment for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start a new stream with the same configuration
      log('🚀 Starting new stream instance after restart for failed stream');
      const newStream = await this.startStream(originalConfig, !!autostartInfo, autostartInfo?.cameraId);
      
      // Update autostart tracking if this was an autostart stream
      if (autostartInfo) {
        this.autostartStreams.delete(streamId);
        this.autostartStreams.set(newStream.id, {
          config: autostartInfo.config,
          cameraId: autostartInfo.cameraId,
          retryCount: autostartInfo.retryCount,
          lastRetry: new Date()
        });
        log('📝 Updated autostart tracking: %s → %s', streamId, newStream.id);
      }
      
      log('✅ Stream restart completed successfully: %s → %s', streamId, newStream.id);
    } catch (error) {
      log('❌ Error during stream restart:', error);
      
      // If restart fails, log system info for debugging
      this.logSystemInfo(streamId, 'restart_failure');
      
      throw error;
    }
  }

  // Handle immediate restart for extreme conditions
  private handleImmediateRestart(streamId: string, reason: string): void {
    const stream = this.activeStreams.get(streamId);
    if (!stream || stream.status !== 'running') {
      return;
    }
    
    // Check if we've restarted recently (prevent rapid restarts)
    const lastRestartTime = (stream as any).lastRestartTime || 0;
    const timeSinceLastRestart = Date.now() - lastRestartTime;
    
    if (timeSinceLastRestart < 60000) { // 1 minute cooldown
      log('⏰ Stream %s immediate restart skipped - too soon since last restart (%dms ago)', streamId, timeSinceLastRestart);
      return;
    }
    
    log('🚨 Stream %s IMMEDIATE RESTART - Reason: %s', streamId, reason);
    (stream as any).lastRestartTime = Date.now();
    
    // Restart the stream immediately
    this.restartStream(streamId).catch(error => {
      log('❌ Failed to immediately restart stream %s:', streamId, error);
    });
  }

  // Handle stream failure and trigger recovery for autostart streams
  private handleStreamFailure(streamId: string, code: number | null, signal: string | null): void {
    const autostartInfo = this.autostartStreams.get(streamId);
    if (autostartInfo) {
      log('🔄 Autostart stream %s failed (code: %s, signal: %s), scheduling recovery', streamId, code, signal);
      
      // Update retry count and last retry time
      autostartInfo.retryCount++;
      autostartInfo.lastRetry = new Date();
      
      // Schedule recovery with exponential backoff (max 5 retries)
      if (autostartInfo.retryCount <= 5) {
        const delay = Math.min(1000 * Math.pow(2, autostartInfo.retryCount - 1), 30000); // Max 30 seconds
        log('⏰ Scheduling recovery for stream %s in %dms (attempt %d/5)', streamId, delay, autostartInfo.retryCount);
        
        setTimeout(() => {
          this.recoverAutostartStream(streamId, autostartInfo);
        }, delay);
      } else {
        log('❌ Max retry attempts reached for autostart stream %s, giving up', streamId);
        this.autostartStreams.delete(streamId);
      }
    }
  }

  // Recover a failed autostart stream
  private async recoverAutostartStream(streamId: string, autostartInfo: { config: StreamConfig; cameraId: string; retryCount: number; lastRetry: Date }): Promise<void> {
    try {
      log('🚀 Attempting to recover autostart stream %s for camera %s (attempt %d)', streamId, autostartInfo.cameraId, autostartInfo.retryCount);
      
      // Remove the old stream from active streams if it still exists
      if (this.activeStreams.has(streamId)) {
        this.activeStreams.delete(streamId);
      }
      
      // Start a new stream with the same configuration
      const newStreamId = this.generateStreamId();
      const newStream = await this.startStream(autostartInfo.config, true, autostartInfo.cameraId);
      
      // Update the autostart tracking with the new stream ID
      this.autostartStreams.delete(streamId);
      this.autostartStreams.set(newStreamId, {
        config: autostartInfo.config,
        cameraId: autostartInfo.cameraId,
        retryCount: autostartInfo.retryCount,
        lastRetry: new Date()
      });
      
      log('✅ Successfully recovered autostart stream %s → %s', streamId, newStreamId);
    } catch (error) {
      log('❌ Failed to recover autostart stream %s:', streamId, error);
      
      // If recovery fails, schedule another attempt if we haven't exceeded max retries
      if (autostartInfo.retryCount < 5) {
        const delay = Math.min(1000 * Math.pow(2, autostartInfo.retryCount), 30000);
        log('⏰ Scheduling retry for failed recovery in %dms', delay);
        
        setTimeout(() => {
          this.recoverAutostartStream(streamId, autostartInfo);
        }, delay);
      } else {
        log('❌ Max recovery attempts reached for autostart stream %s, giving up', streamId);
        this.autostartStreams.delete(streamId);
      }
    }
  }

  // Start recovery monitoring for autostart streams
  private startRecoveryMonitoring(): void {
    // Check every 30 seconds for failed autostart streams that might need recovery
    this.recoveryInterval = setInterval(() => {
      this.checkFailedAutostartStreams();
    }, 30000);
    
    log('🔄 Started autostart stream recovery monitoring');
  }

  // Check for failed autostart streams that need recovery
  private checkFailedAutostartStreams(): void {
    const now = new Date();
    const maxRetryInterval = 5 * 60 * 1000; // 5 minutes
    
    for (const [streamId, autostartInfo] of this.autostartStreams.entries()) {
      const stream = this.activeStreams.get(streamId);
      
      // If stream is not active or has error status, and enough time has passed since last retry
      if ((!stream || stream.status === 'error') && 
          (now.getTime() - autostartInfo.lastRetry.getTime()) > maxRetryInterval) {
        
        log('🔍 Found failed autostart stream %s that needs recovery', streamId);
        this.handleStreamFailure(streamId, null, 'monitoring');
      }
    }
  }

  // Cleanup method to stop recovery monitoring
  public cleanup(): void {
    if (this.recoveryInterval) {
      clearInterval(this.recoveryInterval);
      this.recoveryInterval = null;
      log('🔄 Stopped autostart stream recovery monitoring');
    }
  }

  // Public method to restart a stream (for API use)
  public async restartStreamPublic(streamId: string): Promise<StreamStatus> {
    try {
      log('🔄 Manual restart requested for stream %s', streamId);
      
      const stream = this.activeStreams.get(streamId);
      if (!stream) {
        throw new StreamError(`Stream ${streamId} not found`, streamId);
      }
      
      const originalConfig = stream.config;
      const autostartInfo = this.autostartStreams.get(streamId);
      
      // Log restart details
      log('🔄 Manual restart details - FPS: %s, Speed: %s, Size: %s, Duration: %dms', 
          streamId, stream.stats.fps, stream.stats.speed, stream.stats.size, 
          Date.now() - stream.startTime.getTime());
      
      // Stop the current stream
      await this.stopStream(streamId);
      
      // Wait for cleanup
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      // Start new stream
      const newStream = await this.startStream(originalConfig, !!autostartInfo, autostartInfo?.cameraId);
      
      // Update autostart tracking if needed
      if (autostartInfo) {
        this.autostartStreams.set(newStream.id, {
          config: autostartInfo.config,
          cameraId: autostartInfo.cameraId,
          retryCount: 0, // Reset retry count for manual restart
          lastRetry: new Date()
        });
        log('📝 Updated autostart tracking for manual restart: %s → %s', streamId, newStream.id);
      }
      
      log('✅ Manual stream restart completed: %s → %s', streamId, newStream.id);
      return newStream;
    } catch (error) {
      log('❌ Error during manual stream restart:', error);
      this.logSystemInfo(streamId, 'manual_restart_failure');
      throw error;
    }
  }

  // Determine the reason for process exit
  private determineExitReason(code: number | null, signal: string | null): string {
    if (signal) {
      switch (signal) {
        case 'SIGTERM': return 'Terminated by system or user (SIGTERM)';
        case 'SIGKILL': return 'Force killed by system (SIGKILL)';
        case 'SIGINT': return 'Interrupted by user (SIGINT)';
        case 'SIGQUIT': return 'Quit signal received (SIGQUIT)';
        case 'SIGHUP': return 'Hangup signal received (SIGHUP)';
        case 'SIGPIPE': return 'Broken pipe - connection lost (SIGPIPE)';
        case 'SIGALRM': return 'Alarm signal - timeout (SIGALRM)';
        default: return `Unknown signal: ${signal}`;
      }
    }
    
    if (code !== null) {
      switch (code) {
        case 0: return 'Normal exit (success)';
        case 1: return 'General error - check FFmpeg logs';
        case 2: return 'FFmpeg misuse - invalid arguments';
        case 126: return 'Command invoked cannot execute';
        case 127: return 'Command not found';
        case 128: return 'Invalid exit argument';
        case 130: return 'Script terminated by Control-C';
        case 255: return 'Exit status out of range';
        default: 
          if (code > 128) {
            return `Signal-based exit (signal ${code - 128})`;
          }
          return `FFmpeg error code: ${code}`;
      }
    }
    
    return 'Unknown exit reason';
  }

  // Log system information for debugging
  private logSystemInfo(streamId: string, context: string): void {
    try {
      const os = require('os');
      const systemInfo = {
        context,
        streamId,
        timestamp: new Date().toISOString(),
        platform: os.platform(),
        arch: os.arch(),
        nodeVersion: process.version,
        memory: {
          total: os.totalmem(),
          free: os.freemem(),
          used: os.totalmem() - os.freemem()
        },
        loadAverage: os.loadavg(),
        uptime: os.uptime(),
        cpus: os.cpus().length,
        processMemory: process.memoryUsage()
      };
      
      log('System info for stream %s (%s): %j', streamId, context, systemInfo);
    } catch (error) {
      log('Failed to log system info for stream %s: %s', streamId, (error as Error).message);
    }
  }

  // Setup process heartbeat monitoring
  private setupProcessHeartbeat(stream: ActiveStream): void {
    const { process, id } = stream;
    let lastHeartbeat = Date.now();
    let heartbeatMissed = 0;
    const maxMissedHeartbeats = 3;
    const heartbeatInterval = 30000; // 30 seconds
    
    const heartbeatTimer = setInterval(() => {
      if (stream.status !== 'running' || process.killed) {
        clearInterval(heartbeatTimer);
        return;
      }
      
      const now = Date.now();
      const timeSinceLastHeartbeat = now - lastHeartbeat;
      
      // Check if process is still responsive
      if (process.pid && !process.killed) {
        try {
          // Try to send a signal 0 to check if process is alive
          process.kill(0);
          lastHeartbeat = now;
          heartbeatMissed = 0;
          
          // Log heartbeat every 5 minutes
          if (timeSinceLastHeartbeat > 300000) {
            log('💓 Stream %s heartbeat - PID: %s, alive: true, uptime: %dms', 
                id, process.pid, now - stream.startTime.getTime());
          }
        } catch (error) {
          heartbeatMissed++;
          log('💔 Stream %s heartbeat failed (attempt %d/%d) - PID: %s, error: %s', 
              id, heartbeatMissed, maxMissedHeartbeats, process.pid, (error as Error).message);
          
          if (heartbeatMissed >= maxMissedHeartbeats) {
            log('💀 Stream %s process appears to be dead after %d failed heartbeats', id, maxMissedHeartbeats);
            clearInterval(heartbeatTimer);
            
            // Mark stream as failed
            stream.status = 'error';
            stream.errorMessage = `Process became unresponsive after ${maxMissedHeartbeats} failed heartbeats`;
            stream.endTime = new Date();
            
            // Trigger recovery
            this.handleStreamFailure(id, null, 'heartbeat_failure');
          }
        }
      } else {
        log('💀 Stream %s process PID is null or killed, stopping heartbeat monitoring', id);
        clearInterval(heartbeatTimer);
      }
    }, heartbeatInterval);
    
    // Store the heartbeat timer for cleanup
    (stream as any).heartbeatTimer = heartbeatTimer;
  }

  // Specialized error logging methods
  private logNetworkError(stream: ActiveStream, error: string): void {
    log('🌐 Stream %s network error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
    
    // Run network diagnostics in background
    this.testNetworkConnectivity().then(result => {
      log('🌐 Stream %s network diagnostics after error: %j', stream.id, result);
    }).catch(diagError => {
      log('🌐 Stream %s network diagnostics failed: %s', stream.id, (diagError as Error).message);
    });
  }

  private logCodecError(stream: ActiveStream, error: string): void {
    log('🎬 Stream %s codec error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
    
    // Log current stream configuration
    log('🎬 Stream %s configuration: %j', stream.id, {
      quality: stream.config.quality,
      fps: stream.config.fps,
      resolution: stream.config.resolution,
      bitrate: stream.config.bitrate
    });
  }

  private logFileError(stream: ActiveStream, error: string): void {
    log('🔒 Stream %s file/permission error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
  }

  private logSystemError(stream: ActiveStream, error: string): void {
    log('💾 Stream %s system error details - error: %s', stream.id, error);
    this.logSystemInfo(stream.id, 'system_error');
  }

  private logRtspError(stream: ActiveStream, error: string): void {
    log('📡 Stream %s RTSP error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
    
    // Test RTSP connectivity in background
    this.testRtspConnection(stream.config.inputUrl).then(result => {
      log('📡 Stream %s RTSP test after error: success=%s, error=%s', 
          stream.id, result.success, result.error);
    }).catch(testError => {
      log('📡 Stream %s RTSP test failed: %s', stream.id, (testError as Error).message);
    });
  }

  private logAuthError(stream: ActiveStream, error: string): void {
    log('🔐 Stream %s authentication error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
  }

  private logGeneralError(stream: ActiveStream, error: string): void {
    log('❌ Stream %s general error details - inputUrl: %s, error: %s', 
        stream.id, stream.config.inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'), error);
    
    // Log current stream stats
    log('❌ Stream %s current stats: %j', stream.id, stream.stats);
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if FFmpeg is available using the npm-installed binary
      log('Health check using FFmpeg path: %s', ffmpegInstaller.path);
      
      const testProcess = spawn(ffmpegInstaller.path, ['-version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        let resolved = false;
        
        testProcess.on('exit', (code, signal) => {
          if (resolved) return;
          resolved = true;
          
          log('FFmpeg health check exit code: %d, signal: %s', code, signal);
          
          if (code === 0) {
            log('✅ FFmpeg health check passed');
            resolve(true);
          } else {
            log('❌ FFmpeg health check failed with code: %d', code);
            resolve(false);
          }
        });
        
        testProcess.on('error', (error) => {
          if (resolved) return;
          resolved = true;
          
          log('❌ FFmpeg health check error: %s', (error as Error).message);
          log('FFmpeg error details - name: %s, code: %s, errno: %s, syscall: %s', 
              (error as any).name, (error as any).code, (error as any).errno, (error as any).syscall);
          resolve(false);
        });
        
        // Increased timeout to 10 seconds for better reliability
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          
          log('⏰ FFmpeg health check timeout after 10 seconds');
          testProcess.kill('SIGTERM');
          
          // Force kill after another 2 seconds
          setTimeout(() => {
            if (!testProcess.killed) {
              testProcess.kill('SIGKILL');
            }
          }, 2000);
          
          resolve(false);
        }, 10000);
      });
    } catch (error) {
      log('❌ FFmpeg health check exception: %s', (error as Error).message);
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
