/**
 * Error Handler Middleware
 * Xử lý lỗi và trả về format JSON thống nhất
 */

import { Request, Response, NextFunction } from 'express';
import { AppError } from '../errors/AppError.js';
import { ApiResponse } from '../types/common.types.js';
import multer from 'multer';
import { MAX_FILE_SIZE } from '../utils/fileUpload.js';

export function errorHandler(
  err: Error | AppError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  let statusCode = 500;
  let message = 'Internal Server Error';

  // Handle Multer errors (file upload errors)
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      const maxSizeMB = Math.round(MAX_FILE_SIZE / 1024 / 1024);
      statusCode = 413;
      message = `File quá lớn! Kích thước tối đa là ${maxSizeMB}MB`;
    } else if (err.code === 'LIMIT_FILE_COUNT') {
      statusCode = 400;
      message = 'Quá nhiều file được upload';
    } else {
      statusCode = 400;
      message = err.message || 'Lỗi upload file';
    }
  } else if (err instanceof AppError) {
    statusCode = err.statusCode;
    message = err.message;
  } else if (err instanceof Error) {
    // Handle file filter errors (invalid file type)
    if (err.message.includes('Định dạng file không được hỗ trợ')) {
      statusCode = 415;
      message = err.message;
    } else if (err.message.includes('quá lớn') || err.message.includes('File quá lớn')) {
      statusCode = 413;
      message = err.message;
    } else {
      message = err.message;
    }
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


