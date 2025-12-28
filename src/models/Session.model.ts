/**
 * Session Model
 * Model để quản lý sessions trong database
 */

import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../config/database.js';
import { SessionData } from '../types/auth.types.js';

export class SessionModel {
  /**
   * Create new session
   */
  static async createSession(
    userID: string,
    token: string,
    refreshToken: string,
    expiresAt: Date,
    ipAddress?: string,
    userAgent?: string
  ): Promise<string> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const sessionID = randomUUID();

    await request
      .input('SessionID', sql.UniqueIdentifier, sessionID)
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('Token', sql.NVarChar(sql.MAX), token)
      .input('RefreshToken', sql.NVarChar(sql.MAX), refreshToken)
      .input('ExpiresAt', sql.DateTime, expiresAt)
      .input('IPAddress', sql.NVarChar(50), ipAddress || null)
      .input('UserAgent', sql.NVarChar(sql.MAX), userAgent || null)
      .query(`
        INSERT INTO Sessions (SessionID, UserID, Token, RefreshToken, ExpiresAt, IPAddress, UserAgent)
        VALUES (@SessionID, @UserID, @Token, @RefreshToken, @ExpiresAt, @IPAddress, @UserAgent)
      `);

    return sessionID;
  }

  /**
   * Find session by refresh token
   */
  static async findByRefreshToken(refreshToken: string): Promise<SessionData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    
    // Trim và normalize token để tránh vấn đề whitespace
    const normalizedToken = refreshToken.trim();
    console.log('[SessionModel] Finding session by refresh token, token length:', normalizedToken.length);
    
    // Thử query với RTRIM/LTRIM để loại bỏ whitespace
    const result = await request
      .input('RefreshToken', sql.NVarChar(sql.MAX), normalizedToken)
      .query(`
        SELECT 
          SessionID,
          UserID,
          Token,
          RefreshToken,
          ExpiresAt,
          LastActivity,
          IPAddress,
          UserAgent
        FROM Sessions
        WHERE LTRIM(RTRIM(RefreshToken)) = LTRIM(RTRIM(@RefreshToken))
          AND ExpiresAt > GETDATE()
      `);

    console.log('[SessionModel] Query result:', {
      recordCount: result.recordset.length,
      hasRecords: result.recordset.length > 0,
    });

    // Nếu không tìm thấy với điều kiện ExpiresAt, thử tìm không có điều kiện để debug
    if (result.recordset.length === 0) {
      console.log('[SessionModel] No session found with ExpiresAt check, trying without...');
      const resultWithoutExpiry = await request
        .input('RefreshToken', sql.NVarChar(sql.MAX), normalizedToken)
        .query(`
          SELECT 
            SessionID,
            UserID,
            Token,
            RefreshToken,
            ExpiresAt,
            LastActivity,
            IPAddress,
            UserAgent
          FROM Sessions
          WHERE LTRIM(RTRIM(RefreshToken)) = LTRIM(RTRIM(@RefreshToken))
        `);
      
      if (resultWithoutExpiry.recordset.length > 0) {
        const row = resultWithoutExpiry.recordset[0];
        const expiresAt = new Date(row.ExpiresAt);
        const now = new Date();
        console.log('[SessionModel] Found session but expired:', {
          sessionID: row.SessionID,
          expiresAt: expiresAt.toISOString(),
          now: now.toISOString(),
          isExpired: expiresAt <= now,
          timeDiff: now.getTime() - expiresAt.getTime(),
        });
      } else {
        console.log('[SessionModel] No session found at all with this refresh token');
        // Debug: So sánh token trong cookie với token trong DB
        try {
          const debugSessions = await request
            .input('TokenLength', sql.Int, normalizedToken.length)
            .query(`
              SELECT TOP 5 SessionID, UserID, LEN(RefreshToken) as TokenLength, 
                     LEFT(RefreshToken, 50) as TokenStart, 
                     RIGHT(RefreshToken, 50) as TokenEnd,
                     ExpiresAt
              FROM Sessions
              WHERE LEN(RefreshToken) = @TokenLength
              ORDER BY ExpiresAt DESC
            `);
          console.log('[SessionModel] Sessions with same token length:', debugSessions.recordset.length);
          if (debugSessions.recordset.length > 0) {
            const sample = debugSessions.recordset[0];
            console.log('[SessionModel] Sample session:', {
              sessionID: sample.SessionID,
              userID: sample.UserID,
              tokenLength: sample.TokenLength,
              tokenStart: sample.TokenStart,
              tokenEnd: sample.TokenEnd,
              expiresAt: sample.ExpiresAt,
            });
            console.log('[SessionModel] Cookie token start:', normalizedToken.substring(0, 50));
            console.log('[SessionModel] Cookie token end:', normalizedToken.substring(normalizedToken.length - 50));
            console.log('[SessionModel] Tokens match?', sample.TokenStart === normalizedToken.substring(0, 50));
          }
        } catch (debugError) {
          console.error('[SessionModel] Error in debug query:', debugError);
        }
      }
      
      return null;
    }

    const row = result.recordset[0];
    return {
      sessionID: row.SessionID,
      userID: row.UserID,
      token: row.Token,
      refreshToken: row.RefreshToken,
      expiresAt: new Date(row.ExpiresAt),
      lastActivity: new Date(row.LastActivity),
      ipAddress: row.IPAddress,
      userAgent: row.UserAgent,
    };
  }

  /**
   * Find session by session ID
   */
  static async findBySessionID(sessionID: string): Promise<SessionData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request
      .input('SessionID', sql.UniqueIdentifier, sessionID)
      .query(`
        SELECT 
          SessionID,
          UserID,
          Token,
          RefreshToken,
          ExpiresAt,
          LastActivity,
          IPAddress,
          UserAgent
        FROM Sessions
        WHERE SessionID = @SessionID
          AND ExpiresAt > GETDATE()
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      sessionID: row.SessionID,
      userID: row.UserID,
      token: row.Token,
      refreshToken: row.RefreshToken,
      expiresAt: new Date(row.ExpiresAt),
      lastActivity: new Date(row.LastActivity),
      ipAddress: row.IPAddress,
      userAgent: row.UserAgent,
    };
  }

  /**
   * Update session (update token and expiresAt)
   */
  static async updateSession(
    sessionID: string,
    token: string,
    expiresAt: Date
  ): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('SessionID', sql.UniqueIdentifier, sessionID)
      .input('Token', sql.NVarChar(sql.MAX), token)
      .input('ExpiresAt', sql.DateTime, expiresAt)
      .query(`
        UPDATE Sessions
        SET Token = @Token,
            ExpiresAt = @ExpiresAt,
            LastActivity = GETDATE()
        WHERE SessionID = @SessionID
      `);
  }

  /**
   * Delete session (logout)
   */
  static async deleteSession(sessionID: string): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('SessionID', sql.UniqueIdentifier, sessionID)
      .query(`
        DELETE FROM Sessions
        WHERE SessionID = @SessionID
      `);
  }

  /**
   * Delete all sessions of a user
   */
  static async deleteAllUserSessions(userID: string): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        DELETE FROM Sessions
        WHERE UserID = @UserID
      `);
  }

  /**
   * Delete expired sessions
   */
  static async deleteExpiredSessions(): Promise<number> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request.query(`
      DELETE FROM Sessions
      WHERE ExpiresAt < GETDATE()
    `);

    return result.rowsAffected[0] || 0;
  }
}

