/**
 * History Controller
 * Handles HTTP requests for history operations
 */

import { Request, Response } from 'express';
import { HistoryService } from '../services/history.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import type {
  TransactionHistoryResponse,
  PrintHistoryResponse,
} from '../types/history.types.js';

export class HistoryController {
  /**
   * GET /api/history/transactions
   * Lấy lịch sử giao dịch của sinh viên
   */
  static getTransactionHistory = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.auth || !req.auth.userID) {
        console.warn('[HistoryController] Unauthorized request - no auth or userID');
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const studentId = req.auth.userID;
      console.log('[HistoryController] Getting transaction history for userID:', studentId);
      
      const transactions = await HistoryService.getTransactionHistory(studentId);
      
      console.log('[HistoryController] Returning transactions:', transactions.length);

      const response: TransactionHistoryResponse = {
        success: true,
        data: transactions,
      };

      res.status(200).json(response);
    }
  );

  /**
   * GET /api/history/prints
   * Lấy lịch sử in ấn của sinh viên
   */
  static getPrintHistory = asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.auth || !req.auth.userID) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized',
        });
      }

      const studentId = req.auth.userID;
      const prints = await HistoryService.getPrintHistory(studentId);

      const response: PrintHistoryResponse = {
        success: true,
        data: prints,
      };

      res.status(200).json(response);
    }
  );
}

