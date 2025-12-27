/**
 * Print Job Service
 * Business logic cho module Print Jobs
 */

import { getPool } from '../config/database.js';
import { validateAndCalculateCost } from '../utils/billingCalculator.js';
import { countDocumentPages } from '../utils/pageCounter.js';
import sql from 'mssql';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import {
  BadRequestError,
  NotFoundError,
  InternalServerError,
} from '../errors/AppError.js';
import type {
  CreatePrintJobRequest,
  CreatePrintJobResponse,
  PaperSize,
} from '../types/printJob.types.js';

export class PrintJobService {
  /**
   * Tạo print job mới với transaction
   * @param request - Thông tin print job
   * @returns Thông tin print job đã tạo
   */
  static async createPrintJob(
    request: CreatePrintJobRequest
  ): Promise<CreatePrintJobResponse> {
    const {
      printerId,
      documentId,
      copies = 1,
      paperSize = 'A4',
      side = 'ONE_SIDED',
      orientation = 'PORTRAIT',
      pageRange,
      studentId,
    } = request;

    // Validate input (UUIDs already validated in controller, but validate again for safety)
    if (!printerId || printerId.trim().length === 0) {
      throw new BadRequestError('printerId là bắt buộc');
    }
    if (!documentId || documentId.trim().length === 0) {
      throw new BadRequestError('documentId là bắt buộc');
    }
    if (!studentId || studentId.trim().length === 0) {
      throw new BadRequestError('studentId là bắt buộc');
    }

    if (copies <= 0 || !Number.isInteger(copies)) {
      throw new BadRequestError('Số bản in phải là số nguyên dương');
    }

    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    const transaction = new sql.Transaction(pool);

    try {
      await transaction.begin();

      // Check printer exists and is available
      const printerResult = await transaction
        .request()
        .input('printerId', sql.UniqueIdentifier, printerId)
        .query(`
          SELECT PrinterID, Name, Status, IsActive
          FROM Printers
          WHERE PrinterID = @printerId
        `);

      if (printerResult.recordset.length === 0) {
        await transaction.rollback();
        throw new NotFoundError('Máy in không tồn tại');
      }

      const printer = printerResult.recordset[0];
      if (!printer.IsActive || printer.Status !== 'AVAILABLE') {
        await transaction.rollback();
        throw new NotFoundError('Máy in không hoạt động');
      }

      // Check document exists and belongs to student
      const documentResult = await transaction
        .request()
        .input('docId', sql.UniqueIdentifier, documentId)
        .input('studentId', sql.UniqueIdentifier, studentId)
        .query(`
          SELECT d.DocID, d.FileName, d.FileSize, d.FilePath, d.StudentID
          FROM Documents d
          INNER JOIN Students s ON d.StudentID = s.StudentID
          WHERE d.DocID = @docId AND s.StudentID = @studentId
        `);

      if (documentResult.recordset.length === 0) {
        await transaction.rollback();
        throw new NotFoundError('Tài liệu không tồn tại');
      }

      const document = documentResult.recordset[0];

      // Validate document has required fields
      if (!document.FileName || !document.FileSize) {
        await transaction.rollback();
        throw new BadRequestError('Tài liệu thiếu thông tin cần thiết');
      }

      // Get system config for A3 to A4 ratio
      const configResult = await transaction
        .request()
        .query('SELECT TOP 1 A4ToA3Ratio FROM SystemConfigs ORDER BY UpdatedAt DESC');

      const a3ToA4Ratio = configResult.recordset[0]?.A4ToA3Ratio || 2.0;

      // Count pages
      let detectedPageCount: number;
      try {
        if (document.FilePath && document.FilePath.trim().length > 0 && fs.existsSync(document.FilePath)) {
          const fileExt = path.extname(document.FileName || '').toLowerCase();
          const mimeTypeMap: Record<string, string> = {
            '.pdf': 'application/pdf',
            '.doc': 'application/msword',
            '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            '.ppt': 'application/vnd.ms-powerpoint',
            '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            '.xls': 'application/vnd.ms-excel',
            '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            '.txt': 'text/plain',
          };
          const mimeType = mimeTypeMap[fileExt] || 'application/octet-stream';
          detectedPageCount = await countDocumentPages(document.FilePath, mimeType, document.FileSize);
        } else {
          // Fallback: estimate from file size
          const fileExt = path.extname(document.FileName || '').toLowerCase();
          if (fileExt === '.pdf') {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (50 * 1024)));
          } else if (['.doc', '.docx'].includes(fileExt)) {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
          } else if (['.ppt', '.pptx'].includes(fileExt)) {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (110 * 1024)));
          } else if (['.xls', '.xlsx'].includes(fileExt)) {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (50 * 1024)));
          } else if (fileExt === '.txt') {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (2 * 1024)));
          } else {
            detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (100 * 1024)));
          }
        }
      } catch (error) {
        console.error('[PrintJobService] Error counting pages:', error);
        detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (100 * 1024)));
      }

      // Calculate cost
      const totalCost = validateAndCalculateCost(
        detectedPageCount,
        copies,
        paperSize,
        side,
        pageRange,
        a3ToA4Ratio
      );

      // Check balance
      const balanceResult = await transaction
        .request()
        .input('studentId', sql.UniqueIdentifier, studentId)
        .query(`
          SELECT CurrentBalance
          FROM PageBalances
          WHERE StudentID = @studentId
        `);

      if (balanceResult.recordset.length === 0) {
        await transaction.rollback();
        throw new BadRequestError('Không tìm thấy số dư tài khoản');
      }

      const currentBalance = balanceResult.recordset[0].CurrentBalance || 0;

      if (currentBalance < totalCost) {
        await transaction.rollback();
        throw new BadRequestError(
          `Không đủ số lượng trang in. Cần: ${totalCost}, Có: ${currentBalance}`
        );
      }

      // Create print config
      const configId = crypto.randomUUID();
      // Normalize pageRange: empty string -> null
      const normalizedPageRange = pageRange?.trim() || null;
      
      await transaction
        .request()
        .input('configId', sql.UniqueIdentifier, configId)
        .input('paperSize', sql.NVarChar(10), paperSize)
        .input('copies', sql.Int, copies)
        .input('isColor', sql.Bit, false)
        .input('isDoubleSided', sql.Bit, side === 'DOUBLE_SIDED')
        .input('pageRange', sql.NVarChar(sql.MAX), normalizedPageRange)
        .input('orientation', sql.NVarChar(20), orientation)
        .query(`
          INSERT INTO PrintConfigs (ConfigID, PaperSize, Copies, IsColor, IsDoubleSided, PageRange, Orientation)
          VALUES (@configId, @paperSize, @copies, @isColor, @isDoubleSided, @pageRange, @orientation)
        `);

      // Create print job
      const jobId = crypto.randomUUID();
      await transaction
        .request()
        .input('jobId', sql.UniqueIdentifier, jobId)
        .input('studentId', sql.UniqueIdentifier, studentId)
        .input('printerId', sql.UniqueIdentifier, printerId)
        .input('documentId', sql.UniqueIdentifier, documentId)
        .input('configId', sql.UniqueIdentifier, configId)
        .input('totalPages', sql.Int, detectedPageCount)
        .input('cost', sql.Decimal(10, 2), totalCost)
        .query(`
          INSERT INTO PrintJobs (JobID, StudentID, PrinterID, DocumentID, ConfigID, TotalPages, Cost, Status)
          VALUES (@jobId, @studentId, @printerId, @documentId, @configId, @totalPages, @cost, 'PENDING')
        `);

      // Deduct balance
      await transaction
        .request()
        .input('studentId', sql.UniqueIdentifier, studentId)
        .input('pagesToDeduct', sql.Int, totalCost)
        .query(`
          UPDATE PageBalances
          SET CurrentBalance = CurrentBalance - @pagesToDeduct,
              UsedPages = UsedPages + @pagesToDeduct,
              LastUpdated = GETDATE()
          WHERE StudentID = @studentId
        `);

      await transaction.commit();

      return {
        id: jobId,
        status: 'PENDING',
        totalCost,
        message: 'Lệnh in đã được tạo thành công',
      };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof BadRequestError || error instanceof NotFoundError) {
        throw error;
      }
      throw new InternalServerError(
        `Lỗi khi tạo print job: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

