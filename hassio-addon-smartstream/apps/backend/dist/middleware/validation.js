"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.commonSchemas = void 0;
exports.validateBody = validateBody;
exports.validateQuery = validateQuery;
exports.validateParams = validateParams;
const zod_1 = require("zod");
const shared_1 = require("@smart-stream/shared");
function validateBody(schema) {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.body);
            req.validatedBody = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const firstError = error.errors[0];
                if (firstError) {
                    const field = firstError.path.join('.');
                    const message = `Validation failed for field '${field}': ${firstError.message}`;
                    const receivedValue = 'received' in firstError ? firstError.received : undefined;
                    next(new shared_1.ValidationError(message, field, receivedValue));
                }
                else {
                    next(new shared_1.ValidationError('Validation failed', '', undefined));
                }
            }
            else {
                next(error);
            }
        }
    };
}
function validateQuery(schema) {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.query);
            req.query = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const firstError = error.errors[0];
                if (firstError) {
                    const field = firstError.path.join('.');
                    const message = `Query validation failed for field '${field}': ${firstError.message}`;
                    const receivedValue = 'received' in firstError ? firstError.received : undefined;
                    next(new shared_1.ValidationError(message, field, receivedValue));
                }
                else {
                    next(new shared_1.ValidationError('Query validation failed', '', undefined));
                }
            }
            else {
                next(error);
            }
        }
    };
}
function validateParams(schema) {
    return (req, res, next) => {
        try {
            const validatedData = schema.parse(req.params);
            req.params = validatedData;
            next();
        }
        catch (error) {
            if (error instanceof zod_1.ZodError) {
                const firstError = error.errors[0];
                if (firstError) {
                    const field = firstError.path.join('.');
                    const message = `Parameter validation failed for field '${field}': ${firstError.message}`;
                    const receivedValue = 'received' in firstError ? firstError.received : undefined;
                    next(new shared_1.ValidationError(message, field, receivedValue));
                }
                else {
                    next(new shared_1.ValidationError('Parameter validation failed', '', undefined));
                }
            }
            else {
                next(error);
            }
        }
    };
}
// Common validation schemas
exports.commonSchemas = {
    hostname: zod_1.z.string()
        .min(1, 'Hostname is required')
        .max(253, 'Hostname too long')
        .regex(/^[a-zA-Z0-9.-]+$/, 'Invalid hostname format'),
    port: zod_1.z.coerce.number()
        .int('Port must be an integer')
        .min(1, 'Port must be at least 1')
        .max(65535, 'Port must be at most 65535'),
    username: zod_1.z.string()
        .min(1, 'Username is required')
        .max(50, 'Username too long'),
    password: zod_1.z.string()
        .min(1, 'Password is required')
        .max(100, 'Password too long'),
    streamId: zod_1.z.string()
        .min(1, 'Stream ID is required')
        .regex(/^[a-zA-Z0-9-_]+$/, 'Invalid stream ID format')
};
//# sourceMappingURL=validation.js.map