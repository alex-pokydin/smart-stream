"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.SmartStreamApp = void 0;
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const compression_1 = __importDefault(require("compression"));
const http_1 = require("http");
const debug_1 = __importDefault(require("debug"));
const errorHandler_1 = require("./middleware/errorHandler");
const requestLogger_1 = require("./middleware/requestLogger");
// Import services
const DatabaseService_1 = require("./services/DatabaseService");
const OnvifService_1 = require("./services/OnvifService");
const StreamService_1 = require("./services/StreamService");
// Import routes
const api_1 = require("./routes/api");
const cameras_1 = require("./routes/cameras");
const streams_1 = require("./routes/streams");
const health_1 = require("./routes/health");
const log = (0, debug_1.default)('smart-stream:app');
class SmartStreamApp {
    app;
    server;
    // Services
    database;
    onvif;
    streaming;
    constructor() {
        this.app = (0, express_1.default)();
        this.server = (0, http_1.createServer)(this.app);
        // Initialize services
        this.database = new DatabaseService_1.DatabaseService();
        this.onvif = new OnvifService_1.OnvifService();
        this.streaming = new StreamService_1.StreamService();
    }
    async initialize() {
        log('Initializing Smart Stream application...');
        // Setup middleware
        this.setupMiddleware();
        // Initialize services
        await this.initializeServices();
        // Setup routes
        this.setupRoutes();
        // Setup error handling
        this.setupErrorHandling();
        // Start autostart cameras
        await this.startAutostartCameras();
        log('Application initialized successfully');
    }
    setupMiddleware() {
        // Request logging
        this.app.use(requestLogger_1.requestLogger);
        // CORS configuration
        this.app.use((0, cors_1.default)({
            origin: true, // Allow same-origin requests for HA addon
            credentials: true,
            methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
            allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
        }));
        // Compression
        this.app.use((0, compression_1.default)());
        // Body parsing
        this.app.use(express_1.default.json({ limit: '10mb' }));
        this.app.use(express_1.default.urlencoded({ extended: true, limit: '10mb' }));
        // Static files (for legacy compatibility)
        this.app.use('/static', express_1.default.static('public'));
    }
    async initializeServices() {
        log('Initializing services...');
        try {
            // Initialize database first
            await this.database.initialize();
            log('Database service initialized');
            // Initialize ONVIF service
            await this.onvif.initialize(this.database);
            log('ONVIF service initialized');
            // Initialize streaming service
            await this.streaming.initialize(this.database);
            log('Streaming service initialized');
        }
        catch (error) {
            log('Error initializing services:', error);
            throw error;
        }
    }
    setupRoutes() {
        // Health check endpoints (both for legacy and API)
        this.app.use('/health', (0, health_1.createHealthRouter)(this.database, this.onvif, this.streaming));
        this.app.use('/api/v1/health', (0, health_1.createHealthRouter)(this.database, this.onvif, this.streaming));
        // API routes
        this.app.use('/api/v1', (0, api_1.createApiRouter)());
        this.app.use('/api/v1/cameras', (0, cameras_1.createCameraRouter)(this.database, this.onvif));
        this.app.use('/api/v1/streams', (0, streams_1.createStreamRouter)(this.streaming, this.database, this.onvif));
        // Legacy compatibility routes
        this.app.use('/api', (0, api_1.createApiRouter)()); // Legacy /api support
        // Root endpoint
        this.app.get('/', (req, res) => {
            res.json({
                name: 'Smart Stream API',
                version: '1.0.0',
                status: 'running',
                timestamp: new Date().toISOString()
            });
        });
        // 404 handler
        this.app.use('*', (req, res) => {
            res.status(404).json({
                success: false,
                error: 'Endpoint not found',
                path: req.originalUrl
            });
        });
    }
    setupErrorHandling() {
        this.app.use(errorHandler_1.errorHandler);
    }
    async startAutostartCameras() {
        try {
            log('🔍 Checking for cameras with autostart enabled...');
            const cameras = await this.database.getCameras();
            const autostartCameras = Object.values(cameras).filter(camera => camera.autostart === true);
            if (autostartCameras.length === 0) {
                log('No cameras with autostart enabled found');
                return;
            }
            log('🚀 Found %d camera(s) with autostart enabled', autostartCameras.length);
            // Start streams for each autostart camera
            for (const camera of autostartCameras) {
                try {
                    log('🎬 Starting autostart stream for camera: %s', camera.hostname);
                    // Determine the platform to use
                    let platform = camera.defaultPlatform;
                    let streamKey = '';
                    if (platform === 'youtube' && camera.youtubeStreamKey) {
                        streamKey = camera.youtubeStreamKey;
                    }
                    else if (platform === 'twitch' && camera.twitchStreamKey) {
                        streamKey = camera.twitchStreamKey;
                    }
                    else {
                        // Default to YouTube if no platform specified but YouTube key exists
                        if (camera.youtubeStreamKey) {
                            platform = 'youtube';
                            streamKey = camera.youtubeStreamKey;
                        }
                        else if (camera.twitchStreamKey) {
                            platform = 'twitch';
                            streamKey = camera.twitchStreamKey;
                        }
                        else {
                            log('⚠️ Camera %s has autostart enabled but no valid stream key/platform configured', camera.hostname);
                            continue;
                        }
                    }
                    // Get real RTSP URL from ONVIF
                    let inputUrl;
                    try {
                        const onvifCamera = await this.onvif.getCamera({
                            hostname: camera.hostname,
                            port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
                            username: camera.username,
                            password: camera.password
                        });
                        const streamUris = await this.onvif.getCameraStreams(onvifCamera);
                        if (streamUris && streamUris.length > 0 && streamUris[0]?.uri) {
                            inputUrl = streamUris[0].uri;
                            log('✅ Got RTSP URL from ONVIF for %s', camera.hostname);
                        }
                        else {
                            throw new Error('No stream URIs returned from camera');
                        }
                    }
                    catch (onvifError) {
                        log('⚠️ Failed to get RTSP URL via ONVIF for %s, using constructed URL: %s', camera.hostname, onvifError.message);
                        inputUrl = `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@${camera.hostname}:${camera.port}/stream`;
                    }
                    // Start the stream
                    const streamConfig = {
                        inputUrl,
                        quality: 'medium',
                        fps: 30,
                        resolution: '1920x1080',
                        bitrate: '2M',
                        platform: {
                            type: platform,
                            streamKey: streamKey
                        }
                    };
                    const streamStatus = await this.streaming.startStream(streamConfig);
                    log('✅ Autostart stream started for camera %s: %s (ID: %s)', camera.hostname, platform, streamStatus.id);
                }
                catch (error) {
                    log('❌ Failed to start autostart stream for camera %s: %s', camera.hostname, error.message);
                }
            }
            log('🎉 Autostart process completed');
        }
        catch (error) {
            log('❌ Error during autostart process:', error);
        }
    }
    async start(port = 3000) {
        return new Promise((resolve, reject) => {
            this.server.listen(port, (err) => {
                if (err) {
                    log('Failed to start server:', err);
                    reject(err);
                }
                else {
                    log(`Server started on port ${port}`);
                    resolve();
                }
            });
            this.server.on('error', (error) => {
                if (error.syscall !== 'listen') {
                    throw error;
                }
                const bind = typeof port === 'string' ? `Pipe ${port}` : `Port ${port}`;
                switch (error.code) {
                    case 'EACCES':
                        console.error(`${bind} requires elevated privileges`);
                        process.exit(1);
                    case 'EADDRINUSE':
                        console.error(`${bind} is already in use`);
                        process.exit(1);
                    default:
                        throw error;
                }
            });
        });
    }
    async stop() {
        return new Promise((resolve) => {
            this.server.close(() => {
                log('Server stopped');
                resolve();
            });
        });
    }
}
exports.SmartStreamApp = SmartStreamApp;
// Main execution
async function main() {
    try {
        const app = new SmartStreamApp();
        await app.initialize();
        const port = parseInt(process.env.PORT || '3000', 10);
        await app.start(port);
        // Graceful shutdown
        process.on('SIGINT', async () => {
            log('Received SIGINT, shutting down gracefully...');
            await app.stop();
            process.exit(0);
        });
        process.on('SIGTERM', async () => {
            log('Received SIGTERM, shutting down gracefully...');
            await app.stop();
            process.exit(0);
        });
    }
    catch (error) {
        log('Failed to start application:', error);
        process.exit(1);
    }
}
// Start the application if this file is run directly
if (require.main === module) {
    main().catch((error) => {
        console.error('Unhandled error:', error);
        process.exit(1);
    });
}
//# sourceMappingURL=app.js.map