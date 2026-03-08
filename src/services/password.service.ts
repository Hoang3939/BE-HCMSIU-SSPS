/**
 * Password Service
 * Business logic cho password reset và change password
 */

import { UserModel } from '../models/User.model.js';
import { OTPModel } from '../models/OTP.model.js';
import { hashPassword, verifyPassword } from '../utils/bcrypt.util.js';
import { sendOTPEmail, sendPasswordChangedEmail } from '../utils/email.util.js';
import {
  NotFoundError,
  BadRequestError,
  UnauthorizedError,
  InternalServerError,
} from '../errors/AppError.js';
import sql from 'mssql';
import { getPool } from '../config/database.js';

export class PasswordService {
  /**
   * Tạo và gửi mã OTP cho forgot password
   * @param email - Email của user
   * @returns Success message
   */
  static async requestPasswordReset(email: string): Promise<{ message: string }> {
    // Normalize email (trim và lowercase)
    const normalizedEmail = email.trim().toLowerCase();

    // Tìm user theo email
    const user = await UserModel.findByEmail(normalizedEmail);
    if (!user) {
      throw new NotFoundError('Email không tồn tại trong hệ thống');
    }

    // Tạo mã OTP 6 chữ số
    const otpCode = Math.floor(100000 + Math.random() * 900000).toString();

    // Thời gian hết hạn: 5 phút
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + 5);

    // Lưu OTP vào database (dùng normalized email)
    await OTPModel.createOTP(user.userID, normalizedEmail, otpCode, expiresAt);

    // Gửi email OTP
    const emailSent = await sendOTPEmail(user.email, otpCode, user.username);
    if (!emailSent) {
      console.error('[PasswordService] Failed to send OTP email');
      // Không throw error để không tiết lộ thông tin về email tồn tại hay không
    }

    return {
      message: 'Mã OTP đã được gửi đến email của bạn',
    };
  }

  /**
   * Xác thực mã OTP
   * @param email - Email của user
   * @param otpCode - Mã OTP
   * @returns Success message với userID để reset password
   */
  static async verifyOTP(
    email: string,
    otpCode: string
  ): Promise<{ message: string; userID: string }> {
    // Trim và normalize input
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedOtpCode = otpCode.trim();

    // Tìm OTP trong database
    const otp = await OTPModel.findByCodeAndEmail(normalizedEmail, normalizedOtpCode);
    if (!otp) {
      throw new UnauthorizedError('Mã OTP không hợp lệ');
    }

    // Kiểm tra đã sử dụng chưa
    if (otp.isUsed) {
      throw new UnauthorizedError('Mã OTP đã được sử dụng');
    }

    // Kiểm tra thời gian hết hạn (so sánh với thời gian hiện tại)
    const now = new Date();
    const expiresAt = new Date(otp.expiresAt);

    // Thêm buffer 1 giây để tránh lỗi do precision
    if (expiresAt.getTime() < now.getTime() - 1000) {
      throw new UnauthorizedError('Mã OTP đã hết hạn');
    }

    // Đánh dấu OTP đã sử dụng ngay sau khi verify thành công
    await OTPModel.markAsUsed(otp.otpID);

    return {
      message: 'Mã OTP hợp lệ',
      userID: otp.userID,
    };
  }

  /**
   * Reset password sau khi verify OTP
   * @param userID - ID của user
   * @param newPassword - Mật khẩu mới
   */
  static async resetPassword(
    userID: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Tìm user
    const user = await UserModel.findByUserID(userID);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Hash mật khẩu mới
    const hashedPassword = await hashPassword(newPassword);

    // Cập nhật password trong database
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('PasswordHash', sql.NVarChar(sql.MAX), hashedPassword)
      .query(`
        UPDATE Users
        SET PasswordHash = @PasswordHash
        WHERE UserID = @UserID
      `);

    // Xóa tất cả OTP của user này (đảm bảo không dùng lại)
    await OTPModel.invalidateUserOTPs(userID);

    // Gửi email thông báo
    await sendPasswordChangedEmail(user.email, user.username);

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }

  /**
   * Đổi mật khẩu khi đã đăng nhập
   * @param userID - ID của user
   * @param currentPassword - Mật khẩu hiện tại
   * @param newPassword - Mật khẩu mới
   */
  static async changePassword(
    userID: string,
    currentPassword: string,
    newPassword: string
  ): Promise<{ message: string }> {
    // Tìm user
    const user = await UserModel.findByUserID(userID);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Kiểm tra mật khẩu hiện tại
    if (!user.passwordHash) {
      throw new BadRequestError('Tài khoản chưa có mật khẩu. Vui lòng sử dụng chức năng đặt mật khẩu.');
    }

    const isCurrentPasswordValid = await verifyPassword(
      currentPassword,
      user.passwordHash
    );
    if (!isCurrentPasswordValid) {
      throw new UnauthorizedError('Mật khẩu hiện tại không chính xác');
    }

    // Kiểm tra mật khẩu mới không trùng với mật khẩu cũ
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash);
    if (isSamePassword) {
      throw new BadRequestError('Mật khẩu mới phải khác với mật khẩu hiện tại');
    }

    // Hash mật khẩu mới
    const hashedPassword = await hashPassword(newPassword);

    // Cập nhật password trong database
    const pool = await getPool();
    if (!pool) {
      throw new Error('Database connection not available');
    }

    const request = pool.request();
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('PasswordHash', sql.NVarChar(sql.MAX), hashedPassword)
      .query(`
        UPDATE Users
        SET PasswordHash = @PasswordHash
        WHERE UserID = @UserID
      `);

    // Gửi email thông báo
    await sendPasswordChangedEmail(user.email, user.username);

    return {
      message: 'Đổi mật khẩu thành công',
    };
  }
}

