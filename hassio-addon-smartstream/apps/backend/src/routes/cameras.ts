import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import { DatabaseService } from '../services/DatabaseService';
import { OnvifService } from '../services/OnvifService';
import { validateBody, validateParams, commonSchemas } from '../middleware/validation';
import { 
  ApiResponse, 
  AddCameraRequest, 
  UpdateCameraRequest,
  CameraListResponse,
  DiscoveryResponse,
  CameraNotFoundError,
  ValidationError
} from '@smart-stream/shared';

// Validation schemas
const addCameraSchema = z.object({
  hostname: commonSchemas.hostname,
  port: commonSchemas.port,
  username: commonSchemas.username,
  password: commonSchemas.password,
  autostart: z.boolean().optional()
});

const updateCameraSchema = z.object({
  port: commonSchemas.port.optional(),
  username: commonSchemas.username.optional(),
  password: commonSchemas.password.optional(),
  autostart: z.boolean().optional()
});

const hostnameParamSchema = z.object({
  hostname: commonSchemas.hostname
});

export function createCameraRouter(
  database: DatabaseService,
  onvif: OnvifService
): Router {
  const router = Router();

  // GET /cameras - List all cameras
  router.get('/', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const cameras = await database.getCameras();
      
      const response: ApiResponse<CameraListResponse> = {
        success: true,
        data: { cameras }
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // POST /cameras - Add a new camera
  router.post(
    '/',
    validateBody(addCameraSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const cameraData = req.body as AddCameraRequest;
        
        // Test camera connection before adding
        const connectionSuccess = await onvif.testCameraConnection(cameraData);
        if (!connectionSuccess) {
          res.status(400).json({
            success: false,
            error: 'CAMERA_CONNECTION_FAILED',
            message: 'Could not connect to camera with provided credentials'
          });
          return;
        }

        const camera = await database.addCamera(cameraData);
        
        const response: ApiResponse = {
          success: true,
          data: camera,
          message: 'Camera added successfully'
        };

        res.status(201).json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // GET /cameras/:hostname - Get specific camera
  router.get(
    '/:hostname',
    validateParams(hostnameParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname } = req.params;
        if (!hostname) {
          throw new ValidationError('Hostname parameter is required', 'hostname', hostname);
        }
        const camera = await database.getCamera(hostname);
        
        if (!camera) {
          throw new CameraNotFoundError(hostname);
        }

        const response: ApiResponse = {
          success: true,
          data: camera
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // PUT /cameras/:hostname - Update camera
  router.put(
    '/:hostname',
    validateParams(hostnameParamSchema),
    validateBody(updateCameraSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname } = req.params;
        if (!hostname) {
          throw new ValidationError('Hostname parameter is required', 'hostname', hostname);
        }
        const updates = req.body as UpdateCameraRequest;

        // If credentials are being updated, test the connection
        if (updates.username || updates.password || updates.port) {
          const existingCamera = await database.getCamera(hostname);
          if (!existingCamera) {
            throw new CameraNotFoundError(hostname);
          }

          const testConfig = {
            hostname: hostname,
            port: updates.port || existingCamera.port,
            username: updates.username || existingCamera.username,
            password: updates.password || existingCamera.password
          };

          const connectionSuccess = await onvif.testCameraConnection({
            hostname: testConfig.hostname,
            port: typeof testConfig.port === 'string' ? parseInt(testConfig.port) : testConfig.port,
            username: testConfig.username,
            password: testConfig.password
          });

          if (!connectionSuccess) {
            res.status(400).json({
              success: false,
              error: 'CAMERA_CONNECTION_FAILED',
              message: 'Could not connect to camera with updated credentials'
            });
            return;
          }
        }

        const updatedCamera = await database.updateCamera(hostname, updates);
        
        const response: ApiResponse = {
          success: true,
          data: updatedCamera,
          message: 'Camera updated successfully'
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // DELETE /cameras/:hostname - Delete camera
  router.delete(
    '/:hostname',
    validateParams(hostnameParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname } = req.params;
        if (!hostname) {
          throw new ValidationError('Hostname parameter is required', 'hostname', hostname);
        }
        
        await database.deleteCamera(hostname);
        
        const response: ApiResponse = {
          success: true,
          message: 'Camera deleted successfully'
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /cameras/discover - Discover ONVIF cameras
  router.post('/discover', async (req: Request, res: Response, next: NextFunction) => {
    try {
      const startTime = Date.now();
      const cameras = await onvif.discoverCameras();
      const duration = Date.now() - startTime;
      
      const response: ApiResponse<DiscoveryResponse> = {
        success: true,
        data: { cameras, duration },
        message: `Discovered ${cameras.length} cameras in ${duration}ms`
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  });

  // GET /cameras/:hostname/test - Test camera connection
  router.get(
    '/:hostname/test',
    validateParams(hostnameParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname } = req.params;
        if (!hostname) {
          throw new ValidationError('Hostname parameter is required', 'hostname', hostname);
        }
        const camera = await database.getCamera(hostname);
        
        if (!camera) {
          throw new CameraNotFoundError(hostname);
        }

        const isConnected = await onvif.testCameraConnection({
          hostname: camera.hostname,
          port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
          username: camera.username,
          password: camera.password
        });

        const response: ApiResponse = {
          success: true,
          data: {
            hostname,
            connected: isConnected,
            timestamp: new Date().toISOString()
          }
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  // POST /cameras/:hostname/toggle - Toggle autostart
  router.post(
    '/:hostname/toggle',
    validateParams(hostnameParamSchema),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const { hostname } = req.params;
        if (!hostname) {
          throw new ValidationError('Hostname parameter is required', 'hostname', hostname);
        }
        const cameraOps = database.getCameraOperations(hostname);
        
        // Check if camera exists first
        const camera = await database.getCamera(hostname);
        if (!camera) {
          throw new CameraNotFoundError(hostname);
        }

        await cameraOps.toggle();
        const updatedCamera = await database.getCamera(hostname);
        
        const response: ApiResponse = {
          success: true,
          data: updatedCamera,
          message: `Camera autostart ${updatedCamera?.autostart ? 'enabled' : 'disabled'}`
        };

        res.json(response);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
