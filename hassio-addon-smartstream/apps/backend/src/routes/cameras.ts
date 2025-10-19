import { Router, Request, Response, NextFunction } from 'express';
import { z } from 'zod';
import debug from 'debug';
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

const log = debug('smart-stream:cameras');

// Validation schemas
const addCameraSchema = z.object({
  hostname: commonSchemas.hostname,
  port: commonSchemas.port,
  username: commonSchemas.username,
  password: commonSchemas.password,
  autostart: z.boolean().optional(),
  youtubeStreamKey: z.string().optional(),
  twitchStreamKey: z.string().optional(),
  defaultPlatform: z.enum(['youtube', 'twitch', 'custom']).optional()
});

const updateCameraSchema = z.object({
  port: commonSchemas.port.optional(),
  username: commonSchemas.username.optional(),
  password: commonSchemas.password.optional(),
  autostart: z.boolean().optional(),
  youtubeStreamKey: z.string().optional(),
  twitchStreamKey: z.string().optional(),
  defaultPlatform: z.enum(['youtube', 'twitch', 'custom']).optional()
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

        // If connection-related credentials are being updated, test the connection
        const connectionFieldsUpdated = updates.username || updates.password || updates.port;
        log('Update request for camera %s:', hostname, { updates, connectionFieldsUpdated });
        
        if (connectionFieldsUpdated) {
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
  const discoveryOptionsSchema = z.object({
    timeout: z.number().min(1000).max(30000).optional(),
    interface: z.string().optional()
  });

  router.post('/discover', 
    validateBody(discoveryOptionsSchema.optional()),
    async (req: Request, res: Response, next: NextFunction) => {
      try {
        const startTime = Date.now();
        
        // Get options from request body or use environment/config defaults
        const options = {
          timeout: req.body?.timeout || 5000,
          interface: req.body?.interface || process.env.DISCOVERY_INTERFACE || undefined
        };
        
        log('Starting ONVIF discovery with options: %j', options);
        const cameras = await onvif.discoverCameras(options);
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
    }
  );

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

  // GET /cameras/:hostname/profiles - Get camera media profiles
  router.get(
    '/:hostname/profiles',
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

        log('Getting profiles for camera: %s', hostname);

        // Get ONVIF camera instance
        const onvifCamera = await onvif.getCamera({
          hostname: camera.hostname,
          port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
          username: camera.username,
          password: camera.password
        });

        // Get camera profiles
        const profiles = await onvif.getCameraProfiles(onvifCamera);
        
        // Format profile information
        const formattedProfiles = profiles.map(profile => ({
          token: profile.token,
          name: profile.name,
          resolution: {
            width: profile.videoEncoderConfiguration?.resolution?.width || 0,
            height: profile.videoEncoderConfiguration?.resolution?.height || 0
          },
          encoding: profile.videoEncoderConfiguration?.encoding,
          framerate: profile.videoEncoderConfiguration?.rateControl?.frameRateLimit,
          bitrate: profile.videoEncoderConfiguration?.rateControl?.bitrateLimit
        }));

        const response: ApiResponse = {
          success: true,
          data: {
            hostname,
            profiles: formattedProfiles,
            count: formattedProfiles.length
          }
        };

        res.json(response);
      } catch (error) {
        log('Error getting profiles for camera %s:', req.params.hostname, error);
        res.status(500).json({
          success: false,
          error: 'PROFILES_FAILED',
          message: `Failed to get camera profiles: ${(error as Error).message}`
        });
      }
    }
  );

  // GET /cameras/:hostname/snapshot - Get camera snapshot
  router.get(
    '/:hostname/snapshot',
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

        log('Getting snapshot for camera: %s', hostname);

        // Get ONVIF camera instance
        const onvifCamera = await onvif.getCamera({
          hostname: camera.hostname,
          port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
          username: camera.username,
          password: camera.password
        });

        // Get profile token from query parameter (optional)
        const profileToken = req.query.profile as string | undefined;

        // Get snapshot URI
        const snapshotInfo = await onvif.getCameraSnapshot(onvifCamera, profileToken);
        log('Snapshot URI for %s: %s', hostname, snapshotInfo.uri.replace(/\/\/.*@/, '//[CREDENTIALS]@'));

        // Fetch the snapshot image and proxy it
        const axios = require('axios');
        const imageResponse = await axios.get(snapshotInfo.uri, {
          responseType: 'arraybuffer',
          timeout: 10000,
          headers: {
            'User-Agent': 'SmartStream/1.0'
          }
        });

        // Set appropriate headers
        res.set({
          'Content-Type': imageResponse.headers['content-type'] || 'image/jpeg',
          'Cache-Control': 'no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        });

        // Send the image
        res.send(imageResponse.data);
      } catch (error) {
        log('Error getting snapshot for camera %s:', req.params.hostname, error);
        // Send a placeholder or error image
        res.status(500).json({
          success: false,
          error: 'SNAPSHOT_FAILED',
          message: `Failed to get snapshot: ${(error as Error).message}`
        });
      }
    }
  );

  return router;
}
