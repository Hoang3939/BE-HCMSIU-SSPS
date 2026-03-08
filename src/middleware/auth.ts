import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util.js';
import { UnauthorizedError } from '../errors/AppError.js';

// Interface cho payload của JWT token
export interface AuthPayload {
  userID: string; // UUID string
  role: string;
}

// Extend Express.Request để thêm field auth
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

/**
 * Middleware xác thực: Kiểm tra Bearer token trong header Authorization
 * Sử dụng JWT utility functions để đảm bảo tính nhất quán
 */
export const authRequired = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    // Log cho admin endpoints để debug
    if (req.path.startsWith('/api/admin')) {
      console.log('[auth-middleware] Checking authentication for:', req.path);
    }
    
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      if (req.path.startsWith('/api/admin')) {
        console.log('[auth-middleware] ❌ Authorization header is missing');
      }
      res.status(401).json({
        success: false,
        message: 'Authorization header is missing',
      });
      return;
    }

    // Kiểm tra format "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      if (req.path.startsWith('/api/admin')) {
        console.log('[auth-middleware] ❌ Invalid authorization format');
      }
      res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1] as string;

    if (!token || token.trim().length === 0) {
      if (req.path.startsWith('/api/admin')) {
        console.log('[auth-middleware] ❌ Token is missing');
      }
      res.status(401).json({
        success: false,
        message: 'Token is missing',
      });
      return;
    }

    // Verify token sử dụng JWT utility function
    try {
      const decoded = verifyAccessToken(token);

      // Gán thông tin đã decode vào req.auth
      req.auth = {
        userID: String(decoded.userID),
        role: String(decoded.role),
      };

      if (req.path.startsWith('/api/admin')) {
        console.log('[auth-middleware] ✅ Token verified:', {
          userID: req.auth.userID,
          role: req.auth.role,
          path: req.path,
        });
      }

      next();
    } catch (error) {
      // Handle specific JWT errors
      let errorMessage = 'Invalid or expired token';
      
      if (error instanceof Error) {
        if (error.message.includes('expired')) {
          errorMessage = 'Token expired';
        } else if (error.message.includes('Invalid')) {
          errorMessage = 'Invalid token';
        } else if (error.message.includes('not active')) {
          errorMessage = 'Token not active yet';
        } else {
          errorMessage = error.message;
        }
      }

      console.warn('[auth-middleware] Token verification failed:', {
        message: errorMessage,
        path: req.path,
        method: req.method,
      });

      res.status(401).json({
        success: false,
        message: errorMessage,
      });
      return;
    }
  } catch (error) {
    console.error('[auth-middleware] Error in authRequired:', error);
    res.status(500).json({
      success: false,
      message: 'Internal server error',
    });
    return;
  }
};

/**
 * Middleware kiểm tra quyền: Kiểm tra req.auth.role
 * Nếu role không khớp, trả về 403 Forbidden
 * @param roles - Role(s) cần kiểm tra (ví dụ: 'ADMIN' hoặc ['ADMIN', 'SPSO'])
 */
export const requireRole = (...roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.auth) {
      if (req.path.startsWith('/api/admin')) {
        console.log('[requireRole] ❌ Authentication required');
      }
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      if (req.path.startsWith('/api/admin')) {
        console.log('[requireRole] ❌ Access denied:', {
          userRole: req.auth.role,
          requiredRoles: roles,
          path: req.path,
        });
      }
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
      return;
    }

    if (req.path.startsWith('/api/admin')) {
      console.log('[requireRole] ✅ Role check passed:', {
        userRole: req.auth.role,
        requiredRoles: roles,
        path: req.path,
      });
    }

    next();
  };
};
