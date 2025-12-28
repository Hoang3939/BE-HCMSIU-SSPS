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
        // Log để debug: User không tồn tại
        console.log(`[AuthService] Login failed: User not found - Username/Email: ${username}`);
        throw new UnauthorizedError('Invalid username or password');
      }

      // Verify password
      // If PasswordHash exists in database, verify with bcrypt
      if (user.passwordHash) {
        const isValid = await verifyPassword(password, user.passwordHash);
        if (!isValid) {
          // Log để debug: Password sai
          console.log(`[AuthService] Login failed: Invalid password - Username: ${user.username}`);
          throw new UnauthorizedError('Invalid username or password');
        }
      } else {
        // If no PasswordHash, try SSO integration
        // TODO: Integrate with HCMSIU SSO service
        const isValid = await this.verifyWithSSO(username, password);
        if (!isValid) {
          // Log để debug: SSO verification failed
          console.log(`[AuthService] Login failed: SSO verification failed - Username: ${user.username}`);
          throw new UnauthorizedError('Invalid username or password');
        }
      }

      // Log thành công
      console.log(`[AuthService] Login successful - Username: ${user.username}, Role: ${user.role}`);

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
      const sessionID = await SessionModel.createSession(
        user.userID,
        accessToken,
        refreshToken,
        expiresAt,
        ipAddress,
        userAgent
      );
      console.log('[AuthService] Session created:', {
        sessionID,
        userID: user.userID,
        refreshTokenLength: refreshToken.length,
        expiresAt: expiresAt.toISOString(),
      });

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
    if (!refreshToken || refreshToken.trim().length === 0) {
      throw new UnauthorizedError('Refresh token is required');
    }

    try {
      if (!refreshToken) {
        throw new UnauthorizedError('Refresh token is required');
      }

      console.log('[AuthService] Refreshing token, token length:', refreshToken.length);
      
      // Verify refresh token
      let decoded;
      try {
        decoded = verifyRefreshToken(refreshToken);
        console.log('[AuthService] Token verified, userID:', decoded.userID);
      } catch (error) {
        if (error instanceof Error) {
          if (error.message.includes('expired')) {
            throw new UnauthorizedError('Refresh token expired');
          } else if (error.message.includes('Invalid')) {
            throw new UnauthorizedError('Invalid refresh token');
          }
        }
        throw new UnauthorizedError('Invalid refresh token');
      }

      // Step 2: Check if user still exists and is active (do this first to avoid unnecessary session recreation)
      const user = await UserModel.findByUserID(decoded.userID);
      if (!user) {
        console.error('[auth-service]: User not found, userID:', decoded.userID);
        throw new NotFoundError('User not found');
        console.error('[AuthService] Token verification failed:', error);
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Step 4: Check if user still exists and is active
      let user;
      try {
        user = await UserModel.findByUserID(decoded.userID);
        if (!user) {
          throw new NotFoundError('User not found');
        }
      } catch (userError) {
        console.error('[AuthService] Error finding user:', {
          userID: decoded.userID,
          error: userError instanceof Error ? userError.message : String(userError),
        });
        if (userError instanceof NotFoundError) {
          throw userError;
        }
        // Nếu là lỗi database khác, vẫn throw nhưng với message rõ ràng hơn
        throw new InternalServerError(`Error checking user: ${userError instanceof Error ? userError.message : 'Unknown error'}`);
      }
      if (!user.isActive) {
        console.error('[auth-service]: User is inactive, userID:', decoded.userID);
        throw new UnauthorizedError('User account is inactive');
      }
      console.log('[auth-service]: User found and active, username:', user.username);

      // Step 3: Check session in database
      let session = await SessionModel.findByRefreshToken(refreshToken);
      if (!session) {
        // If refresh token JWT is still valid but session not found in database,
        // it might have been deleted (e.g., server restart, database clear).
        // In this case, we can recreate the session if the JWT is still valid.
        console.warn('[AuthService] Refresh token not found in database, but JWT is valid. Recreating session:', {
          userID: decoded.userID,
          refreshTokenPrefix: refreshToken.substring(0, 20) + '...',
          tokenExpiry: decoded.exp ? new Date(decoded.exp * 1000) : 'N/A',
        });

        // Recreate session with the same refresh token
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

        const sessionID = await SessionModel.createSession(
          decoded.userID,
          '', // Will be updated below with new access token
          refreshToken,
          expiresAt,
          undefined, // IP address
          undefined  // User agent
        );

        // Get the created session
        session = await SessionModel.findBySessionID(sessionID);
        if (!session) {
          throw new InternalServerError('Failed to recreate session');
        }
      }

      // Step 4: Verify session hasn't expired
      if (session.expiresAt < new Date()) {
        throw new UnauthorizedError('Session expired');
      }

      // Generate new access token (token đã được verify, nên có thể tạo access token mới)
      const userPayload: UserPayload = {
        userID: user.userID,
        username: user.username,
        email: user.email,
        role: user.role,
      };

      const newAccessToken = generateAccessToken(userPayload);
      console.log('[auth-service]: New access token generated');

      // Step 6: Update session with new access token
      // Access token expires in 15 minutes (matching JWT_ACCESS_EXPIRES_IN)
      const expiresAt = new Date();
      expiresAt.setMinutes(expiresAt.getMinutes() + 15);

      await SessionModel.updateSession(session.sessionID, newAccessToken, expiresAt);
      console.log('[auth-service]: Session updated successfully');
      let newAccessToken: string;
      try {
        newAccessToken = generateAccessToken(userPayload);
      } catch (tokenError) {
        console.error('[AuthService] Error generating access token:', {
          error: tokenError instanceof Error ? tokenError.message : String(tokenError),
        });
        throw new InternalServerError(`Error generating access token: ${tokenError instanceof Error ? tokenError.message : 'Unknown error'}`);
      }

      // Check session in database (optional - để update session nếu có)
      // Wrap trong try-catch để không fail nếu có lỗi database
      try {
        let session = await SessionModel.findByRefreshToken(refreshToken);
        
        if (session) {
          // Nếu có session, update với access token mới
          console.log('[AuthService] Session found, updating with new access token, sessionID:', session.sessionID);
          try {
            const expiresAt = new Date();
            expiresAt.setMinutes(expiresAt.getMinutes() + 15); // 15 minutes
            await SessionModel.updateSession(session.sessionID, newAccessToken, expiresAt);
            console.log('[AuthService] Session updated successfully');
          } catch (updateError) {
            // Nếu update session fail, log nhưng không throw (vì token đã được verify)
            console.warn('[AuthService] Failed to update session, but token is valid, continuing...', {
              error: updateError instanceof Error ? updateError.message : String(updateError),
              sessionID: session.sessionID,
            });
          }
        } else {
          // Nếu không có session, tạo mới (fallback - không bắt buộc)
          console.warn('[AuthService] Session not found but token is valid, creating new session...');
          try {
            // Xóa các session cũ của user này để tránh duplicate
            await SessionModel.deleteAllUserSessions(decoded.userID);
            
            // Tạo session mới với refresh token và access token mới
            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + 7); // 7 days for refresh token
            
            await SessionModel.createSession(
              decoded.userID,
              newAccessToken,
              refreshToken,
              expiresAt
            );
            
            console.log('[AuthService] New session created successfully');
          } catch (fallbackError) {
            // Nếu tạo session thất bại, vẫn trả về access token (vì token đã được verify)
            console.warn('[AuthService] Failed to create fallback session, but token is valid, continuing...', {
              error: fallbackError instanceof Error ? fallbackError.message : String(fallbackError),
              stack: fallbackError instanceof Error ? fallbackError.stack : undefined,
            });
            // Không throw error, vì token đã được verify và access token đã được tạo
          }
        }
      } catch (sessionError) {
        // Nếu có lỗi khi query session, log nhưng không throw (vì token đã được verify)
        console.warn('[AuthService] Error checking/updating session, but token is valid, continuing...', {
          error: sessionError instanceof Error ? sessionError.message : String(sessionError),
          stack: sessionError instanceof Error ? sessionError.stack : undefined,
        });
      }

      // Luôn trả về access token nếu token đã được verify
      return {
        token: newAccessToken,
      };
    } catch (error) {
      // Re-throw known errors
      if (error instanceof UnauthorizedError || error instanceof NotFoundError) {
        throw error;
      }

      // Log unexpected errors
      console.error('[AuthService] Unexpected error refreshing token:', {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        errorType: error?.constructor?.name,
      });
      
      if (error instanceof UnauthorizedError || error instanceof NotFoundError || error instanceof InternalServerError) {
        throw error;
      }
      throw new InternalServerError(`Error refreshing token: ${error instanceof Error ? error.message : 'Unknown error'}`);
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

