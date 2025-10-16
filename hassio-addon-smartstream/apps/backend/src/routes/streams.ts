import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import debug from 'debug';
import { StreamService } from '../services/StreamService';
import { DatabaseService } from '../services/DatabaseService';
import { OnvifService } from '../services/OnvifService';

const log = debug('smart-stream:streams');
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
  platform: z.enum(['youtube', 'twitch', 'custom']).optional(),
  streamKey: z.string().optional(),
  config: z.object({
    inputUrl: z.string().url('Invalid input URL'),
    outputUrl: z.string().url('Invalid output URL').optional(),
    quality: z.enum(['low', 'medium', 'high', 'ultra']).optional(),
    fps: z.number().int().min(1).max(60).optional(),
    resolution: z.string().regex(/^\d+x\d+$/, 'Invalid resolution format').optional(),
    bitrate: z.string().optional(),
    platform: z.object({
      type: z.enum(['youtube', 'twitch', 'custom']),
      streamKey: z.string().optional(),
      serverUrl: z.string().url().optional()
    }).optional(),
    youtubeStreamKey: z.string().optional()
  }).optional()
});

const streamIdParamSchema = z.object({
  streamId: commonSchemas.streamId
});

export function createStreamRouter(streaming: StreamService, database: DatabaseService, onvif: OnvifService): Router {
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
        const { hostname, platform, streamKey, config } = req.body as StartStreamRequest;
        
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
              } else {
                throw new Error('No stream URIs returned from camera');
              }
            } catch (onvifError) {
              log('Failed to get RTSP URL via ONVIF for camera %s, falling back to constructed URL: %s', 
                  hostname, (onvifError as Error).message);
              
              // Fallback to constructed URL
              inputUrl = `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@${hostname}:${camera.port}/stream`;
              log('Using fallback constructed RTSP URL for camera %s', hostname);
            }
            
            log('Final input URL for camera %s - username: %s, hasPassword: %s, port: %s', 
                hostname, camera.username, !!camera.password, camera.port);
          } else {
            // Fallback to basic RTSP URL if camera not found in database
            inputUrl = `rtsp://${hostname}:554/stream`;
            log('Camera %s not found in database, using basic RTSP URL', hostname);
          }
        }

        const streamConfig: any = {
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
        } else if (config?.platform) {
          streamConfig.platform = config.platform;
        } else if (config?.youtubeStreamKey) {
          streamConfig.youtubeStreamKey = config.youtubeStreamKey;
        } else if (config?.outputUrl) {
          streamConfig.outputUrl = config.outputUrl;
        }

        const streamStatus = await streaming.startStream(streamConfig);
        
        const response: ApiResponse = {
          success: true,
          data: streamStatus,
          message: `Stream to ${platform || 'custom destination'} started successfully`
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
        
        log('Manual restart requested for stream %s', streamId);
        
        // Use the new restart method
        const newStream = await streaming.restartStreamPublic(streamId);
        
        const response: ApiResponse = {
          success: true,
          data: newStream,
          message: `Stream restarted successfully. New stream ID: ${newStream.id}`
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

  // GET /streams/:streamId/diagnostics - Get detailed stream diagnostics
  router.get(
    '/:streamId/diagnostics',
    validateParams(streamIdParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { streamId } = req.params;
        if (!streamId) {
          throw new StreamError('Stream ID parameter is required');
        }
        
        const streamStatus = streaming.getStreamStatus(streamId);
        const networkTest = await streaming.testNetworkConnectivity();
        
        const response: ApiResponse = {
          success: true,
          data: {
            streamId,
            status: streamStatus,
            networkConnectivity: networkTest,
            ffmpegInfo: streaming.getFFmpegInfo(),
            timestamp: new Date().toISOString()
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /streams/test-rtsp - Test RTSP connectivity
  router.post('/test-rtsp', async (req: Request, res: Response, next: NextFunction) => {
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
      let rtspUrl: string;
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
        } else {
          throw new Error('No stream URIs returned from camera');
        }
      } catch (onvifError) {
        log('Failed to get RTSP URL via ONVIF for testing, using constructed URL: %s', (onvifError as Error).message);
        rtspUrl = `rtsp://${encodeURIComponent(camera.username)}:${encodeURIComponent(camera.password)}@${hostname}:${camera.port}/stream`;
      }
      
      log('Testing RTSP connectivity for camera: %s', hostname);
      const testResult = await streaming.testRtspConnection(rtspUrl);
      
      const response: ApiResponse = {
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
    } catch (error) {
      next(error);
    }
  });

  // GET /streams/debug/processes - Debug endpoint to list all FFmpeg processes
  router.get('/debug/processes', async (req: Request, res: Response, next: NextFunction) => {
    try {
      log('Debug request: listing all FFmpeg processes');
      const debugInfo = await streaming.getProcessDebugInfo();
      
      const response: ApiResponse = {
        success: true,
        data: debugInfo,
        message: `Found ${debugInfo.allFFmpegProcesses.length} total FFmpeg processes, ${debugInfo.orphanedCount} orphaned`
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // POST /streams/debug/cleanup - Manually trigger cleanup of orphaned processes
  router.post('/debug/cleanup', async (req: Request, res: Response, next: NextFunction) => {
    try {
      log('Debug request: manual cleanup of orphaned FFmpeg processes');
      const cleanupResult = await streaming.cleanupOrphanedProcesses();
      
      const response: ApiResponse = {
        success: true,
        data: cleanupResult,
        message: `Cleaned up ${cleanupResult.killed} orphaned FFmpeg processes`
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  return router;
}
