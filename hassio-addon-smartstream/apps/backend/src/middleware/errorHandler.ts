import { Request, Response, NextFunction } from 'express';
import debug from 'debug';
import { ValidationError, CameraNotFoundError, StreamError, ApiResponse } from '@smart-stream/shared';

const log = debug('smart-stream:error');

export interface CustomError extends Error {
  status?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(
  error: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log the error
  log('Error in %s %s:', req.method, req.path, error);

  // Don't handle if response already sent
  if (res.headersSent) {
    return next(error);
  }

  let status = 500;
  let code = 'INTERNAL_SERVER_ERROR';
  let message = 'An unexpected error occurred';
  let details: Record<string, unknown> | undefined;

  // Handle specific error types
  if (error instanceof ValidationError) {
    status = 400;
    code = 'VALIDATION_ERROR';
    message = error.message;
    details = {
      field: error.field,
      value: error.value
    };
  } else if (error instanceof CameraNotFoundError) {
    status = 404;
    code = 'CAMERA_NOT_FOUND';
    message = error.message;
  } else if (error instanceof StreamError) {
    status = 500;
    code = 'STREAM_ERROR';
    message = error.message;
    details = {
      streamId: error.streamId,
      cause: error.cause?.message
    };
  } else if (error.status) {
    // Express HTTP errors
    status = error.status;
    code = error.code || `HTTP_${status}`;
    message = error.message;
  } else if (error.name === 'SyntaxError') {
    // JSON parsing errors
    status = 400;
    code = 'INVALID_JSON';
    message = 'Invalid JSON in request body';
  }

  // Prepare error response
  const errorResponse: ApiResponse = {
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
