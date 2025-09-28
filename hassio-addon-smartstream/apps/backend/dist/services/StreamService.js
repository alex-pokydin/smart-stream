"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamService = void 0;
const child_process_1 = require("child_process");
const debug_1 = __importDefault(require("debug"));
const shared_1 = require("@smart-stream/shared");
const log = (0, debug_1.default)('smart-stream:stream');
class StreamService {
    database = null;
    activeStreams = new Map();
    streamCounter = 0;
    async initialize(database) {
        try {
            log('Initializing Stream service...');
            this.database = database;
            log('Stream service initialized successfully');
        }
        catch (error) {
            log('Error initializing Stream service:', error);
            throw error;
        }
    }
    async startStream(config) {
        const streamId = this.generateStreamId();
        try {
            log('Starting stream %s with config:', streamId, config);
            const ffmpegOptions = this.buildFFmpegOptions(config);
            const process = this.spawnFFmpegProcess(ffmpegOptions);
            const stream = {
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
        }
        catch (error) {
            log('Error starting stream %s:', streamId, error);
            throw new shared_1.StreamError(`Failed to start stream: ${error.message}`, streamId, error);
        }
    }
    async stopStream(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) {
            throw new shared_1.StreamError(`Stream ${streamId} not found`, streamId);
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
        }
        catch (error) {
            log('Error stopping stream %s:', streamId, error);
            throw new shared_1.StreamError(`Failed to stop stream: ${error.message}`, streamId, error);
        }
    }
    getStreamStatus(streamId) {
        const stream = this.activeStreams.get(streamId);
        if (!stream) {
            throw new shared_1.StreamError(`Stream ${streamId} not found`, streamId);
        }
        const status = {
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
    getAllStreams() {
        const result = {};
        for (const [id, stream] of this.activeStreams) {
            const status = {
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
    generateStreamId() {
        this.streamCounter++;
        return `stream-${Date.now()}-${this.streamCounter}`;
    }
    buildFFmpegOptions(config) {
        const options = {
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
    spawnFFmpegProcess(options) {
        const args = this.buildFFmpegArgs(options);
        log('Spawning FFmpeg with args:', args);
        const process = (0, child_process_1.spawn)('ffmpeg', args, {
            stdio: ['pipe', 'pipe', 'pipe']
        });
        return process;
    }
    buildFFmpegArgs(options) {
        const args = [];
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
    setupProcessHandlers(stream) {
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
            }
            else {
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
    parseFFmpegProgress(stream, output) {
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
    async waitForStreamStart(stream) {
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
                }
                else if (stream.status === 'error') {
                    clearTimeout(timeout);
                    reject(new Error(stream.errorMessage || 'Stream failed to start'));
                }
                else {
                    setTimeout(checkStatus, 100);
                }
            };
            setTimeout(checkStatus, 100);
        });
    }
    // Health check
    async healthCheck() {
        try {
            // Check if FFmpeg is available
            const testProcess = (0, child_process_1.spawn)('ffmpeg', ['-version'], { stdio: 'pipe' });
            return new Promise((resolve) => {
                testProcess.on('exit', (code) => {
                    resolve(code === 0);
                });
                testProcess.on('error', () => {
                    resolve(false);
                });
                // Timeout after 5 seconds
                setTimeout(() => {
                    testProcess.kill();
                    resolve(false);
                }, 5000);
            });
        }
        catch {
            return false;
        }
    }
}
exports.StreamService = StreamService;
//# sourceMappingURL=StreamService.js.map