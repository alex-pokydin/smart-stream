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
      
      log('Stream service initialized successfully');
    } catch (error) {
      log('Error initializing Stream service:', error);
      throw error;
    }
  }

  public async startStream(config: StreamConfig): Promise<StreamStatus> {
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
      log('Stream %s process spawned successfully', id);
      stream.status = 'running';
    });

    process.on('error', (error) => {
      log('Stream %s process spawn error:', id, error);
      stream.status = 'error';
      stream.errorMessage = `Process spawn error: ${error.message}`;
      stream.endTime = new Date();
    });

    process.on('exit', (code, signal) => {
      log('Stream %s process exited - code: %s, signal: %s', id, code, signal);
      
      // Clean up monitoring interval
      if ((stream as any).monitorInterval) {
        clearInterval((stream as any).monitorInterval);
      }
      
      if (stream.status !== 'stopping') {
        stream.status = 'error';
        stream.errorMessage = `Process exited unexpectedly (code: ${code}, signal: ${signal})`;
        log('Stream %s marked as error due to unexpected exit', id);
      } else {
        stream.status = 'idle';
        log('Stream %s stopped gracefully', id);
      }
      
      stream.endTime = new Date();
    });

    // Parse FFmpeg stderr for progress information and errors
    process.stderr?.on('data', (data) => {
      const output = data.toString();
      this.parseFFmpegProgress(stream, output);
      
      // Only log important events and errors (filter out routine debug output)
      if (output.includes('Connection refused') || output.includes('Network is unreachable')) {
        log('Stream %s NETWORK ERROR: %s', id, output.trim());
      }
      else if (output.includes('Invalid data found') || output.includes('could not find codec')) {
        log('Stream %s CODEC/FORMAT ERROR: %s', id, output.trim());
      }
      else if (output.includes('Permission denied') || output.includes('No such file')) {
        log('Stream %s FILE/PERMISSION ERROR: %s', id, output.trim());
      }
      else if (output.includes('timeout') || output.includes('timed out')) {
        log('Stream %s TIMEOUT ERROR: %s', id, output.trim());
      }
      else if (output.includes('RTSP') && output.includes('failed')) {
        log('Stream %s RTSP ERROR: %s', id, output.trim());
      }
      else if (output.includes('Input #0')) {
        log('Stream %s ✅ Input source detected', id);
      }
      else if (output.includes('Output #0')) {
        log('Stream %s ✅ Output started', id);
      }
      else if (output.includes('Stream mapping:')) {
        log('Stream %s ✅ Stream mapping configured', id);
      }
      // Log other significant errors
      else if (output.includes('error') || output.includes('Error') || output.includes('failed') || output.includes('Failed')) {
        log('Stream %s ERROR: %s', id, output.trim());
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

  private setupStreamMonitoring(stream: ActiveStream): void {
    let lastProgressTime = Date.now();
    let lastLogTime = Date.now();
    
    const monitorInterval = setInterval(() => {
      if (stream.status !== 'running' || stream.process.killed) {
        clearInterval(monitorInterval);
        return;
      }
      
      const currentTime = Date.now();
      const timeSinceLastProgress = currentTime - lastProgressTime;
      const timeSinceLastLog = currentTime - lastLogTime;
      
      // Check if we've had any progress updates
      if (stream.stats.fps > 0 || stream.stats.size !== '0B') {
        lastProgressTime = currentTime;
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

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // Check if FFmpeg is available using the npm-installed binary
      log('Health check using FFmpeg path: %s', ffmpegInstaller.path);
      
      const testProcess = spawn(ffmpegInstaller.path, ['-version'], { stdio: 'pipe' });
      
      return new Promise((resolve) => {
        testProcess.on('exit', (code) => {
          log('FFmpeg health check exit code: %d', code);
          resolve(code === 0);
        });
        
        testProcess.on('error', (error) => {
          log('FFmpeg health check error:', error);
          resolve(false);
        });
        
        // Timeout after 5 seconds
        setTimeout(() => {
          testProcess.kill();
          log('FFmpeg health check timeout');
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      log('FFmpeg health check exception:', error);
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
