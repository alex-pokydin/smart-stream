"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamRouter = createStreamRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('smart-stream:streams');
const validation_1 = require("../middleware/validation");
const shared_1 = require("@smart-stream/shared");
// Validation schemas
const startStreamSchema = zod_1.z.object({
    hostname: validation_1.commonSchemas.hostname,
    platform: zod_1.z.enum(['youtube', 'twitch', 'custom']).optional(),
    streamKey: zod_1.z.string().optional(),
    config: zod_1.z.object({
        inputUrl: zod_1.z.string().url('Invalid input URL'),
        outputUrl: zod_1.z.string().url('Invalid output URL').optional(),
        quality: zod_1.z.enum(['low', 'medium', 'high', 'ultra']).optional(),
        fps: zod_1.z.number().int().min(1).max(60).optional(),
        resolution: zod_1.z.string().regex(/^\d+x\d+$/, 'Invalid resolution format').optional(),
        bitrate: zod_1.z.string().optional(),
        platform: zod_1.z.object({
            type: zod_1.z.enum(['youtube', 'twitch', 'custom']),
            streamKey: zod_1.z.string().optional(),
            serverUrl: zod_1.z.string().url().optional()
        }).optional(),
        youtubeStreamKey: zod_1.z.string().optional()
    }).optional()
});
const streamIdParamSchema = zod_1.z.object({
    streamId: validation_1.commonSchemas.streamId
});
function createStreamRouter(streaming, database, onvif) {
    const router = (0, express_1.Router)();
    // GET /streams - List all active streams
    router.get('/', async (req, res, next) => {
        try {
            const streams = streaming.getAllStreams();
            const response = {
                success: true,
                data: { streams }
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /streams - Start a new stream
    router.post('/', (0, validation_1.validateBody)(startStreamSchema), async (req, res, next) => {
        try {
            const { hostname, platform, streamKey, config } = req.body;
            // Build the input URL from hostname if not provided in config
            let inputUrl = config?.inputUrl;
            if (!inputUrl) {
                // Get camera credentials from database
                const camera = await database.getCamera(hostname);
                if (camera) {
                    log('Getting real RTSP URLs from camera %s via ONVIF', hostname);
                    try {
                        // Use ONVIF to get the actual stream URIs from the camera
                        const onvifCamera = await onvif.getCamera({
                            hostname: camera.hostname,
                            port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
                            username: camera.username,
                            password: camera.password
                        });
                        // Get stream URIs from the camera
                        const streamUris = await onvif.getCameraStreams(onvifCamera);
                        if (streamUris && streamUris.length > 0 && streamUris[0]?.uri) {
                            inputUrl = streamUris[0].uri;
                            log('Got real RTSP URL from ONVIF for camera %s: %s', hostname, inputUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'));
                        }
                        else {
                            throw new Error('No stream URIs returned from camera');
                        }
                    }
                    catch (onvifError) {
                        log('Failed to get RTSP URL via ONVIF for camera %s, falling back to constructed URL: %s', hostname, onvifError.message);
                        // Fallback to constructed URL
                        inputUrl = `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@${hostname}:${camera.port}/stream`;
                        log('Using fallback constructed RTSP URL for camera %s', hostname);
                    }
                    log('Final input URL for camera %s - username: %s, hasPassword: %s, port: %s', hostname, camera.username, !!camera.password, camera.port);
                }
                else {
                    // Fallback to basic RTSP URL if camera not found in database
                    inputUrl = `rtsp://${hostname}:554/stream`;
                    log('Camera %s not found in database, using basic RTSP URL', hostname);
                }
            }
            const streamConfig = {
                inputUrl,
                quality: config?.quality || 'medium',
                fps: config?.fps || 30,
                resolution: config?.resolution || '1920x1080',
                bitrate: config?.bitrate || '2M'
            };
            // Handle platform configuration
            if (platform && streamKey) {
                streamConfig.platform = {
                    type: platform,
                    streamKey: streamKey
                };
            }
            else if (config?.platform) {
                streamConfig.platform = config.platform;
            }
            else if (config?.youtubeStreamKey) {
                streamConfig.youtubeStreamKey = config.youtubeStreamKey;
            }
            else if (config?.outputUrl) {
                streamConfig.outputUrl = config.outputUrl;
            }
            const streamStatus = await streaming.startStream(streamConfig);
            const response = {
                success: true,
                data: streamStatus,
                message: `Stream to ${platform || 'custom destination'} started successfully`
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // GET /streams/:streamId - Get stream status
    router.get('/:streamId', (0, validation_1.validateParams)(streamIdParamSchema), async (req, res, next) => {
        try {
            const { streamId } = req.params;
            if (!streamId) {
                throw new shared_1.StreamError('Stream ID parameter is required');
            }
            const streamStatus = streaming.getStreamStatus(streamId);
            const response = {
                success: true,
                data: streamStatus
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // DELETE /streams/:streamId - Stop stream
    router.delete('/:streamId', (0, validation_1.validateParams)(streamIdParamSchema), async (req, res, next) => {
        try {
            const { streamId } = req.params;
            if (!streamId) {
                throw new shared_1.StreamError('Stream ID parameter is required');
            }
            await streaming.stopStream(streamId);
            const response = {
                success: true,
                message: 'Stream stopped successfully'
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /streams/:streamId/restart - Restart stream
    router.post('/:streamId/restart', (0, validation_1.validateParams)(streamIdParamSchema), async (req, res, next) => {
        try {
            const { streamId } = req.params;
            if (!streamId) {
                throw new shared_1.StreamError('Stream ID parameter is required');
            }
            // Get current stream status to extract config
            const currentStatus = streaming.getStreamStatus(streamId);
            // Stop the current stream
            await streaming.stopStream(streamId);
            // Wait a moment for cleanup
            await new Promise(resolve => setTimeout(resolve, 1000));
            // Start a new stream with the same configuration
            // Note: This is a simplified restart - in production you might want to store
            // the original configuration and reuse it
            const response = {
                success: true,
                message: 'Stream restart initiated - please start a new stream with the desired configuration'
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // GET /streams/:streamId/stats - Get detailed stream statistics
    router.get('/:streamId/stats', (0, validation_1.validateParams)(streamIdParamSchema), async (req, res, next) => {
        try {
            const { streamId } = req.params;
            if (!streamId) {
                throw new shared_1.StreamError('Stream ID parameter is required');
            }
            const streamStatus = streaming.getStreamStatus(streamId);
            const response = {
                success: true,
                data: {
                    streamId,
                    stats: streamStatus.stats,
                    status: streamStatus.status,
                    startTime: streamStatus.startTime,
                    duration: streamStatus.startTime
                        ? Date.now() - streamStatus.startTime.getTime()
                        : 0
                }
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /streams/test-rtsp - Test RTSP connectivity
    router.post('/test-rtsp', async (req, res, next) => {
        try {
            const { hostname } = req.body;
            if (!hostname) {
                res.status(400).json({
                    success: false,
                    error: 'HOSTNAME_REQUIRED',
                    message: 'Hostname is required for RTSP testing'
                });
                return;
            }
            // Get camera credentials to build RTSP URL
            const camera = await database.getCamera(hostname);
            if (!camera) {
                res.status(404).json({
                    success: false,
                    error: 'CAMERA_NOT_FOUND',
                    message: `Camera ${hostname} not found in database`
                });
                return;
            }
            // Get real RTSP URL from ONVIF first, fallback to constructed URL
            let rtspUrl;
            try {
                log('Getting real RTSP URLs from camera %s via ONVIF for testing', hostname);
                const onvifCamera = await onvif.getCamera({
                    hostname: camera.hostname,
                    port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
                    username: camera.username,
                    password: camera.password
                });
                const streamUris = await onvif.getCameraStreams(onvifCamera);
                if (streamUris && streamUris.length > 0 && streamUris[0]?.uri) {
                    rtspUrl = streamUris[0].uri;
                    log('Got real RTSP URL from ONVIF for testing: %s', rtspUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'));
                }
                else {
                    throw new Error('No stream URIs returned from camera');
                }
            }
            catch (onvifError) {
                log('Failed to get RTSP URL via ONVIF for testing, using constructed URL: %s', onvifError.message);
                rtspUrl = `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@${hostname}:${camera.port}/stream`;
            }
            log('Testing RTSP connectivity for camera: %s', hostname);
            const testResult = await streaming.testRtspConnection(rtspUrl);
            const response = {
                success: testResult.success,
                data: {
                    hostname,
                    rtspUrl: rtspUrl.replace(/\/\/.*@/, '//[CREDENTIALS]@'),
                    testResult: {
                        success: testResult.success,
                        error: testResult.error,
                        outputLength: testResult.output.length
                    }
                },
                message: testResult.success ? 'RTSP connection successful' : `RTSP connection failed: ${testResult.error}`
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
//# sourceMappingURL=streams.js.map