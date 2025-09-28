"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DatabaseService = void 0;
const node_json_db_1 = require("node-json-db");
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('smart-stream:database');
class DatabaseService {
    db;
    config = null;
    constructor(dbPath = '/data/conf') {
        this.db = new node_json_db_1.JsonDB(new node_json_db_1.Config(dbPath, true, true, '/'));
    }
    async initialize() {
        try {
            log('Initializing database service...');
            // Load existing configuration or create default
            await this.loadConfig();
            log('Database service initialized successfully');
        }
        catch (error) {
            log('Error initializing database:', error);
            throw error;
        }
    }
    async loadConfig() {
        try {
            const data = await this.get('');
            this.config = data;
            log('Loaded existing configuration');
        }
        catch (error) {
            log('No existing configuration found, creating default...');
            this.config = { cams: {} };
            await this.set('', this.config);
        }
    }
    async get(path = '') {
        try {
            await this.db.reload();
            const data = await this.db.getData('/' + path);
            log('get("/%s") = %s...', path, JSON.stringify(data).substring(0, 40));
            return data;
        }
        catch (error) {
            log('get("/%s") Error: %s', path, error.message);
            throw error;
        }
    }
    async set(path, value) {
        try {
            await this.db.reload();
            await this.db.push('/' + path, value);
            log('set("/%s") = %O', path, value);
            return value;
        }
        catch (error) {
            log('set("/%s") Error: %s', path, error.message);
            throw error;
        }
    }
    async delete(path) {
        try {
            await this.db.reload();
            await this.db.delete('/' + path);
            log('delete("/%s")', path);
        }
        catch (error) {
            log('delete("/%s") Error: %s', path, error.message);
            throw error;
        }
    }
    async exists(path) {
        try {
            await this.get(path);
            return true;
        }
        catch {
            return false;
        }
    }
    // Camera-specific methods
    async getCameras() {
        try {
            return await this.get('cams') || {};
        }
        catch {
            return {};
        }
    }
    async getCamera(hostname) {
        try {
            return await this.get(`cams/${hostname}`);
        }
        catch {
            return null;
        }
    }
    async addCamera(camera) {
        const cameraData = {
            ...camera,
            username: camera.username || 'admin',
            password: camera.password || '',
            autostart: camera.autostart || false
        };
        await this.set(`cams/${camera.hostname}`, cameraData);
        return cameraData;
    }
    async updateCamera(hostname, updates) {
        const existing = await this.getCamera(hostname);
        if (!existing) {
            throw new Error(`Camera with hostname '${hostname}' not found`);
        }
        const updated = { ...existing, ...updates };
        await this.set(`cams/${hostname}`, updated);
        return updated;
    }
    async deleteCamera(hostname) {
        const exists = await this.getCamera(hostname);
        if (!exists) {
            throw new Error(`Camera with hostname '${hostname}' not found`);
        }
        await this.delete(`cams/${hostname}`);
    }
    async setCameras(cameras) {
        for (const camera of cameras) {
            const existing = await this.getCamera(camera.hostname);
            if (!existing) {
                await this.addCamera(camera);
            }
        }
    }
    getCameraOperations(hostname) {
        return {
            get: async (key, defaultValue) => {
                try {
                    return await this.get(`cams/${hostname}/${key}`);
                }
                catch {
                    return defaultValue;
                }
            },
            set: async (key, value) => {
                await this.set(`cams/${hostname}/${key}`, value);
            },
            del: async () => {
                await this.deleteCamera(hostname);
            },
            toggle: async () => {
                try {
                    const current = await this.get(`cams/${hostname}/autostart`);
                    await this.set(`cams/${hostname}/autostart`, !current);
                }
                catch {
                    // If autostart doesn't exist, default to false and toggle to true
                    await this.set(`cams/${hostname}/autostart`, true);
                }
            }
        };
    }
    // Configuration methods
    async getConfig() {
        if (!this.config) {
            await this.loadConfig();
        }
        return this.config;
    }
    async updateConfig(updates) {
        const current = await this.getConfig();
        this.config = { ...current, ...updates };
        await this.set('', this.config);
        return this.config;
    }
    // Health check
    async healthCheck() {
        try {
            await this.db.reload();
            return true;
        }
        catch {
            return false;
        }
    }
}
exports.DatabaseService = DatabaseService;
//# sourceMappingURL=DatabaseService.js.map