/**
 * Payment Service
 * Business logic cho module Payment
 */

import { getPool } from '../config/database.js';
import sql from 'mssql';
import { BadRequestError, NotFoundError, InternalServerError } from '../errors/AppError.js';
import type {
  CreatePaymentRequest,
  PaymentResponse,
  SePayWebhookPayload,
  PaymentStatusResponse,
} from '../types/payment.types.js';
import * as dotenv from 'dotenv';

dotenv.config();

// Payment configuration from environment variables
const BANK_ID = process.env.BANK_ID || 'BIDV';
const ACCOUNT_NO = process.env.ACCOUNT_NO || '96247SSPS';
const TEMPLATE = process.env.TEMPLATE || 'compact2';
const MIN_AMOUNT = 2000; // 2,000 VNĐ
const MAX_AMOUNT = 500000; // 500,000 VNĐ
const MIN_PAGES = 10;
const MAX_PAGES = 500;

export class PaymentService {
  /**
   * Tạo giao dịch thanh toán và QR code
   * @param request - Amount và PageQuantity
   * @param studentId - ID của sinh viên
   * @returns Transaction ID và QR URL
   */
  static async createPayment(
    request: CreatePaymentRequest,
    studentId: string,
  ): Promise<PaymentResponse> {
    const { amount, pageQuantity } = request;

    // Validate input
    if (!amount || amount <= 0) {
      throw new BadRequestError('Số tiền phải lớn hơn 0');
    }

    if (!pageQuantity || pageQuantity <= 0) {
      throw new BadRequestError('Số trang phải lớn hơn 0');
    }

    if (amount < MIN_AMOUNT || amount > MAX_AMOUNT) {
      throw new BadRequestError(
        `Số tiền phải từ ${MIN_AMOUNT.toLocaleString()} đến ${MAX_AMOUNT.toLocaleString()} VNĐ`,
      );
    }

    if (pageQuantity < MIN_PAGES || pageQuantity > MAX_PAGES) {
      throw new BadRequestError(
        `Số trang phải từ ${MIN_PAGES} đến ${MAX_PAGES} trang`,
      );
    }

    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    // Verify student exists
    const studentCheck = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query('SELECT StudentID FROM Students WHERE StudentID = @studentId');

    if (studentCheck.recordset.length === 0) {
      throw new NotFoundError('Không tìm thấy sinh viên');
    }

    // Create transaction record
    const transId = crypto.randomUUID();
    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Insert transaction with PENDING status
      await transaction
        .request()
        .input('transId', sql.UniqueIdentifier, transId)
        .input('studentId', sql.UniqueIdentifier, studentId)
        .input('amount', sql.Decimal(10, 2), amount)
        .input('pagesAdded', sql.Int, pageQuantity)
        .query(`
          INSERT INTO Transactions (TransID, StudentID, Date, Amount, PagesAdded, Status)
          VALUES (@transId, @studentId, GETDATE(), @amount, @pagesAdded, 'PENDING')
        `);

      await transaction.commit();

      // Create memo: "SSPS <TransID>"
      const memo = `SSPS ${transId}`;

      // Build VietQR URL
      // Format: https://img.vietqr.io/image/<BANK_ID>-<ACCOUNT_NO>-<TEMPLATE>.png?amount=<AMOUNT>&addInfo=<CONTENT>
      const qrUrl = `https://img.vietqr.io/image/${BANK_ID}-${ACCOUNT_NO}-${TEMPLATE}.png?amount=${amount}&addInfo=${encodeURIComponent(memo)}`;

      return {
        transId,
        qrUrl,
      };
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('[PaymentService] Error creating payment:', error);
      throw new InternalServerError('Không thể tạo giao dịch thanh toán');
    }
  }

  /**
   * Xử lý webhook từ SePay
   * @param payload - Dữ liệu từ SePay webhook
   * @returns Success status
   */
  static async handleWebhook(payload: SePayWebhookPayload): Promise<{ success: boolean }> {
    console.log('[PaymentService] ========================================');
    console.log('[PaymentService] Webhook received at:', new Date().toISOString());
    console.log('[PaymentService] Full webhook payload:', JSON.stringify(payload, null, 2));
    console.log('[PaymentService] ========================================');
    
    // Only process incoming transfers
    if (payload.transferType !== 'in') {
      console.log('[PaymentService] Ignoring outgoing transfer (transferType:', payload.transferType, ')');
      return { success: true };
    }

    // Extract TransID from content or description using regex
    // Format: SSPS <UUID>
    // UUID có thể có dấu gạch ngang hoặc không (ngân hàng có thể loại bỏ)
    // Pattern 1: UUID với dấu gạch: 8-4-4-4-12
    // Pattern 2: UUID không dấu gạch: 32 ký tự hex liên tiếp
    const uuidWithHyphensRegex = /[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}/i;
    const uuidWithoutHyphensRegex = /[a-f0-9]{32}/i;
    
    console.log('[PaymentService] Extracting TransID from:', {
      content: payload.content,
      description: payload.description,
      transferAmount: payload.transferAmount,
      transferType: payload.transferType,
    });
    
    // Try to find UUID in content first, then description
    // Ưu tiên tìm UUID có dấu gạch trước (format chuẩn)
    let transIdMatch = 
      payload.content?.match(uuidWithHyphensRegex) || 
      payload.description?.match(uuidWithHyphensRegex) ||
      payload.content?.match(uuidWithoutHyphensRegex) || 
      payload.description?.match(uuidWithoutHyphensRegex);
    
    if (!transIdMatch) {
      console.error('[PaymentService] ❌ No TransID found in webhook payload!');
      console.error('[PaymentService] Content:', payload.content);
      console.error('[PaymentService] Description:', payload.description);
      console.error('[PaymentService] Full payload:', JSON.stringify(payload, null, 2));
      return { success: true }; // Return success to prevent SePay from retrying
    }

    let transId = transIdMatch[0];
    
    // Normalize UUID: Nếu không có dấu gạch, thêm vào để match với database
    // Format: 8-4-4-4-12
    if (!transId.includes('-')) {
      transId = `${transId.substring(0, 8)}-${transId.substring(8, 12)}-${transId.substring(12, 16)}-${transId.substring(16, 20)}-${transId.substring(20, 32)}`;
      console.log('[PaymentService] Normalized TransID (added hyphens):', transId);
    }
    
    console.log('[PaymentService] ✅ Extracted TransID:', transId);

    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Find transaction by TransID
      const transResult = await transaction
        .request()
        .input('transId', sql.UniqueIdentifier, transId)
        .query(`
          SELECT TransID, StudentID, Amount, PagesAdded, Status
          FROM Transactions
          WHERE TransID = @transId
        `);

      if (transResult.recordset.length === 0) {
        console.error(`[PaymentService] ❌ Transaction not found: ${transId}`);
        console.error('[PaymentService] This might be a payment for a different transaction or invalid TransID');
        await transaction.rollback();
        return { success: true }; // Return success to prevent retry
      }

      const trans = transResult.recordset[0];
      console.log('[PaymentService] Found transaction:', {
        transId: trans.TransID,
        studentId: trans.StudentID,
        amount: trans.Amount,
        pagesAdded: trans.PagesAdded,
        status: trans.Status,
      });

      // Check if already completed (Idempotency)
      if (trans.Status === 'COMPLETED') {
        console.log(`[PaymentService] ✅ Transaction already completed: ${transId} (idempotency check)`);
        await transaction.rollback();
        return { success: true };
      }

      // Check if status is PENDING
      if (trans.Status !== 'PENDING') {
        console.warn(`[PaymentService] ⚠️ Transaction status is not PENDING: ${trans.Status} (expected PENDING)`);
        await transaction.rollback();
        return { success: true };
      }

      // Validate amount: transferAmount must be >= Amount
      const requiredAmount = parseFloat(trans.Amount);
      const receivedAmount = payload.transferAmount;

      console.log('[PaymentService] Validating amount:', {
        required: requiredAmount,
        received: receivedAmount,
        isValid: receivedAmount >= requiredAmount,
      });

      if (receivedAmount < requiredAmount) {
        console.warn(
          `[PaymentService] ⚠️ Insufficient payment: Required ${requiredAmount}, Received ${receivedAmount}`,
        );
        await transaction.rollback();
        return { success: true }; // Return success but don't process
      }

      // Update transaction status to COMPLETED
      // Note: If CompletedAt column doesn't exist, this will fail - adjust schema if needed
      await transaction
        .request()
        .input('transId', sql.UniqueIdentifier, transId)
        .input('paymentRef', sql.NVarChar(255), payload.referenceCode || null)
        .query(`
          UPDATE Transactions
          SET Status = 'COMPLETED', 
              PaymentMethod = 'SePay', 
              PaymentRef = @paymentRef
          WHERE TransID = @transId
        `);

      // Add pages to student balance
      await transaction
        .request()
        .input('studentId', sql.UniqueIdentifier, trans.StudentID)
        .input('pagesAdded', sql.Int, trans.PagesAdded)
        .query(`
          UPDATE PageBalances
          SET CurrentBalance = CurrentBalance + @pagesAdded,
              PurchasedPages = PurchasedPages + @pagesAdded,
              LastUpdated = GETDATE()
          WHERE StudentID = @studentId
        `);

      await transaction.commit();

      console.log('[PaymentService] ========================================');
      console.log(`[PaymentService] ✅ Payment completed successfully!`);
      console.log(`[PaymentService] TransID: ${transId}`);
      console.log(`[PaymentService] Pages added: ${trans.PagesAdded}`);
      console.log(`[PaymentService] StudentID: ${trans.StudentID}`);
      console.log(`[PaymentService] Amount: ${requiredAmount} VNĐ`);
      console.log(`[PaymentService] Received: ${receivedAmount} VNĐ`);
      console.log('[PaymentService] ========================================');

      return { success: true };
    } catch (error) {
      if (transaction) {
        await transaction.rollback();
      }
      console.error('[PaymentService] Error processing webhook:', error);
      throw new InternalServerError('Không thể xử lý webhook thanh toán');
    }
  }

  /**
   * Kiểm tra trạng thái giao dịch
   * @param transId - Transaction ID
   * @returns Status và số trang
   */
  static async getStatus(transId: string): Promise<PaymentStatusResponse> {
    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    console.log('[PaymentService] Checking status for TransID:', transId);

    const result = await pool
      .request()
      .input('transId', sql.UniqueIdentifier, transId)
      .query(`
        SELECT Status, PagesAdded
        FROM Transactions
        WHERE TransID = @transId
      `);

    if (result.recordset.length === 0) {
      console.log('[PaymentService] Transaction not found:', transId);
      throw new NotFoundError('Không tìm thấy giao dịch');
    }

    const trans = result.recordset[0];
    const status = (trans.Status as string).toUpperCase().trim();

    console.log('[PaymentService] Transaction status:', {
      transId,
      status,
      pages: trans.PagesAdded,
    });

    return {
      status: status as 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED',
      pages: trans.PagesAdded || 0,
    };
  }

  /**
   * Lấy chi tiết giao dịch (để debug)
   * @param transId - Transaction ID
   * @returns Chi tiết đầy đủ của giao dịch
   */
  static async getDetails(transId: string): Promise<any> {
    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    console.log('[PaymentService] Getting details for TransID:', transId);

    const result = await pool
      .request()
      .input('transId', sql.UniqueIdentifier, transId)
      .query(`
        SELECT 
          TransID,
          StudentID,
          Date,
          Amount,
          PagesAdded,
          Status,
          PaymentMethod,
          PaymentRef
        FROM Transactions
        WHERE TransID = @transId
      `);

    if (result.recordset.length === 0) {
      console.log('[PaymentService] Transaction not found:', transId);
      throw new NotFoundError('Không tìm thấy giao dịch');
    }

    const trans = result.recordset[0];
    
    return {
      transId: trans.TransID,
      studentId: trans.StudentID,
      date: trans.Date,
      amount: parseFloat(trans.Amount),
      pagesAdded: trans.PagesAdded,
      status: trans.Status,
      paymentMethod: trans.PaymentMethod,
      paymentRef: trans.PaymentRef,
    };
  }
}

