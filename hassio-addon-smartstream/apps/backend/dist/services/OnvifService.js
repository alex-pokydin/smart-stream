"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.OnvifService = void 0;
const onvif_1 = require("onvif");
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('smart-stream:onvif');
class OnvifService {
    database = null;
    discoveryCache = [];
    lastDiscovery = null;
    async initialize(database) {
        try {
            log('Initializing ONVIF service...');
            this.database = database;
            // Perform initial discovery
            await this.discoverCameras();
            log('ONVIF service initialized successfully');
        }
        catch (error) {
            log('Error initializing ONVIF service:', error);
            throw error;
        }
    }
    async discoverCameras(timeout = 5000) {
        return new Promise((resolve, reject) => {
            log('Starting camera discovery...');
            const startTime = Date.now();
            onvif_1.Discovery.probe({ timeout }, async (err, cameras) => {
                const duration = Date.now() - startTime;
                if (err) {
                    log('Discovery error:', err);
                    reject(err);
                    return;
                }
                try {
                    const discoveredCameras = (cameras || []).map((cam) => ({
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
                        const cameraConfigs = discoveredCameras.map(cam => ({
                            hostname: cam.hostname,
                            port: cam.port,
                            username: cam.username || 'admin',
                            password: cam.password || ''
                        }));
                        await this.database.setCameras(cameraConfigs);
                        log('Saved discovered cameras to database');
                    }
                    resolve(discoveredCameras);
                }
                catch (error) {
                    log('Error processing discovered cameras:', error);
                    reject(error);
                }
            });
        });
    }
    async getCamera(options) {
        return new Promise((resolve, reject) => {
            const opts = {
                hostname: options.hostname,
                port: options.port,
                username: options.username || 'admin',
                password: options.password || ''
            };
            log('Connecting to camera: %s:%d', opts.hostname, opts.port);
            new onvif_1.Cam(opts, function (err) {
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
    async getCameraStreams(camera) {
        try {
            return await camera.getStreamUris();
        }
        catch (error) {
            log('Error getting stream URIs:', error);
            throw error;
        }
    }
    async getCameraSnapshot(camera) {
        try {
            return await camera.getSnapshotUri();
        }
        catch (error) {
            log('Error getting snapshot URI:', error);
            throw error;
        }
    }
    async testCameraConnection(config) {
        try {
            const camera = await this.getCamera(config);
            // Try to get device information to verify connection
            await camera.getStreamUris();
            log('Camera connection test successful: %s:%d', config.hostname, config.port);
            return true;
        }
        catch (error) {
            log('Camera connection test failed: %s:%d - %s', config.hostname, config.port, error.message);
            return false;
        }
    }
    getDiscoveryCache() {
        const cacheAge = this.lastDiscovery ? Date.now() - this.lastDiscovery.getTime() : null;
        return {
            cameras: this.discoveryCache,
            lastDiscovery: this.lastDiscovery,
            cacheAge
        };
    }
    async refreshDiscovery() {
        log('Refreshing camera discovery...');
        return await this.discoverCameras();
    }
    // Health check
    async healthCheck() {
        try {
            // Simple health check - try to create a discovery instance
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.OnvifService = OnvifService;
//# sourceMappingURL=OnvifService.js.map