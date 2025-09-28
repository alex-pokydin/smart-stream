import { Router, Request, Response } from 'express';
import { DatabaseService } from '../services/DatabaseService';
import { OnvifService } from '../services/OnvifService';
import { StreamService } from '../services/StreamService';
import { HealthCheckResponse } from '@smart-stream/shared';

export function createHealthRouter(
  database: DatabaseService,
  onvif: OnvifService,
  streaming: StreamService
): Router {
  const router = Router();

  router.get('/', async (req: Request, res: Response) => {
    try {
      // Check all services
      const [dbHealth, onvifHealth, streamHealth] = await Promise.all([
        database.healthCheck(),
        onvif.healthCheck(),
        streaming.healthCheck()
      ]);

      const allHealthy = dbHealth && onvifHealth && streamHealth;

      const response: HealthCheckResponse = {
        status: allHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: dbHealth,
          onvif: onvifHealth,
          streaming: streamHealth
        }
      };

      const statusCode = allHealthy ? 200 : 503;
      res.status(statusCode).json(response);
    } catch (error) {
      const response: HealthCheckResponse = {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        services: {
          database: false,
          onvif: false,
          streaming: false
        }
      };

      res.status(503).json(response);
    }
  });

  router.get('/database', async (req: Request, res: Response) => {
    try {
      const isHealthy = await database.healthCheck();
      res.status(isHealthy ? 200 : 503).json({
        service: 'database',
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        service: 'database',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  router.get('/onvif', async (req: Request, res: Response) => {
    try {
      const isHealthy = await onvif.healthCheck();
      res.status(isHealthy ? 200 : 503).json({
        service: 'onvif',
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        service: 'onvif',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  router.get('/streaming', async (req: Request, res: Response) => {
    try {
      const isHealthy = await streaming.healthCheck();
      res.status(isHealthy ? 200 : 503).json({
        service: 'streaming',
        status: isHealthy ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      res.status(503).json({
        service: 'streaming',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  router.get('/network', async (req: Request, res: Response) => {
    try {
      const networkTest = await streaming.testNetworkConnectivity();
      res.status(networkTest.success ? 200 : 503).json({
        service: 'network',
        status: networkTest.success ? 'healthy' : 'unhealthy',
        timestamp: new Date().toISOString(),
        details: networkTest.details
      });
    } catch (error) {
      res.status(503).json({
        service: 'network',
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        error: (error as Error).message
      });
    }
  });

  return router;
}
