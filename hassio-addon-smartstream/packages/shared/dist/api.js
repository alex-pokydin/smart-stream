"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StreamError = exports.CameraNotFoundError = exports.ValidationError = void 0;
class ValidationError extends Error {
    constructor(message, field, value) {
        super(message);
        this.field = field;
        this.value = value;
        this.name = 'ValidationError';
    }
}
exports.ValidationError = ValidationError;
class CameraNotFoundError extends Error {
    constructor(hostname) {
        super(`Camera with hostname '${hostname}' not found`);
        this.name = 'CameraNotFoundError';
    }
}
exports.CameraNotFoundError = CameraNotFoundError;
class StreamError extends Error {
    constructor(message, streamId, cause) {
        super(message);
        this.streamId = streamId;
        this.cause = cause;
        this.name = 'StreamError';
    }
}
exports.StreamError = StreamError;
//# sourceMappingURL=api.js.map