/**
 * Validation Middleware
 * Uses express-validator to validate input
 */

import { Request, Response, NextFunction } from 'express';
import { body, validationResult } from 'express-validator';
import { BadRequestError } from '../errors/AppError.js';

/**
 * Middleware to check validation results
 */
export const validate = (req: Request, res: Response, next: NextFunction) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    const errorMessages = errors.array().map((err) => ({
      field: err.type === 'field' ? err.path : 'unknown',
      message: err.msg,
    }));
    throw new BadRequestError(`Validation failed: ${errorMessages.map((e) => e.message).join(', ')}`);
  }
  next();
};

/**
 * Validation rules for login
 */
export const validateLogin = [
  body('username')
    .trim()
    .notEmpty()
    .withMessage('Username is required')
    .isLength({ min: 3, max: 100 })
    .withMessage('Username must be between 3 and 100 characters'),
  body('password')
    .notEmpty()
    .withMessage('Password is required')
    .isLength({ min: 6 })
    .withMessage('Password must be at least 6 characters'),
  validate,
];

/**
 * Validation rules for refresh token
 */
export const validateRefreshToken = [
  body('refreshToken')
    .optional()
    .trim()
    .notEmpty()
    .withMessage('Refresh token cannot be empty if provided'),
  validate,
];

