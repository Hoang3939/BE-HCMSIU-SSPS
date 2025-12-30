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
      console.log('[HistoryService] Getting transaction history for studentId:', studentId);
      
      const pool = await getPool();
      if (!pool) {
        throw new InternalServerError('Database connection not available');
      }
      
      // Normalize studentId to uppercase (SQL Server GUIDs are case-insensitive but we want consistency)
      const normalizedStudentId = studentId.toUpperCase();
      console.log('[HistoryService] Normalized studentId:', normalizedStudentId);
      
      // First, verify the student exists in Students table
      const studentCheck = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, normalizedStudentId)
        .query('SELECT StudentID FROM Students WHERE StudentID = @studentId');
      
      console.log('[HistoryService] Student check result:', {
        found: studentCheck.recordset.length > 0,
        studentId: normalizedStudentId,
      });
      
      // Also check if there are any transactions with this StudentID (for debugging)
      const transactionCheck = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, normalizedStudentId)
        .query('SELECT COUNT(*) as count FROM Transactions WHERE StudentID = @studentId');
      
      console.log('[HistoryService] Transaction count check:', {
        count: transactionCheck.recordset[0]?.count || 0,
        studentId: normalizedStudentId,
      });
      
      const result = await pool
        .request()
        .input('studentId', sql.UniqueIdentifier, normalizedStudentId)
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

      console.log('[HistoryService] Found transactions:', result.recordset.length);
      if (result.recordset.length > 0) {
        console.log('[HistoryService] Sample transaction:', {
          transID: result.recordset[0].TransID,
          status: result.recordset[0].Status,
          date: result.recordset[0].Date,
          studentID: normalizedStudentId,
        });
      } else {
        console.warn('[HistoryService] No transactions found for studentId:', normalizedStudentId);
        // Try to find any transactions to see what StudentIDs exist
        const allTransactions = await pool
          .request()
          .query('SELECT TOP 5 StudentID, TransID, Status FROM Transactions ORDER BY Date DESC');
        console.log('[HistoryService] Sample StudentIDs from Transactions table:', 
          allTransactions.recordset.map((r: any) => ({
            studentID: r.StudentID,
            transID: r.TransID,
            status: r.Status,
          }))
        );
      }

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

