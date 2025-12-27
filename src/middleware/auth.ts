import { type Request, type Response, type NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

// Interface cho payload của JWT token
export interface AuthPayload {
  userId: number;
  role: string;
}

// Helper function để lấy JWT secret với type safety
function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }
  return secret;
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
 * Nếu token hợp lệ, decode và gán vào req.auth
 * Nếu không hợp lệ, trả về 401 Unauthorized
 */
export const authRequired = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header is missing',
      });
      return;
    }

    // Kiểm tra format "Bearer <token>"
    const parts = authHeader.split(' ');
    if (parts.length !== 2 || parts[0] !== 'Bearer') {
      res.status(401).json({
        success: false,
        message: 'Invalid authorization format. Expected: Bearer <token>',
      });
      return;
    }

    const token = parts[1];

    // Lấy JWT_SECRET từ environment variable
    let jwtSecret: string;
    try {
      jwtSecret = getJwtSecret();
    } catch (error) {
      console.error('[auth-middleware]: JWT_SECRET is not configured');
      res.status(500).json({
        success: false,
        message: 'Server configuration error',
      });
      return;
    }

    // Verify và decode token
    // jwtSecret đã được gán từ getJwtSecret(), chắc chắn là string
    try {
      // @ts-expect-error - jwtSecret đã được kiểm tra và gán từ getJwtSecret() nên chắc chắn là string
      const decoded = jwt.verify(token, jwtSecret);
      
      // Kiểm tra type và extract payload
      if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
        res.status(401).json({
          success: false,
          message: 'Invalid token payload',
        });
        return;
      }

      // Type guard để đảm bảo decoded có đủ properties
      const payload = decoded as JwtPayload;
      if (!payload.userId || !payload.role) {
        res.status(401).json({
          success: false,
          message: 'Token payload is missing required fields',
        });
        return;
      }

      // Gán thông tin đã decode vào req.auth
      req.auth = {
        userId: typeof payload.userId === 'number' ? payload.userId : Number(payload.userId),
        role: String(payload.role),
      };

      next();
    } catch (error) {
      // Token không hợp lệ hoặc đã hết hạn
      res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
      });
      return;
    }
  } catch (error) {
    console.error('[auth-middleware]: Error in authRequired:', error);
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
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        success: false,
        message: `Access denied. Required role(s): ${roles.join(', ')}`,
      });
      return;
    }

    next();
  };
};

