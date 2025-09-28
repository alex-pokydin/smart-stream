"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.requestLogger = requestLogger;
const debug_1 = __importDefault(require("debug"));
const log = (0, debug_1.default)('smart-stream:request');
function requestLogger(req, res, next) {
    // Generate request ID
    req.requestId = generateRequestId();
    req.startTime = Date.now();
    // Log incoming request
    log('%s %s %s - Started', req.requestId, req.method, req.path);
    // Log request body for debugging (excluding sensitive data)
    if (req.body && Object.keys(req.body).length > 0) {
        const safeBody = sanitizeLogData(req.body);
        log('%s Request body: %O', req.requestId, safeBody);
    }
    // Log query parameters
    if (req.query && Object.keys(req.query).length > 0) {
        log('%s Query params: %O', req.requestId, req.query);
    }
    // Override res.json to log responses
    const originalJson = res.json;
    res.json = function (body) {
        const duration = req.startTime ? Date.now() - req.startTime : 0;
        log('%s %s %s %d - Completed in %dms', req.requestId, req.method, req.path, res.statusCode, duration);
        // Log response body for debugging (excluding sensitive data)
        if (body && typeof body === 'object') {
            const safeBody = sanitizeLogData(body);
            log('%s Response body: %O', req.requestId, safeBody);
        }
        return originalJson.call(this, body);
    };
    next();
}
function generateRequestId() {
    return Math.random().toString(36).substr(2, 9);
}
function sanitizeLogData(data) {
    if (typeof data !== 'object' || data === null) {
        return data;
    }
    if (Array.isArray(data)) {
        return data.map(sanitizeLogData);
    }
    const result = {};
    const sensitiveFields = ['password', 'token', 'key', 'secret', 'auth'];
    for (const [key, value] of Object.entries(data)) {
        const keyLower = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => keyLower.includes(field));
        if (isSensitive) {
            result[key] = '[REDACTED]';
        }
        else if (typeof value === 'object' && value !== null) {
            result[key] = sanitizeLogData(value);
        }
        else {
            result[key] = value;
        }
    }
    return result;
}
//# sourceMappingURL=requestLogger.js.map