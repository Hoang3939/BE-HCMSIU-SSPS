/**
 * Error Handler Middleware
 * Xử lý lỗi và trả về format JSON thống nhất
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { ApiResponse } from '../types/common.types.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal Server Error';

  if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    message = err.message;
  }

  // Log error (có thể thêm logging service sau)
  console.error(`[Error] ${statusCode} - ${message}`, {
    path: req.path,
    method: req.method,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });

  const response: ApiResponse = {
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  };

  res.status(statusCode).json(response);
}


