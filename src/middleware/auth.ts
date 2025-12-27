import { type Request, type Response, type NextFunction } from 'express';
import * as jwt from 'jsonwebtoken';
import type { JwtPayload } from 'jsonwebtoken';
import * as dotenv from 'dotenv';

dotenv.config();

// Interface cho payload của JWT token
export interface AuthPayload {
  userID: string; // UUID string, not number
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

    const token = parts[1] as string;

    // Verify và decode token
    try {
      // Lấy JWT_SECRET từ environment variable
      const jwtSecretRaw = process.env.JWT_SECRET;
      if (!jwtSecretRaw) {
        console.error('[auth-middleware]: JWT_SECRET is not configured');
        res.status(500).json({
          success: false,
          message: 'Server configuration error',
        });
        return;
      }
      // After the null check, jwtSecretRaw is definitely a string
      // Verify token với issuer và audience (giống như trong jwt.util.ts)
      const decoded = jwt.verify(token, jwtSecretRaw, {
        issuer: 'hcmsiu-ssps',
        audience: 'hcmsiu-ssps-users',
      });
      // Kiểm tra type và extract payload
      if (typeof decoded === 'string' || !decoded || typeof decoded !== 'object') {
        res.status(401).json({
          success: false,
          message: 'Invalid token payload',
        });
        return;
      }

      // Type guard để đảm bảo decoded có đủ properties
      // JWT token có userID (string UUID), không phải userId (number)
      const payload = decoded as any; // Use any to access custom fields
      if (!payload.userID || !payload.role) {
        res.status(401).json({
          success: false,
          message: 'Token payload is missing required fields',
        });
        return;
      }

      // Gán thông tin đã decode vào req.auth
      req.auth = {
        userID: String(payload.userID), // Keep as string UUID
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

