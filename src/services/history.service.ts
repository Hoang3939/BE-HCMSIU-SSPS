/**
 * History Service
 * Business logic cho module History
 */

import { getPool } from '../config/database.js';
import { NotFoundError, InternalServerError } from '../errors/AppError.js';
import type {
  TransactionHistoryItem,
  PrintHistoryItem,
} from '../types/history.types.js';
import sql from 'mssql';

export class HistoryService {
  /**
   * Lấy lịch sử giao dịch của sinh viên
   * @param studentId - ID của sinh viên
   * @returns Danh sách giao dịch
   */
  static async getTransactionHistory(
    studentId: string
  ): Promise<TransactionHistoryItem[]> {
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, studentId)
        .query(`
          SELECT 
            TransID,
            Date,
            Amount,
            PagesAdded,
            Status,
            PaymentMethod,
            PaymentRef
          FROM Transactions
          WHERE StudentID = @studentId
          ORDER BY Date DESC
        `);

      return result.recordset.map((row) => ({
        transID: row.TransID,
        date: row.Date.toISOString(),
        amount: parseFloat(row.Amount),
        pagesAdded: row.PagesAdded,
        status: row.Status,
        paymentMethod: row.PaymentMethod,
        paymentRef: row.PaymentRef,
      }));
    } catch (error) {
      console.error('[HistoryService] Error getting transaction history:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError('Không thể lấy lịch sử giao dịch');
    }
  }

  /**
   * Lấy lịch sử in ấn của sinh viên
   * @param studentId - ID của sinh viên
   * @returns Danh sách lệnh in
   */
  static async getPrintHistory(
    studentId: string
  ): Promise<PrintHistoryItem[]> {
    try {
      const pool = await getPool();
      const result = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, studentId)
        .query(`
          SELECT 
            pj.JobID,
            ISNULL(pj.StartTime, GETDATE()) AS CreatedAt,
            d.FileName,
            p.Name AS PrinterName,
            pj.TotalPages AS PagesUsed,
            pj.Status,
            pj.Cost
          FROM PrintJobs pj
          INNER JOIN Documents d ON pj.DocumentID = d.DocID
          INNER JOIN Printers p ON pj.PrinterID = p.PrinterID
          WHERE pj.StudentID = @studentId
          ORDER BY ISNULL(pj.StartTime, GETDATE()) DESC
        `);

      return result.recordset.map((row) => ({
        jobID: row.JobID,
        date: row.CreatedAt.toISOString(),
        documentName: row.FileName || 'Unknown',
        printerName: row.PrinterName || 'Unknown',
        pagesUsed: row.PagesUsed || 0,
        status: row.Status,
        cost: parseFloat(row.Cost || 0),
      }));
    } catch (error) {
      console.error('[HistoryService] Error getting print history:', error);
      if (error instanceof NotFoundError) {
        throw error;
      }
      // Log detailed error for debugging
      if (error instanceof Error) {
        console.error('[HistoryService] Error details:', {
          message: error.message,
          stack: error.stack,
        });
        // If it's a SQL error, provide more context
        if (error.message.includes('Invalid column name') || error.message.includes('Invalid object name')) {
          throw new InternalServerError(`Lỗi truy vấn database: ${error.message}`);
        }
      }
      throw new InternalServerError('Không thể lấy lịch sử in ấn');
    }
  }
}

