/**
 * Payment Controller
 * Handles HTTP requests for payment operations
 */

import { Request, Response } from 'express';
import { PaymentService } from '../services/payment.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/AppError.js';
import { validateUUID } from '../utils/validation.util.js';
import type {
  CreatePaymentRequest,
  SePayWebhookPayload,
} from '../types/payment.types.js';

export class PaymentController {
  /**
   * Tạo giao dịch thanh toán và QR code
   * POST /api/payment/create
   */
  static createPayment = asyncHandler(async (req: Request, res: Response) => {
    const { amount, pageQuantity } = req.body as CreatePaymentRequest;
    
    // Get studentId from auth (JWT token) instead of header
    // This ensures consistency with history queries
    if (!req.auth || !req.auth.userID) {
      throw new BadRequestError('Unauthorized - please login again');
    }

    const studentId = req.auth.userID;
    console.log('[PaymentController] Creating payment for userID:', studentId);

    if (!amount || !pageQuantity) {
      throw new BadRequestError('Amount và pageQuantity là bắt buộc');
    }

    const result = await PaymentService.createPayment(
      { amount, pageQuantity },
      studentId,
    );

    res.status(201).json({
      success: true,
      data: result,
    });
  });

  /**
   * Xử lý webhook từ SePay
   * POST /api/payment/sepay-webhook
   */
  static handleWebhook = asyncHandler(async (req: Request, res: Response) => {
    console.log('[PaymentController] Webhook received:', {
      method: req.method,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'content-type': req.headers['content-type'],
      },
      body: req.body,
    });

    const payload = req.body as SePayWebhookPayload;

    // Validate payload structure
    if (!payload || typeof payload.transferAmount !== 'number') {
      console.error('[PaymentController] Invalid webhook payload:', payload);
      throw new BadRequestError('Invalid webhook payload');
    }

    const result = await PaymentService.handleWebhook(payload);

    res.status(200).json(result);
  });

  /**
   * Kiểm tra trạng thái giao dịch
   * GET /api/payment/status/:transId
   */
  static getStatus = asyncHandler(async (req: Request, res: Response) => {
    const { transId } = req.params;

    if (!transId) {
      throw new BadRequestError('Transaction ID là bắt buộc');
    }

    const result = await PaymentService.getStatus(transId);

    res.status(200).json({
      success: true,
      data: result,
    });
  });

  /**
   * Lấy chi tiết giao dịch (để debug)
   * GET /api/payment/details/:transId
   */
  static getDetails = asyncHandler(async (req: Request, res: Response) => {
    const { transId } = req.params;

    if (!transId) {
      throw new BadRequestError('Transaction ID là bắt buộc');
    }

    const result = await PaymentService.getDetails(transId);

    res.status(200).json({
      success: true,
      data: result,
    });
  });
}

