/**
 * OTP Model
 * Model để quản lý OTP codes trong database
 */

import sql from 'mssql';
import { getPool } from '../config/database.js';

export interface OTPData {
  otpID: string;
  userID: string;
  email: string;
  otpCode: string;
  expiresAt: Date;
  isUsed: boolean;
  createdAt: Date;
  usedAt?: Date;
}

export class OTPModel {
  /**
   * Tạo mã OTP mới
   * @param userID - ID của user
   * @param email - Email của user
   * @param otpCode - Mã OTP 6 chữ số
   * @param expiresAt - Thời gian hết hạn
   * @returns OTPID
   */
  static async createOTP(
    userID: string,
    email: string,
    otpCode: string,
    expiresAt: Date
  ): Promise<string> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    // Xóa các OTP cũ của user này trước khi tạo mới
    await this.invalidateUserOTPs(userID);

    const request = pool.request();
    const result = await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('Email', sql.NVarChar(255), email)
      .input('OTPCode', sql.NVarChar(6), otpCode)
      .input('ExpiresAt', sql.DateTime, expiresAt)
      .query(`
        INSERT INTO OTPCodes (UserID, Email, OTPCode, ExpiresAt)
        OUTPUT INSERTED.OTPID
        VALUES (@UserID, @Email, @OTPCode, @ExpiresAt)
      `);

    return result.recordset[0].OTPID;
  }

  /**
   * Tìm OTP theo code và email
   * @param email - Email của user
   * @param otpCode - Mã OTP
   * @returns OTPData hoặc null
   */
  static async findByCodeAndEmail(
    email: string,
    otpCode: string
  ): Promise<OTPData | null> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    // Bỏ điều kiện ExpiresAt > GETDATE() trong query để kiểm tra trong code
    // Vì có thể có vấn đề với timezone hoặc precision của datetime
    const result = await request
      .input('Email', sql.NVarChar(255), email.trim())
      .input('OTPCode', sql.NVarChar(6), otpCode.trim())
      .query(`
        SELECT 
          OTPID,
          UserID,
          Email,
          OTPCode,
          ExpiresAt,
          IsUsed,
          CreatedAt,
          UsedAt
        FROM OTPCodes
        WHERE Email = @Email
          AND OTPCode = @OTPCode
          AND IsUsed = 0
        ORDER BY CreatedAt DESC
      `);

    if (result.recordset.length === 0) {
      return null;
    }

    const row = result.recordset[0];
    return {
      otpID: row.OTPID,
      userID: row.UserID,
      email: row.Email,
      otpCode: row.OTPCode,
      expiresAt: new Date(row.ExpiresAt),
      isUsed: row.IsUsed === 1,
      createdAt: new Date(row.CreatedAt),
      usedAt: row.UsedAt ? new Date(row.UsedAt) : undefined,
    };
  }

  /**
   * Đánh dấu OTP đã sử dụng
   * @param otpID - ID của OTP
   */
  static async markAsUsed(otpID: string): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('OTPID', sql.UniqueIdentifier, otpID)
      .query(`
        UPDATE OTPCodes
        SET IsUsed = 1,
            UsedAt = GETDATE()
        WHERE OTPID = @OTPID
      `);
  }

  /**
   * Vô hiệu hóa tất cả OTP của user (xóa các OTP cũ)
   * @param userID - ID của user
   */
  static async invalidateUserOTPs(userID: string): Promise<void> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        UPDATE OTPCodes
        SET IsUsed = 1
        WHERE UserID = @UserID
          AND IsUsed = 0
      `);
  }

  /**
   * Xóa các OTP đã hết hạn (cleanup job)
   */
  static async deleteExpiredOTPs(): Promise<number> {
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    const result = await request.query(`
      DELETE FROM OTPCodes
      WHERE ExpiresAt < GETDATE()
        AND IsUsed = 1
    `);

    return result.rowsAffected[0] ?? 0;
  }
}

