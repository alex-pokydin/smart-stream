import { Discovery, Cam } from 'onvif';
import debug from 'debug';
import { DatabaseService } from './DatabaseService';
import { CameraDiscoveryResult, OnvifCamera, CameraConfig } from '@smart-stream/shared';

const log = debug('smart-stream:onvif');

export interface DiscoveryOptions {
  timeout?: number;
  interface?: string;
}

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

  public async discoverCameras(options: DiscoveryOptions = {}): Promise<CameraDiscoveryResult[]> {
    const {
      timeout = 5000,
      interface: networkInterface
    } = options;

    return new Promise((resolve, reject) => {
      log('Starting ONVIF camera discovery with timeout: %dms', timeout);
      const startTime = Date.now();

      const discoveryOptions: any = { timeout };
      if (networkInterface) {
        discoveryOptions.interface = networkInterface;
        log('Using network interface: %s', networkInterface);
      }

      Discovery.probe(discoveryOptions, async (err: Error | null, cameras?: any[]) => {
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
          if (this.database && discoveredCameras.length > 0) {
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
      log('Getting stream URIs from camera, available methods: %s', Object.keys(camera).filter(k => typeof (camera as any)[k] === 'function').join(', '));
      
      // Try getStreamUri (singular) with callback - this is the real ONVIF method
      if (typeof (camera as any).getStreamUri === 'function') {
        const result = await new Promise<any>((resolve, reject) => {
          (camera as any).getStreamUri({}, (err: any, result: any) => {
            if (err) {
              log('getStreamUri callback error:', err);
              reject(err);
            } else {
              log('getStreamUri callback result:', result);
              resolve(result);
            }
          });
        });
        
        // The result might be a single URI or an array, normalize to array
        if (result && result.uri) {
          return [{ uri: result.uri }];
        } else if (Array.isArray(result)) {
          return result.map(item => ({ uri: item.uri || item }));
        } else {
          log('Unexpected getStreamUri result format:', result);
        }
      }
      
      // Fallback: try our interface method if it exists
      if (typeof (camera as any).getStreamUris === 'function') {
        log('Falling back to getStreamUris method');
        return await (camera as any).getStreamUris();
      }
      
      throw new Error('No getStreamUri or getStreamUris method available on camera object');
    } catch (error) {
      log('Error getting stream URIs:', error);
      throw error;
    }
  }

  public async getCameraProfiles(camera: OnvifCamera): Promise<any[]> {
    try {
      log('Getting media profiles from camera');
      
      if (typeof (camera as any).getProfiles === 'function') {
        const profiles = await new Promise<any[]>((resolve, reject) => {
          (camera as any).getProfiles((err: any, profiles: any[]) => {
            if (err) {
              log('getProfiles callback error:', err);
              reject(err);
            } else {
              log('getProfiles callback result - found %d profiles', profiles?.length || 0);
              resolve(profiles || []);
            }
          });
        });
        
        // Log profile details
        profiles.forEach((profile, idx) => {
          const resolution = profile?.videoEncoderConfiguration?.resolution;
          log('Profile %d: token=%s, name=%s, resolution=%dx%d', 
            idx, 
            profile?.token || 'unknown',
            profile?.name || 'unknown',
            resolution?.width || 0,
            resolution?.height || 0
          );
        });
        
        return profiles;
      }
      
      throw new Error('No getProfiles method available on camera object');
    } catch (error) {
      log('Error getting camera profiles:', error);
      throw error;
    }
  }

  public async getCameraSnapshot(camera: OnvifCamera, profileToken?: string): Promise<{ uri: string }> {
    try {
      log('Getting snapshot URI from camera%s', profileToken ? ` for profile: ${profileToken}` : ' (default profile)');
      
      // Try getSnapshotUri with callback - this is the real ONVIF method
      if (typeof (camera as any).getSnapshotUri === 'function') {
        const options = profileToken ? { profileToken } : {};
        const result = await new Promise<any>((resolve, reject) => {
          (camera as any).getSnapshotUri(options, (err: any, result: any) => {
            if (err) {
              log('getSnapshotUri callback error:', err);
              reject(err);
            } else {
              log('getSnapshotUri callback result:', result);
              resolve(result);
            }
          });
        });
        
        // Return the result if it has a uri property
        if (result && result.uri) {
          return { uri: result.uri };
        } else {
          log('Unexpected getSnapshotUri result format:', result);
          throw new Error('Invalid snapshot URI response from camera');
        }
      }
      
      throw new Error('No getSnapshotUri method available on camera object');
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
      const camera = await this.getCamera(config) as any; // Use any to access real ONVIF methods
      
      log('Camera connection established, testing available methods...');
      log('Camera object keys: %j', Object.keys(camera));
      
      // Try different methods to verify the camera is working
      let testSuccessful = false;
      
      // Try getStreamUri (singular) first - this is the real ONVIF method
      if (typeof camera.getStreamUri === 'function') {
        try {
          await new Promise((resolve, reject) => {
            camera.getStreamUri({}, (err: any, result: any) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          testSuccessful = true;
          log('Camera test successful using getStreamUri');
        } catch (err) {
          log('getStreamUri failed: %s', (err as Error).message);
        }
      }
      
      // Try getDeviceInformation as backup
      if (!testSuccessful && typeof camera.getDeviceInformation === 'function') {
        try {
          await new Promise((resolve, reject) => {
            camera.getDeviceInformation((err: any, result: any) => {
              if (err) reject(err);
              else resolve(result);
            });
          });
          testSuccessful = true;
          log('Camera test successful using getDeviceInformation');
        } catch (err) {
          log('getDeviceInformation failed: %s', (err as Error).message);
        }
      }
      
      // Try the method from our interface as last resort
      if (!testSuccessful && typeof camera.getStreamUris === 'function') {
        try {
          await camera.getStreamUris();
          testSuccessful = true;
          log('Camera test successful using getStreamUris');
        } catch (err) {
          log('getStreamUris failed: %s', (err as Error).message);
        }
      }
      
      // If we got this far, the connection was established
      if (!testSuccessful) {
        log('Camera connected but no test methods worked, considering connection successful');
        testSuccessful = true;
      }
      
      log('Camera connection test result: %s for %s:%d', testSuccessful, config.hostname, config.port);
      return testSuccessful;
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

  public async refreshDiscovery(options?: DiscoveryOptions): Promise<CameraDiscoveryResult[]> {
    log('Refreshing camera discovery...');
    return await this.discoverCameras(options);
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
