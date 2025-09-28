"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.errorHandler = errorHandler;
const debug_1 = __importDefault(require("debug"));
const shared_1 = require("@smart-stream/shared");
const log = (0, debug_1.default)('smart-stream:error');
function errorHandler(error, req, res, next) {
    // Log the error
    log('Error in %s %s:', req.method, req.path, error);
    // Don't handle if response already sent
    if (res.headersSent) {
        return next(error);
    }
    let status = 500;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details;
    // Handle specific error types
    if (error instanceof shared_1.ValidationError) {
        status = 400;
        code = 'VALIDATION_ERROR';
        message = error.message;
        details = {
            field: error.field,
            value: error.value
        };
    }
    else if (error instanceof shared_1.CameraNotFoundError) {
        status = 404;
        code = 'CAMERA_NOT_FOUND';
        message = error.message;
    }
    else if (error instanceof shared_1.StreamError) {
        status = 500;
        code = 'STREAM_ERROR';
        message = error.message;
        details = {
            streamId: error.streamId,
            cause: error.cause?.message
        };
    }
    else if (error.status) {
        // Express HTTP errors
        status = error.status;
        code = error.code || `HTTP_${status}`;
        message = error.message;
    }
    else if (error.name === 'SyntaxError') {
        // JSON parsing errors
        status = 400;
        code = 'INVALID_JSON';
        message = 'Invalid JSON in request body';
    }
    // Prepare error response
    const errorResponse = {
        success: false,
        error: code,
        message,
        ...(details && { data: details })
    };
    // In development, include stack trace
    if (process.env.NODE_ENV === 'development') {
        errorResponse.data = {
            ...(errorResponse.data && typeof errorResponse.data === 'object' ? errorResponse.data : {}),
            stack: error.stack?.split('\n')
        };
    }
    res.status(status).json(errorResponse);
}
//# sourceMappingURL=errorHandler.js.map