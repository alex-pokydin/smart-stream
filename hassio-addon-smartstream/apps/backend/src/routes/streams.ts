import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { StreamService } from '../services/StreamService';
import { validateBody, validateParams, commonSchemas } from '../middleware/validation';
import { 
  ApiResponse, 
  StartStreamRequest,
  StreamStatusResponse,
  StreamError
} from '@smart-stream/shared';

// Validation schemas
const startStreamSchema = z.object({
  hostname: commonSchemas.hostname,
  config: z.object({
    inputUrl: z.string().url('Invalid input URL'),
    outputUrl: z.string().url('Invalid output URL').optional(),
    quality: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
    fps: z.number().int().min(1).max(60).optional(),
    resolution: z.string().regex(/^\d+x\d+$/, 'Invalid resolution format').optional(),
    bitrate: z.string().optional()
  }).optional()
});

const streamIdParamSchema = z.object({
  streamId: commonSchemas.streamId
});

export function createStreamRouter(streaming: StreamService): Router {
  const router = Router();

  // GET /streams - List all active streams
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const streams = streaming.getAllStreams();
      
      const response: ApiResponse<StreamStatusResponse> = {
        success: true,
        data: { streams }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // POST /streams - Start a new stream
  router.post(
    '/',
    validateBody(startStreamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname, config } = req.body as StartStreamRequest;
        
        // Build the input URL from hostname if not provided in config
        let inputUrl = config?.inputUrl;
        if (!inputUrl) {
          // Default RTSP URL format
          inputUrl = `rtsp://${hostname}:554/stream`;
        }

        const streamConfig: any = {
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
        
        const response: ApiResponse = {
          success: true,
          data: streamStatus,
          message: 'Stream started successfully'
        };

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /streams/:streamId - Get stream status
  router.get(
    '/:streamId',
    validateParams(streamIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { streamId } = req.params;
        if (!streamId) {
          throw new StreamError('Stream ID parameter is required');
        }
        const streamStatus = streaming.getStreamStatus(streamId);
        
        const response: ApiResponse = {
          success: true,
          data: streamStatus
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /streams/:streamId - Stop stream
  router.delete(
    '/:streamId',
    validateParams(streamIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { streamId } = req.params;
        if (!streamId) {
          throw new StreamError('Stream ID parameter is required');
        }
        
        await streaming.stopStream(streamId);
        
        const response: ApiResponse = {
          success: true,
          message: 'Stream stopped successfully'
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /streams/:streamId/restart - Restart stream
  router.post(
    '/:streamId/restart',
    validateParams(streamIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { streamId } = req.params;
        if (!streamId) {
          throw new StreamError('Stream ID parameter is required');
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
        const response: ApiResponse = {
          success: true,
          message: 'Stream restart initiated - please start a new stream with the desired configuration'
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /streams/:streamId/stats - Get detailed stream statistics
  router.get(
    '/:streamId/stats',
    validateParams(streamIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { streamId } = req.params;
        if (!streamId) {
          throw new StreamError('Stream ID parameter is required');
        }
        const streamStatus = streaming.getStreamStatus(streamId);
        
        const response: ApiResponse = {
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
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
