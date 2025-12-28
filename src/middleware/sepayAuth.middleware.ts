/**
 * SePay Webhook Authentication Middleware
 * Verifies Authorization header from SePay webhook
 * 
 * SePay sends: "Authorization": "Apikey API_KEY_CUA_BAN"
 */

import { Request, Response, NextFunction } from 'express';
import { UnauthorizedError } from '../errors/AppError.js';
import * as dotenv from 'dotenv';

dotenv.config();

export function verifySePayWebhook(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  // Get Authorization header (case-insensitive)
  const authHeader = 
    req.headers['authorization'] || 
    req.headers['Authorization'] ||
    null;

  if (!authHeader) {
    console.warn('[SePayAuth] Missing Authorization header');
    throw new UnauthorizedError('Missing Authorization header');
  }

  const sepayApiKey = process.env.SEPAY_API_KEY;

  if (!sepayApiKey) {
    console.error('[SePayAuth] SEPAY_API_KEY not configured in environment variables');
    throw new UnauthorizedError('Server configuration error');
  }

  // SePay sends: "Apikey API_KEY_CUA_BAN" (exact format)
  // Trim whitespace to handle any extra spaces
  const trimmedHeader = authHeader.trim();
  const expectedHeader = `Apikey ${sepayApiKey}`;

  if (trimmedHeader !== expectedHeader) {
    console.warn('[SePayAuth] Invalid API key', {
      received: trimmedHeader.substring(0, 20) + '...', // Log first 20 chars only for security
      expectedPrefix: 'Apikey',
    });
    throw new UnauthorizedError('Invalid API key');
  }

  // Authentication successful
  console.log('[SePayAuth] Webhook authenticated successfully');
  next();
}

