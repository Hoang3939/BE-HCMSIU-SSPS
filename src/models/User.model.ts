/**
 * User Model
 * Model để quản lý users trong database
 */

import sql from 'mssql';
import { getPool } from '../config/database.js';
import { UserPayload } from '../types/auth.types.js';

export interface UserData extends UserPayload {
  passwordHash?: string;
  createdAt: Date;
  lastLogin?: Date;
  isActive: boolean;
}

export class UserModel {
  /**
   * Find user by username
   */
  static async findByUsername(username: string): Promise<UserData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request
      .input('Username', sql.NVarChar(100), username)
      .query(`
        SELECT 
          UserID,
          Username,
          Email,
          Role,
          PasswordHash,
          CreatedAt,
          LastLogin,
          IsActive
        FROM Users
        WHERE Username = @Username
          AND IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      userID: row.UserID,
      username: row.Username,
      email: row.Email,
      role: row.Role,
      passwordHash: row.PasswordHash || undefined,
      createdAt: new Date(row.CreatedAt),
      lastLogin: row.LastLogin ? new Date(row.LastLogin) : undefined,
      isActive: row.IsActive,
    };
  }

  /**
   * Find user by email
   */
  static async findByEmail(email: string): Promise<UserData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request
      .input('Email', sql.NVarChar(255), email)
      .query(`
        SELECT 
          UserID,
          Username,
          Email,
          Role,
          PasswordHash,
          CreatedAt,
          LastLogin,
          IsActive
        FROM Users
        WHERE Email = @Email
          AND IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      userID: row.UserID,
      username: row.Username,
      email: row.Email,
      role: row.Role,
      passwordHash: row.PasswordHash || undefined,
      createdAt: new Date(row.CreatedAt),
      lastLogin: row.LastLogin ? new Date(row.LastLogin) : undefined,
      isActive: row.IsActive,
    };
  }

  /**
   * Find user by userID
   */
  static async findByUserID(userID: string): Promise<UserData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        SELECT 
          UserID,
          Username,
          Email,
          Role,
          PasswordHash,
          CreatedAt,
          LastLogin,
          IsActive
        FROM Users
        WHERE UserID = @UserID
          AND IsActive = 1
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      userID: row.UserID,
      username: row.Username,
      email: row.Email,
      role: row.Role,
      passwordHash: row.PasswordHash || undefined,
      createdAt: new Date(row.CreatedAt),
      lastLogin: row.LastLogin ? new Date(row.LastLogin) : undefined,
      isActive: row.IsActive,
    };
  }

  /**
   * Find user by userID (for admin operations - includes inactive users)
   */
  static async findByUserIDForAdmin(userID: string): Promise<UserData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        SELECT 
          UserID,
          Username,
          Email,
          Role,
          PasswordHash,
          CreatedAt,
          LastLogin,
          IsActive
        FROM Users
        WHERE UserID = @UserID
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      userID: row.UserID,
      username: row.Username,
      email: row.Email,
      role: row.Role,
      passwordHash: row.PasswordHash || undefined,
      createdAt: new Date(row.CreatedAt),
      lastLogin: row.LastLogin ? new Date(row.LastLogin) : undefined,
      isActive: row.IsActive,
    };
  }

  /**
   * Update LastLogin
   */
  static async updateLastLogin(userID: string): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        UPDATE Users
        SET LastLogin = GETDATE()
        WHERE UserID = @UserID
      `);
  }
}

