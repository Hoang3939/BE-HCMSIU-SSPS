/**
 * Password Controller
 * Handles HTTP requests for password operations
 */

import { Request, Response } from 'express';
import { PasswordService } from '../services/password.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { body, validationResult } from 'express-validator';

export class PasswordController {
  /**
   * POST /api/auth/forgot-password
   * Yêu cầu gửi mã OTP
   */
  static requestPasswordReset = [
    body('email')
      .isEmail()
      .withMessage('Email không hợp lệ')
      .normalizeEmail(),
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { email } = req.body;
      const result = await PasswordService.requestPasswordReset(email);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }),
  ];

  /**
   * POST /api/auth/verify-otp
   * Xác thực mã OTP
   */
  static verifyOTP = [
    body('email')
      .isEmail()
      .withMessage('Email không hợp lệ')
      .normalizeEmail(),
    body('otpCode')
      .isLength({ min: 6, max: 6 })
      .withMessage('Mã OTP phải có 6 chữ số')
      .matches(/^\d{6}$/)
      .withMessage('Mã OTP chỉ được chứa số'),
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { email, otpCode } = req.body;
      const result = await PasswordService.verifyOTP(email, otpCode);

      res.status(200).json({
        success: true,
        message: result.message,
        data: {
          userID: result.userID,
        },
      });
    }),
  ];

  /**
   * POST /api/auth/reset-password
   * Reset password sau khi verify OTP
   */
  static resetPassword = [
    body('userID')
      .isUUID()
      .withMessage('UserID không hợp lệ'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Mật khẩu xác nhận không khớp');
        }
        return true;
      }),
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      const { userID, newPassword } = req.body;
      const result = await PasswordService.resetPassword(userID, newPassword);

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }),
  ];

  /**
   * POST /api/auth/change-password
   * Đổi mật khẩu khi đã đăng nhập
   */
  static changePassword = [
    body('currentPassword')
      .notEmpty()
      .withMessage('Mật khẩu hiện tại là bắt buộc'),
    body('newPassword')
      .isLength({ min: 6 })
      .withMessage('Mật khẩu phải có ít nhất 6 ký tự'),
    body('confirmPassword')
      .custom((value, { req }) => {
        if (value !== req.body.newPassword) {
          throw new Error('Mật khẩu xác nhận không khớp');
        }
        return true;
      }),
    asyncHandler(async (req: Request, res: Response) => {
      const errors = validationResult(req);
      if (!errors.isEmpty()) {
        return res.status(400).json({
          success: false,
          message: 'Dữ liệu không hợp lệ',
          errors: errors.array(),
        });
      }

      if (!req.auth || !req.auth.userID) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const { currentPassword, newPassword } = req.body;
      const userID = req.auth.userID;

      const result = await PasswordService.changePassword(
        userID,
        currentPassword,
        newPassword
      );

      res.status(200).json({
        success: true,
        message: result.message,
      });
    }),
  ];
}

