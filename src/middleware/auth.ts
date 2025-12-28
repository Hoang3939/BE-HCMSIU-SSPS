import { type Request, type Response, type NextFunction } from 'express';
import { verifyAccessToken } from '../utils/jwt.util.js';
import { UnauthorizedError } from '../errors/AppError.js';
import type { UserRole } from '../types/permission.types.js';

// Interface cho payload của JWT token
export interface AuthPayload {
  userID: string; // UUID string
  role: UserRole;
import type { JWTPayload } from '../types/auth.types.js';

// Interface cho payload của JWT token
export interface AuthPayload {
  userID: string;
  username: string;
  email: string;
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
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({
        success: false,
        message: 'Authorization header is missing',
      });
      return;
    }

    // Kiểm tra format "Bearer <token>"
    // Xử lý trường hợp có nhiều "Bearer" (ví dụ: "Bearer Bearer <token>")
    const parts = authHeader.trim().split(/\s+/);
    
    // Loại bỏ tất cả "Bearer" ở đầu, chỉ lấy token cuối cùng
    let token: string | undefined;
    for (let i = parts.length - 1; i >= 0; i--) {
      const part = parts[i];
      if (part && part !== 'Bearer' && part.length > 0) {
        token = part;
        break;
      }
    }

    if (!token) {
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

    // Verify và decode token sử dụng JWT utility function
    try {
      // Verify token với cùng issuer và audience như khi tạo token
      const payload = verifyAccessToken(token);
      
      // Extract thông tin từ payload
      const userID = payload.userID;
      const username = payload.username || '';
      const email = payload.email || '';
      const role = payload.role;
      
      if (!userID || !role) {
        res.status(401).json({
          success: false,
          message: 'Token payload is missing required fields (userID and role)',
        });
        return;
      }

      // Gán thông tin đã decode vào req.auth
      req.auth = {
        userID: String(payload.userID), // Keep as string UUID
        role: String(payload.role),
        userID: String(userID),
        username: String(username),
        email: String(email),
        role: String(role),
      };

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
 * @param roles - Role(s) cần kiểm tra (ví dụ: 'ADMIN' hoặc ['USER', 'ADMIN'])
 */
export const requireRole = (...roles: UserRole[]) => {
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

/**
 * Middleware kiểm tra quyền Admin
 * Chỉ cho phép ADMIN truy cập
 * STUDENT sẽ bị chặn với lỗi 403
 */
export const requireAdmin = requireRole('ADMIN');

/**
 * Middleware kiểm tra quyền Student hoặc Admin
 * Cho phép cả STUDENT và ADMIN truy cập
 */
export const requireStudent = requireRole('STUDENT', 'ADMIN');

/**
 * Middleware chặn STUDENT truy cập admin routes
 * Nếu STUDENT cố truy cập sẽ trả về 403 Forbidden
 */
export const blockStudentFromAdmin = (
  req: Request,
  res: Response,
  next: NextFunction
): void => {
  if (!req.auth) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  // Chặn STUDENT truy cập admin routes
  if (req.auth.role === 'STUDENT') {
    console.warn('[auth-middleware] Student attempted to access admin route:', {
      userID: req.auth.userID,
      path: req.path,
      method: req.method,
    });
    
    res.status(403).json({
      success: false,
      message: 'Access denied. Admin privileges required.',
    });
    return;
  }

  next();
};
