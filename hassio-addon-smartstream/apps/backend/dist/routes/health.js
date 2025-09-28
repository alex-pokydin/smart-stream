"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.createHealthRouter = createHealthRouter;
const express_1 = require("express");
function createHealthRouter(database, onvif, streaming) {
    const router = (0, express_1.Router)();
    router.get('/', async (req, res) => {
        try {
            // Check all services
            const [dbHealth, onvifHealth, streamHealth] = await Promise.all([
                database.healthCheck(),
                onvif.healthCheck(),
                streaming.healthCheck()
            ]);
            const allHealthy = dbHealth && onvifHealth && streamHealth;
            const response = {
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
        }
        catch (error) {
            const response = {
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
    router.get('/database', async (req, res) => {
        try {
            const isHealthy = await database.healthCheck();
            res.status(isHealthy ? 200 : 503).json({
                service: 'database',
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(503).json({
                service: 'database',
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    });
    router.get('/onvif', async (req, res) => {
        try {
            const isHealthy = await onvif.healthCheck();
            res.status(isHealthy ? 200 : 503).json({
                service: 'onvif',
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(503).json({
                service: 'onvif',
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    });
    router.get('/streaming', async (req, res) => {
        try {
            const isHealthy = await streaming.healthCheck();
            res.status(isHealthy ? 200 : 503).json({
                service: 'streaming',
                status: isHealthy ? 'healthy' : 'unhealthy',
                timestamp: new Date().toISOString()
            });
        }
        catch (error) {
            res.status(503).json({
                service: 'streaming',
                status: 'unhealthy',
                timestamp: new Date().toISOString(),
                error: error.message
            });
        }
    });
    return router;
}
//# sourceMappingURL=health.js.map