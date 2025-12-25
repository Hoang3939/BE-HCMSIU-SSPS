/**
 * Authentication Types
 * Định nghĩa các types cho module Authentication
 */

export interface LoginRequest {
  username: string;
  password: string;
}

export interface LoginResponse {
  token: string;
  refreshToken: string;
  user: {
    userID: string;
    username: string;
    email: string;
    role: 'STUDENT' | 'ADMIN' | 'SPSO';
  };
}

export interface RefreshTokenRequest {
  refreshToken?: string;
}

export interface RefreshTokenResponse {
  token: string;
}

export interface UserPayload {
  userID: string;
  username: string;
  email: string;
  role: 'STUDENT' | 'ADMIN' | 'SPSO';
}

export interface JWTPayload extends UserPayload {
  iat?: number;
  exp?: number;
}

export interface SessionData {
  sessionID: string;
  userID: string;
  token: string;
  refreshToken: string;
  expiresAt: Date;
  lastActivity: Date;
  ipAddress?: string;
  userAgent?: string;
}

