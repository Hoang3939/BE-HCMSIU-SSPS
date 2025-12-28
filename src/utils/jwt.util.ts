/**
 * JWT Utility Functions
 * Helper functions to generate and verify JWT tokens
 * Reads secrets dynamically from environment variables
 */

import jwt from 'jsonwebtoken';
import { JWTPayload } from '../types/auth.types.js';

/**
 * Get JWT secrets from environment variables
 * Throws error if secrets are not configured
 */
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret === 'your-secret-key-change-in-production') {
    throw new Error('JWT_SECRET is not configured. Please set it in .env file.');
  }
  return secret;
}

function getJwtRefreshSecret(): string {
  const secret = process.env.JWT_REFRESH_SECRET;
  if (!secret || secret === 'your-refresh-secret-key-change-in-production') {
    throw new Error('JWT_REFRESH_SECRET is not configured. Please set it in .env file.');
  }
  return secret;
}

function getJwtAccessExpiresIn(): string {
  return process.env.JWT_ACCESS_EXPIRES_IN || '15m';
}

function getJwtRefreshExpiresIn(): string {
  return process.env.JWT_REFRESH_EXPIRES_IN || '7d';
}

// JWT configuration constants
const JWT_ISSUER = 'hcmsiu-ssps';
const JWT_AUDIENCE = 'hcmsiu-ssps-users';

/**
 * Generate Access Token (default: 15 minutes)
 */
export function generateAccessToken(payload: JWTPayload): string {
  try {
    const secret = getJwtSecret();
    const expiresIn = getJwtAccessExpiresIn();
    
    const options: jwt.SignOptions = {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    };
    
    return jwt.sign(payload, secret, options);
  } catch (error) {
    console.error('[jwt.util] Error generating access token:', error);
    throw new Error('Failed to generate access token');
  }
}

/**
 * Generate Refresh Token (default: 7 days)
 */
export function generateRefreshToken(payload: JWTPayload): string {
  try {
    const secret = getJwtRefreshSecret();
    const expiresIn = getJwtRefreshExpiresIn();
    
    const options: jwt.SignOptions = {
      expiresIn: expiresIn as jwt.SignOptions['expiresIn'],
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    };
    
    return jwt.sign(payload, secret, options);
  } catch (error) {
    console.error('[jwt.util] Error generating refresh token:', error);
    throw new Error('Failed to generate refresh token');
  }
}

/**
 * Verify Access Token
 * Returns decoded payload if valid, throws error if invalid
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    const secret = getJwtSecret();
    
    const decoded = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;
    
    // Validate required fields
    if (!decoded.userID || !decoded.role) {
      throw new Error('Token payload is missing required fields');
    }
    
    return decoded;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Token not active yet');
    }
    throw error;
  }
}

/**
 * Verify Refresh Token
 * Returns decoded payload if valid, throws error if invalid
 */
export function verifyRefreshToken(token: string): JWTPayload {
  try {
    const secret = getJwtRefreshSecret();
    
    const decoded = jwt.verify(token, secret, {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
    }) as JWTPayload;
    
    // Validate required fields
    if (!decoded.userID || !decoded.role) {
      throw new Error('Refresh token payload is missing required fields');
    }
    
    return decoded;
  } catch (error) {
    // Log error for debugging
    console.error('[jwt-util]: Refresh token verification failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      errorType: error instanceof jwt.TokenExpiredError ? 'TokenExpiredError' : 
                 error instanceof jwt.JsonWebTokenError ? 'JsonWebTokenError' : 
                 'Unknown',
    });
    
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Refresh token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid refresh token');
    }
    if (error instanceof jwt.NotBeforeError) {
      throw new Error('Refresh token not active yet');
    }
    throw error;
  }
}

/**
 * Decode token without verification (for debugging only)
 */
export function decodeToken(token: string): JWTPayload | null {
  try {
    return jwt.decode(token) as JWTPayload;
  } catch {
    return null;
  }
}

/**
 * Check if JWT secrets are configured
 */
export function checkJwtSecrets(): { accessSecret: boolean; refreshSecret: boolean } {
  try {
    getJwtSecret();
    getJwtRefreshSecret();
    return { accessSecret: true, refreshSecret: true };
  } catch (error) {
    const accessSecret = process.env.JWT_SECRET && 
      process.env.JWT_SECRET !== 'your-secret-key-change-in-production';
    const refreshSecret = process.env.JWT_REFRESH_SECRET && 
      process.env.JWT_REFRESH_SECRET !== 'your-refresh-secret-key-change-in-production';
    
    if (!accessSecret || !refreshSecret) {
      console.warn('[jwt.util] ⚠️  WARNING: JWT secrets not properly configured!');
      console.warn('[jwt.util] Run: npm run update-jwt-secrets');
    }
    
    return { accessSecret, refreshSecret };
  }
}
