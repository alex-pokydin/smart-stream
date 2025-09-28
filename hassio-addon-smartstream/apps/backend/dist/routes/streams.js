"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createStreamRouter = createStreamRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../middleware/validation");
const shared_1 = require("@smart-stream/shared");
// Validation schemas
const startStreamSchema = zod_1.z.object({
    hostname: validation_1.commonSchemas.hostname,
    config: zod_1.z.object({
        inputUrl: zod_1.z.string().url('Invalid input URL'),
        outputUrl: zod_1.z.string().url('Invalid output URL').optional(),
        quality: zod_1.z.enum(['low', 'medium', 'high', 'ultra']).optional(),
        fps: zod_1.z.number().int().min(1).max(60).optional(),
        resolution: zod_1.z.string().regex(/^\d+x\d+$/, 'Invalid resolution format').optional(),
        bitrate: zod_1.z.string().optional()
    }).optional()
});
const streamIdParamSchema = zod_1.z.object({
    streamId: validation_1.commonSchemas.streamId
});
function createStreamRouter(streaming) {
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
            const { hostname, config } = req.body;
            // Build the input URL from hostname if not provided in config
            let inputUrl = config?.inputUrl;
            if (!inputUrl) {
                // Default RTSP URL format
                inputUrl = `rtsp://${hostname}:554/stream`;
            }
            const streamConfig = {
                inputUrl,
                quality: config?.quality || 'medium',
                fps: config?.fps || 30,
                resolution: config?.resolution || '1920x1080',
                bitrate: config?.bitrate || '2M'
            };
            // Only add outputUrl if it's provided
            if (config?.outputUrl) {
                streamConfig.outputUrl = config.outputUrl;
            }
            const streamStatus = await streaming.startStream(streamConfig);
            const response = {
                success: true,
                data: streamStatus,
                message: 'Stream started successfully'
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
    return router;
}
//# sourceMappingURL=streams.js.map