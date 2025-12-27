/**
 * Authentication Service
 * Business logic for authentication
 */

import { UserModel } from '../models/User.model.js';
import { SessionModel } from '../models/Session.model.js';
import { generateAccessToken, generateRefreshToken, verifyRefreshToken } from '../utils/jwt.util.js';
import { verifyPassword } from '../utils/bcrypt.util.js';
import { UnauthorizedError, NotFoundError, InternalServerError } from '../errors/AppError.js';
import { LoginResponse, RefreshTokenResponse, UserPayload } from '../types/auth.types.js';

export class AuthService {
  /**
   * Login
   * TODO: Integrate with HCMSIU SSO service
   * Currently checks in database, later can call SSO API
   */
  static async login(
    username: string,
    password: string,
    ipAddress?: string,
    userAgent?: string
  ): Promise<LoginResponse> {
    try {
      // Find user by username or email
      let user = await UserModel.findByUsername(username);
      if (!user) {
        user = await UserModel.findByEmail(username);
      }

      if (!user) {
        throw new UnauthorizedError('Invalid username or password');
      }

      // Verify password
      // If PasswordHash exists in database, verify with bcrypt
      if (user.passwordHash) {
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          throw new UnauthorizedError('Invalid username or password');
        }
      } else {
        // If no PasswordHash, try SSO integration
        // TODO: Integrate with HCMSIU SSO service
        const isValid = await this.verifyWithSSO(username, password);
        if (!isValid) {
          throw new UnauthorizedError('Invalid username or password');
        }
      }

      // Generate JWT tokens
      const userPayload: UserPayload = {
        userID: user.userID,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const accessToken = generateAccessToken(userPayload);
      const refreshToken = generateRefreshToken(userPayload);

      // Calculate expiresAt for refresh token (7 days)
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + 7);

      // Save session to database
      await SessionModel.createSession(
        user.userID,
        accessToken,
        refreshToken,
        expiresAt,
        ipAddress,
        userAgent
      );

      // Update LastLogin
      await UserModel.updateLastLogin(user.userID);

      return {
        token: accessToken,
        refreshToken: refreshToken,
        user: {
          userID: user.userID,
          username: user.username,
          email: user.email,
          role: user.role,
        },
      };
    } catch (error) {
      if (error instanceof UnauthorizedError) {
        throw error;
      }
      throw new InternalServerError('Error during login');
    }
  }

  /**
   * Refresh access token
   */
  static async refreshToken(refreshToken: string): Promise<RefreshTokenResponse> {
    try {
      // Verify refresh token
      const decoded = verifyRefreshToken(refreshToken);

      // Check session in database
      const session = await SessionModel.findByRefreshToken(refreshToken);
      if (!session) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Check if user still exists and is active
      const user = await UserModel.findByUserID(decoded.userID);
      if (!user) {
        throw new NotFoundError('User not found');
      }

      // Generate new access token
      const userPayload: UserPayload = {
        userID: user.userID,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = generateAccessToken(userPayload);

      // Update session with new token
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes

      await SessionModel.updateSession(session.sessionID, newAccessToken, expiresAt);

      return {
        token: newAccessToken,
      };
    } catch (error) {
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError('Error refreshing token');
    }
  }

  /**
   * Logout
   */
  static async logout(refreshToken: string): Promise<void> {
    try {
      // Find session by refresh token
      const session = await SessionModel.findByRefreshToken(refreshToken);
      if (session) {
        await SessionModel.deleteSession(session.sessionID);
      }
    } catch (error) {
      // Don't throw error on logout, just log
      console.error('Error during logout:', error);
    }
  }

  /**
   * Verify with HCMSIU SSO (TODO: Implement)
   */
  private static async verifyWithSSO(username: string, password: string): Promise<boolean> {
    // TODO: Implement SSO integration
    // const response = await fetch(process.env.SSO_URL, {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({ username, password }),
    // });
    // return response.ok;
    return false;
  }
}

