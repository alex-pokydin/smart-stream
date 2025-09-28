import { JsonDB, Config } from 'node-json-db';
import debug from 'debug';
import { CameraConfig, AppConfig, CameraOperations } from '@smart-stream/shared';

const log = debug('smart-stream:database');

export class DatabaseService {
  private db: JsonDB;
  private config: AppConfig | null = null;

  constructor(dbPath: string = '/data/conf') {
    this.db = new JsonDB(new Config(dbPath, true, true, '/'));
  }

  public async initialize(): Promise<void> {
    try {
      log('Initializing database service...');
      
      // Load existing configuration or create default
      await this.loadConfig();
      
      log('Database service initialized successfully');
    } catch (error) {
      log('Error initializing database:', error);
      throw error;
    }
  }

  private async loadConfig(): Promise<void> {
    try {
      const data = await this.get('');
      this.config = data as AppConfig;
      log('Loaded existing configuration');
    } catch (error) {
      log('No existing configuration found, creating default...');
      this.config = { cams: {} };
      await this.set('', this.config);
    }
  }

  public async get<T = unknown>(path: string = ''): Promise<T> {
    try {
      await this.db.reload();
      const data = await this.db.getData('/' + path);
      log('get("/%s") = %s...', path, JSON.stringify(data).substring(0, 40));
      return data as T;
    } catch (error) {
      log('get("/%s") Error: %s', path, (error as Error).message);
      throw error;
    }
  }

  public async set<T = unknown>(path: string, value: T): Promise<T> {
    try {
      await this.db.reload();
      await this.db.push('/' + path, value);
      log('set("/%s") = %O', path, value);
      return value;
    } catch (error) {
      log('set("/%s") Error: %s', path, (error as Error).message);
      throw error;
    }
  }

  public async delete(path: string): Promise<void> {
    try {
      await this.db.reload();
      await this.db.delete('/' + path);
      log('delete("/%s")', path);
    } catch (error) {
      log('delete("/%s") Error: %s', path, (error as Error).message);
      throw error;
    }
  }

  public async exists(path: string): Promise<boolean> {
    try {
      await this.get(path);
      return true;
    } catch {
      return false;
    }
  }

  // Camera-specific methods
  public async getCameras(): Promise<Record<string, CameraConfig>> {
    try {
      return await this.get<Record<string, CameraConfig>>('cams') || {};
    } catch {
      return {};
    }
  }

  public async getCamera(hostname: string): Promise<CameraConfig | null> {
    try {
      return await this.get<CameraConfig>(`cams/${hostname}`);
    } catch {
      return null;
    }
  }

  public async addCamera(camera: CameraConfig): Promise<CameraConfig> {
    const cameraData: CameraConfig = {
      ...camera,
      username: camera.username || 'admin',
      password: camera.password || '',
      autostart: camera.autostart || false
    };

    await this.set(`cams/${camera.hostname}`, cameraData);
    return cameraData;
  }

  public async updateCamera(hostname: string, updates: Partial<CameraConfig>): Promise<CameraConfig> {
    const existing = await this.getCamera(hostname);
    if (!existing) {
      throw new Error(`Camera with hostname '${hostname}' not found`);
    }

    const updated = { ...existing, ...updates };
    await this.set(`cams/${hostname}`, updated);
    return updated;
  }

  public async deleteCamera(hostname: string): Promise<void> {
    const exists = await this.getCamera(hostname);
    if (!exists) {
      throw new Error(`Camera with hostname '${hostname}' not found`);
    }

    await this.delete(`cams/${hostname}`);
  }

  public async setCameras(cameras: CameraConfig[]): Promise<void> {
    for (const camera of cameras) {
      const existing = await this.getCamera(camera.hostname);
      if (!existing) {
        await this.addCamera(camera);
      }
    }
  }

  public getCameraOperations(hostname: string): CameraOperations {
    return {
      get: async <T>(key: string, defaultValue?: T): Promise<T> => {
        try {
          return await this.get<T>(`cams/${hostname}/${key}`);
        } catch {
          return defaultValue as T;
        }
      },

      set: async (key: string, value: unknown): Promise<void> => {
        await this.set(`cams/${hostname}/${key}`, value);
      },

      del: async (): Promise<void> => {
        await this.deleteCamera(hostname);
      },

      toggle: async (): Promise<void> => {
        try {
          const current = await this.get<boolean>(`cams/${hostname}/autostart`);
          await this.set(`cams/${hostname}/autostart`, !current);
        } catch {
          // If autostart doesn't exist, default to false and toggle to true
          await this.set(`cams/${hostname}/autostart`, true);
        }
      }
    };
  }

  // Configuration methods
  public async getConfig(): Promise<AppConfig> {
    if (!this.config) {
      await this.loadConfig();
    }
    return this.config!;
  }

  public async updateConfig(updates: Partial<AppConfig>): Promise<AppConfig> {
    const current = await this.getConfig();
    this.config = { ...current, ...updates };
    await this.set('', this.config);
    return this.config;
  }

  // Health check
  public async healthCheck(): Promise<boolean> {
    try {
      await this.db.reload();
      return true;
    } catch {
      return false;
    }
  }
}
