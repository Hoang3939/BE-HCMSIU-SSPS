/**
 * JWT Utility Functions
 * Helper functions to generate and verify JWT tokens
 */

import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth.types.js';

const JWT_SECRET: string = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
const JWT_REFRESH_SECRET: string = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production';
const JWT_ACCESS_EXPIRES_IN = (process.env.JWT_ACCESS_EXPIRES_IN || '15m') as string;
const JWT_REFRESH_EXPIRES_IN = (process.env.JWT_REFRESH_EXPIRES_IN || '7d') as string;

/**
 * Generate Access Token (15 minutes)
 */
export function generateAccessToken(payload: JWTPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: JWT_ACCESS_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'hcmsiu-ssps',
    audience: 'hcmsiu-ssps-users',
  };
  return jwt.sign(payload, JWT_SECRET, options);
}

/**
 * Generate Refresh Token (7 days)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  const options: jwt.SignOptions = {
    expiresIn: JWT_REFRESH_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    issuer: 'hcmsiu-ssps',
    audience: 'hcmsiu-ssps-users',
  };
  return jwt.sign(payload, JWT_REFRESH_SECRET, options);
}

/**
 * Verify Access Token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_SECRET, {
      issuer: 'hcmsiu-ssps',
      audience: 'hcmsiu-ssps-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error;
  }
}

/**
 * Verify Refresh Token
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const decoded = jwt.verify(token, JWT_REFRESH_SECRET, {
      issuer: 'hcmsiu-ssps',
      audience: 'hcmsiu-ssps-users',
    }) as JWTPayload;
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

