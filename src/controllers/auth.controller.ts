/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiResponse } from '../types/common.types.js';
import { LoginResponse, RefreshTokenResponse } from '../types/auth.types.js';
import { BadRequestError, UnauthorizedError, NotFoundError } from '../errors/AppError.js';

export class AuthController {
  /**
   * POST /api/auth/login
   */
  static login = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { username, password } = req.body;

    if (!username || !password) {
      throw new BadRequestError('Username and password are required');
    }

    const ipAddress = req.ip || req.socket.remoteAddress || undefined;
    const userAgent = req.get('user-agent') || undefined;

    const result: LoginResponse = await AuthService.login(username, password, ipAddress, userAgent);

    // Set refresh token in HttpOnly cookie
    // Note: path='/' allows middleware to check authentication
    // Cookie is still secure (HttpOnly, Secure in production, SameSite=strict)
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS trong production
      sameSite: process.env.NODE_ENV === 'production' ? 'strict' : 'lax', // Lax for development to allow cross-origin
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/', // Changed from '/api/auth' to '/' so middleware can check authentication
    });

    const response: ApiResponse<LoginResponse> = {
      success: true,
      message: 'Login successful',
      data: result,
    };

    res.status(200).json(response);
  });

  /**
   * POST /api/auth/refresh-token
   */
  static refreshToken = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Get refresh token from cookie (preferred) or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;
    
    console.log('[auth-controller]: Refresh token request received:', {
      hasCookie: !!req.cookies?.refreshToken,
      hasBodyToken: !!req.body?.refreshToken,
      cookieKeys: req.cookies ? Object.keys(req.cookies) : [],
      allCookies: req.cookies,
    });

    // Debug logging
    const refreshTokenValue = req.cookies?.refreshToken || req.body?.refreshToken;
    console.log('[AuthController] Refresh token request:', {
      hasCookies: !!req.cookies,
      cookies: req.cookies ? Object.keys(req.cookies) : [],
      hasRefreshTokenCookie: !!req.cookies?.refreshToken,
      hasRefreshTokenBody: !!req.body?.refreshToken,
      refreshTokenPrefix: refreshTokenValue ? refreshTokenValue.substring(0, 20) + '...' : 'N/A',
    });

    if (!refreshToken) {
      // Clear cookie if it exists but is empty
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/', // Changed from '/api/auth' to '/' to match cookie path
      });
      throw new BadRequestError('Refresh token is required');
    }

    try {
      const result: RefreshTokenResponse = await AuthService.refreshToken(refreshToken);

      const response: ApiResponse<RefreshTokenResponse> = {
        success: true,
        message: 'Token refreshed successfully',
        data: result,
      };

      res.status(200).json(response);
    } catch (error) {
      // If refresh token is invalid/expired, clear the cookie
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
        res.clearCookie('refreshToken', {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'strict',
          path: '/', // Changed from '/api/auth' to '/' to match cookie path
        });
      }
      // Re-throw to let error handler process it
      throw error;
    }
  });

  /**
   * POST /api/auth/logout
   */
  static logout = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    // Get refresh token from cookie or body
    const refreshToken = req.cookies?.refreshToken || req.body?.refreshToken;

    if (refreshToken) {
      await AuthService.logout(refreshToken);
    }

    // Clear cookie
    res.clearCookie('refreshToken', {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/', // Changed from '/api/auth' to '/' to match cookie path
    });

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.status(200).json(response);
  });
}

