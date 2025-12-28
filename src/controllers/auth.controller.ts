/**
 * Authentication Controller
 * Handles HTTP requests for authentication
 */

import { Request, Response, NextFunction } from 'express';
import { AuthService } from '../services/auth.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { ApiResponse } from '../types/common.types.js';
import { LoginResponse, RefreshTokenResponse } from '../types/auth.types.js';
import { BadRequestError, UnauthorizedError } from '../errors/AppError.js';

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
    res.cookie('refreshToken', result.refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production', // Chỉ gửi qua HTTPS trong production
      sameSite: 'strict',
      maxAge: 7 * 24 * 60 * 60 * 1000, // 7 ngày
      path: '/api/auth',
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

    if (!refreshToken) {
      // Clear cookie if it exists but is empty
      res.clearCookie('refreshToken', {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/api/auth',
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
          path: '/api/auth',
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
      path: '/api/auth',
    });

    const response: ApiResponse = {
      success: true,
      message: 'Logout successful',
    };

    res.status(200).json(response);
  });
}

