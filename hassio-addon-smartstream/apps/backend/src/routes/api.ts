import { Router, Request, Response } from 'express';
import { ApiResponse } from '@smart-stream/shared';

export function createApiRouter(): Router {
  const router = Router();

  // API version info
  router.get('/', (req: Request, res: Response) => {
    const response: ApiResponse = {
      success: true,
      data: {
        name: 'Smart Stream API',
        version: '1.0.0',
        endpoints: {
          cameras: '/api/v1/cameras',
          streams: '/api/v1/streams',
          health: '/health'
        },
        timestamp: new Date().toISOString()
      }
    };

    res.json(response);
  });

  // API documentation endpoint
  router.get('/docs', (req: Request, res: Response) => {
    const documentation = {
      name: 'Smart Stream API Documentation',
      version: '1.0.0',
      baseUrl: '/api/v1',
      endpoints: [
        {
          path: '/cameras',
          methods: ['GET', 'POST'],
          description: 'Camera management'
        },
        {
          path: '/cameras/:hostname',
          methods: ['GET', 'PUT', 'DELETE'],
          description: 'Individual camera operations'
        },
        {
          path: '/cameras/discover',
          methods: ['POST'],
          description: 'Discover ONVIF cameras on network'
        },
        {
          path: '/streams',
          methods: ['GET', 'POST'],
          description: 'Stream management'
        },
        {
          path: '/streams/:streamId',
          methods: ['GET', 'DELETE'],
          description: 'Individual stream operations'
        },
        {
          path: '/health',
          methods: ['GET'],
          description: 'Service health checks'
        }
      ],
      examples: {
        addCamera: {
          method: 'POST',
          path: '/api/v1/cameras',
          body: {
            hostname: '192.168.1.100',
            port: 554,
            username: 'admin',
            password: 'password',
            autostart: true
          }
        },
        startStream: {
          method: 'POST',
          path: '/api/v1/streams',
          body: {
            hostname: '192.168.1.100',
            config: {
              inputUrl: 'rtsp://192.168.1.100:554/stream',
              outputUrl: 'rtmp://youtube.com/live/stream-key',
              quality: 'high',
              fps: 30,
              resolution: '1920x1080'
            }
          }
        }
      }
    };

    res.json(documentation);
  });

  return router;
}
