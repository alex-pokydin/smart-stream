import express from 'express';
import cors from 'cors';
import compression from 'compression';
import { createServer } from 'http';
import debug from 'debug';

import { errorHandler } from './middleware/errorHandler';
import { requestLogger } from './middleware/requestLogger';
import { ValidationError, CameraNotFoundError, StreamError } from '@smart-stream/shared';

// Import services
import { DatabaseService } from './services/DatabaseService';
import { OnvifService } from './services/OnvifService';
import { StreamService } from './services/StreamService';

// Import routes
import { createApiRouter } from './routes/api';
import { createCameraRouter } from './routes/cameras';
import { createStreamRouter } from './routes/streams';
import { createHealthRouter } from './routes/health';

const log = debug('smart-stream:app');

export class SmartStreamApp {
  public app: express.Application;
  public server: ReturnType<typeof createServer>;
  
  // Services
  public database: DatabaseService;
  public onvif: OnvifService;
  public streaming: StreamService;

  constructor() {
    this.app = express();
    this.server = createServer(this.app);
    
    // Initialize services
    this.database = new DatabaseService();
    this.onvif = new OnvifService();
    this.streaming = new StreamService();
  }

  public async initialize(): Promise<void> {
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

  private setupMiddleware(): void {
    // Request logging
    this.app.use(requestLogger);
    
    // CORS configuration
    this.app.use(cors({
      origin: true, // Allow same-origin requests for HA addon
      credentials: true,
      methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
    }));
    
    // Compression
    this.app.use(compression());
    
    // Body parsing
    this.app.use(express.json({ limit: '10mb' }));
    this.app.use(express.urlencoded({ extended: true, limit: '10mb' }));
    
    // Static files (for legacy compatibility)
    this.app.use('/static', express.static('public'));
  }

  private async initializeServices(): Promise<void> {
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
      
    } catch (error) {
      log('Error initializing services:', error);
      throw error;
    }
  }

  private setupRoutes(): void {
    // Health check endpoints (both for legacy and API)
    this.app.use('/health', createHealthRouter(this.database, this.onvif, this.streaming));
    this.app.use('/api/v1/health', createHealthRouter(this.database, this.onvif, this.streaming));
    
    // API routes
    this.app.use('/api/v1', createApiRouter());
    this.app.use('/api/v1/cameras', createCameraRouter(this.database, this.onvif));
    this.app.use('/api/v1/streams', createStreamRouter(this.streaming, this.database, this.onvif));
    
    // Legacy compatibility routes
    this.app.use('/api', createApiRouter()); // Legacy /api support
    
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

  private setupErrorHandling(): void {
    this.app.use(errorHandler);
  }

  private async startAutostartCameras(): Promise<void> {
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
          } else if (platform === 'twitch' && camera.twitchStreamKey) {
            streamKey = camera.twitchStreamKey;
          } else {
            // Default to YouTube if no platform specified but YouTube key exists
            if (camera.youtubeStreamKey) {
              platform = 'youtube';
              streamKey = camera.youtubeStreamKey;
            } else if (camera.twitchStreamKey) {
              platform = 'twitch';
              streamKey = camera.twitchStreamKey;
            } else {
              log('⚠️ Camera %s has autostart enabled but no valid stream key/platform configured', camera.hostname);
              continue;
            }
          }
          
          // Get real RTSP URL from ONVIF
          let inputUrl: string;
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
            } else {
              throw new Error('No stream URIs returned from camera');
            }
          } catch (onvifError) {
            log('⚠️ Failed to get RTSP URL via ONVIF for %s, using constructed URL: %s', 
                camera.hostname, (onvifError as Error).message);
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
          log('✅ Autostart stream started for camera %s: %s (ID: %s)', 
              camera.hostname, platform, streamStatus.id);
              
        } catch (error) {
          log('❌ Failed to start autostart stream for camera %s: %s', 
              camera.hostname, (error as Error).message);
        }
      }
      
      log('🎉 Autostart process completed');
      
    } catch (error) {
      log('❌ Error during autostart process:', error);
    }
  }

  public async start(port: number = 3000): Promise<void> {
    return new Promise((resolve, reject) => {
      this.server.listen(port, (err?: Error) => {
        if (err) {
          log('Failed to start server:', err);
          reject(err);
        } else {
          log(`Server started on port ${port}`);
          resolve();
        }
      });

      this.server.on('error', (error: NodeJS.ErrnoException) => {
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

  public async stop(): Promise<void> {
    return new Promise((resolve) => {
      this.server.close(() => {
        log('Server stopped');
        resolve();
      });
    });
  }
}

// Main execution
async function main(): Promise<void> {
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
    
  } catch (error) {
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
