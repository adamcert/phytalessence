import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger.js';
import { config } from '../config/index.js';

export interface ApiError extends Error {
  status?: number;
  code?: string;
}

export class AppError extends Error implements ApiError {
  status: number;
  code: string;

  constructor(message: string, status: number = 500, code: string = 'INTERNAL_ERROR') {
    super(message);
    this.status = status;
    this.code = code;
    this.name = 'AppError';
    Error.captureStackTrace(this, this.constructor);
  }
}

export const errorHandler = (
  err: ApiError,
  req: Request,
  res: Response,
  _next: NextFunction
): void => {
  const status = err.status || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = err.message || 'Une erreur est survenue';

  logger.error('Error occurred', {
    error: message,
    code,
    status,
    path: req.path,
    method: req.method,
    stack: err.stack,
  });

  const response: Record<string, unknown> = {
    error: {
      code,
      message,
      timestamp: new Date().toISOString(),
    },
  };

  if (config.env === 'development' && err.stack) {
    (response.error as Record<string, unknown>).stack = err.stack;
  }

  res.status(status).json(response);
};

export const notFoundHandler = (req: Request, res: Response): void => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
      timestamp: new Date().toISOString(),
    },
  });
};
