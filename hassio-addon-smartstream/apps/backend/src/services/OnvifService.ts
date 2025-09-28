import { Discovery, Cam } from 'onvif';
import debug from 'debug';
import { DatabaseService } from './DatabaseService';
import { CameraDiscoveryResult, OnvifCamera, CameraConfig } from '@smart-stream/shared';

const log = debug('smart-stream:onvif');

export class OnvifService {
  private database: DatabaseService | null = null;
  private discoveryCache: CameraDiscoveryResult[] = [];
  private lastDiscovery: Date | null = null;

  public async initialize(database: DatabaseService): Promise<void> {
    try {
      log('Initializing ONVIF service...');
      this.database = database;
      
      // Perform initial discovery
      await this.discoverCameras();
      
      log('ONVIF service initialized successfully');
    } catch (error) {
      log('Error initializing ONVIF service:', error);
      throw error;
    }
  }

  public async discoverCameras(timeout: number = 5000): Promise<CameraDiscoveryResult[]> {
    return new Promise((resolve, reject) => {
      log('Starting camera discovery...');
      const startTime = Date.now();

      Discovery.probe({ timeout }, async (err: Error | null, cameras?: any[]) => {
        const duration = Date.now() - startTime;
        
        if (err) {
          log('Discovery error:', err);
          reject(err);
          return;
        }

        try {
          const discoveredCameras: CameraDiscoveryResult[] = (cameras || []).map((cam: any) => ({
            hostname: cam.hostname,
            port: cam.port,
            username: cam.username,
            password: cam.password
          }));

          log('Discovered %d cameras in %dms', discoveredCameras.length, duration);
          
          // Update cache
          this.discoveryCache = discoveredCameras;
          this.lastDiscovery = new Date();

          // Save discovered cameras to database if database is available
          if (this.database) {
            const cameraConfigs: CameraConfig[] = discoveredCameras.map(cam => ({
              hostname: cam.hostname,
              port: cam.port,
              username: cam.username || 'admin',
              password: cam.password || ''
            }));
            
            await this.database.setCameras(cameraConfigs);
            log('Saved discovered cameras to database');
          }

          resolve(discoveredCameras);
        } catch (error) {
          log('Error processing discovered cameras:', error);
          reject(error);
        }
      });
    });
  }

  public async getCamera(options: {
    hostname: string;
    port: number;
    username?: string;
    password?: string;
  }): Promise<OnvifCamera> {
    return new Promise((resolve, reject) => {
      const opts = {
        hostname: options.hostname,
        port: options.port,
        username: options.username || 'admin',
        password: options.password || ''
      };

      log('Connecting to camera: %s:%d', opts.hostname, opts.port);

      new Cam(opts, function(this: OnvifCamera, err?: Error) {
        if (err) {
          log('Error connecting to camera %s:%d - %s', opts.hostname, opts.port, err.message);
          reject(err);
          return;
        }

        log('Successfully connected to camera: %s:%d', opts.hostname, opts.port);
        resolve(this);
      });
    });
  }

  public async getCameraStreams(camera: OnvifCamera): Promise<Array<{ uri: string }>> {
    try {
      return await camera.getStreamUris();
    } catch (error) {
      log('Error getting stream URIs:', error);
      throw error;
    }
  }

  public async getCameraSnapshot(camera: OnvifCamera): Promise<{ uri: string }> {
    try {
      return await camera.getSnapshotUri();
    } catch (error) {
      log('Error getting snapshot URI:', error);
      throw error;
    }
  }

  public async testCameraConnection(config: {
    hostname: string;
    port: number;
    username: string;
    password: string;
  }): Promise<boolean> {
    try {
      const camera = await this.getCamera(config);
      
      // Try to get device information to verify connection
      await camera.getStreamUris();
      
      log('Camera connection test successful: %s:%d', config.hostname, config.port);
      return true;
    } catch (error) {
      log('Camera connection test failed: %s:%d - %s', 
        config.hostname, config.port, (error as Error).message);
      return false;
    }
  }

  public getDiscoveryCache(): {
    cameras: CameraDiscoveryResult[];
    lastDiscovery: Date | null;
    cacheAge: number | null;
  } {
    const cacheAge = this.lastDiscovery ? Date.now() - this.lastDiscovery.getTime() : null;
    
    return {
      cameras: this.discoveryCache,
      lastDiscovery: this.lastDiscovery,
      cacheAge
    };
  }

  public async refreshDiscovery(): Promise<CameraDiscoveryResult[]> {
    log('Refreshing camera discovery...');
    return await this.discoverCameras();
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      // Simple health check - try to create a discovery instance
      return true;
    } catch {
      return false;
    }
  }
}
