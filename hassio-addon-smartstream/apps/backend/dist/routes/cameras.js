"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createCameraRouter = createCameraRouter;
const express_1 = require("express");
const zod_1 = require("zod");
const validation_1 = require("../middleware/validation");
const shared_1 = require("@smart-stream/shared");
// Validation schemas
const addCameraSchema = zod_1.z.object({
    hostname: validation_1.commonSchemas.hostname,
    port: validation_1.commonSchemas.port,
    username: validation_1.commonSchemas.username,
    password: validation_1.commonSchemas.password,
    autostart: zod_1.z.boolean().optional()
});
const updateCameraSchema = zod_1.z.object({
    port: validation_1.commonSchemas.port.optional(),
    username: validation_1.commonSchemas.username.optional(),
    password: validation_1.commonSchemas.password.optional(),
    autostart: zod_1.z.boolean().optional()
});
const hostnameParamSchema = zod_1.z.object({
    hostname: validation_1.commonSchemas.hostname
});
function createCameraRouter(database, onvif) {
    const router = (0, express_1.Router)();
    // GET /cameras - List all cameras
    router.get('/', async (req, res, next) => {
        try {
            const cameras = await database.getCameras();
            const response = {
                success: true,
                data: { cameras }
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /cameras - Add a new camera
    router.post('/', (0, validation_1.validateBody)(addCameraSchema), async (req, res, next) => {
        try {
            const cameraData = req.body;
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
            const response = {
                success: true,
                data: camera,
                message: 'Camera added successfully'
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // GET /cameras/:hostname - Get specific camera
    router.get('/:hostname', (0, validation_1.validateParams)(hostnameParamSchema), async (req, res, next) => {
        try {
            const { hostname } = req.params;
            if (!hostname) {
                throw new shared_1.ValidationError('Hostname parameter is required', 'hostname', hostname);
            }
            const camera = await database.getCamera(hostname);
            if (!camera) {
                throw new shared_1.CameraNotFoundError(hostname);
            }
            const response = {
                success: true,
                data: camera
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // PUT /cameras/:hostname - Update camera
    router.put('/:hostname', (0, validation_1.validateParams)(hostnameParamSchema), (0, validation_1.validateBody)(updateCameraSchema), async (req, res, next) => {
        try {
            const { hostname } = req.params;
            if (!hostname) {
                throw new shared_1.ValidationError('Hostname parameter is required', 'hostname', hostname);
            }
            const updates = req.body;
            // If credentials are being updated, test the connection
            if (updates.username || updates.password || updates.port) {
                const existingCamera = await database.getCamera(hostname);
                if (!existingCamera) {
                    throw new shared_1.CameraNotFoundError(hostname);
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
            const response = {
                success: true,
                data: updatedCamera,
                message: 'Camera updated successfully'
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // DELETE /cameras/:hostname - Delete camera
    router.delete('/:hostname', (0, validation_1.validateParams)(hostnameParamSchema), async (req, res, next) => {
        try {
            const { hostname } = req.params;
            if (!hostname) {
                throw new shared_1.ValidationError('Hostname parameter is required', 'hostname', hostname);
            }
            await database.deleteCamera(hostname);
            const response = {
                success: true,
                message: 'Camera deleted successfully'
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /cameras/discover - Discover ONVIF cameras
    router.post('/discover', async (req, res, next) => {
        try {
            const startTime = Date.now();
            const cameras = await onvif.discoverCameras();
            const duration = Date.now() - startTime;
            const response = {
                success: true,
                data: { cameras, duration },
                message: `Discovered ${cameras.length} cameras in ${duration}ms`
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // GET /cameras/:hostname/test - Test camera connection
    router.get('/:hostname/test', (0, validation_1.validateParams)(hostnameParamSchema), async (req, res, next) => {
        try {
            const { hostname } = req.params;
            if (!hostname) {
                throw new shared_1.ValidationError('Hostname parameter is required', 'hostname', hostname);
            }
            const camera = await database.getCamera(hostname);
            if (!camera) {
                throw new shared_1.CameraNotFoundError(hostname);
            }
            const isConnected = await onvif.testCameraConnection({
                hostname: camera.hostname,
                port: typeof camera.port === 'string' ? parseInt(camera.port) : camera.port,
                username: camera.username,
                password: camera.password
            });
            const response = {
                success: true,
                data: {
                    hostname,
                    connected: isConnected,
                    timestamp: new Date().toISOString()
                }
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    // POST /cameras/:hostname/toggle - Toggle autostart
    router.post('/:hostname/toggle', (0, validation_1.validateParams)(hostnameParamSchema), async (req, res, next) => {
        try {
            const { hostname } = req.params;
            if (!hostname) {
                throw new shared_1.ValidationError('Hostname parameter is required', 'hostname', hostname);
            }
            const cameraOps = database.getCameraOperations(hostname);
            // Check if camera exists first
            const camera = await database.getCamera(hostname);
            if (!camera) {
                throw new shared_1.CameraNotFoundError(hostname);
            }
            await cameraOps.toggle();
            const updatedCamera = await database.getCamera(hostname);
            const response = {
                success: true,
                data: updatedCamera,
                message: `Camera autostart ${updatedCamera?.autostart ? 'enabled' : 'disabled'}`
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    });
    return router;
}
//# sourceMappingURL=cameras.js.map