import { type Request, type Response } from 'express';
import { getPool } from '../config/database.js';
import { validateAndCalculateCost } from '../utils/billingCalculator.js';
import sql from 'mssql';
import crypto from 'crypto';

/**
 * @openapi
 * /api/print-jobs/create:
 *   post:
 *     summary: Tạo lệnh in với cấu hình chi tiết
 *     description: |
 *       Giai đoạn 2: Cấu hình in & thanh toán
 *       
 *       Server: http://localhost:3001
 *       
 *       Hệ thống sẽ:
 *       - Kiểm tra máy in có hoạt động không
 *       - Kiểm tra tài liệu có tồn tại không
 *       - Tính toán chi phí dựa trên các tham số
 *       - Kiểm tra số dư tài khoản
 *       - Trừ quỹ giấy nếu đủ
 *       - Tạo lệnh in
 *     tags:
 *       - Print Jobs
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - printerId
 *               - documentId
 *             properties:
 *               printerId:
 *                 type: string
 *                 description: ID của máy in đích
 *               documentId:
 *                 type: string
 *                 description: ID của tài liệu đã upload
 *               copies:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               paperSize:
 *                 type: string
 *                 enum: [A4, A3]
 *                 default: A4
 *               side:
 *                 type: string
 *                 enum: [ONE_SIDED, DOUBLE_SIDED]
 *                 default: ONE_SIDED
 *               orientation:
 *                 type: string
 *                 enum: [PORTRAIT, LANDSCAPE]
 *                 default: PORTRAIT
 *               pageRange:
 *                 type: string
 *                 nullable: true
 *                 description: 'Phạm vi trang cần in (ví dụ: \"1-5, 8\")'
 *     responses:
 *       201:
 *         description: Tạo lệnh in thành công
 *       400:
 *         description: Lỗi validation
 *       402:
 *         description: Tài khoản không đủ số lượng trang in
 *       404:
 *         description: Không tìm thấy máy in hoặc tài liệu
 *       500:
 *         description: Lỗi server
 */
export async function createPrintJob(req: Request, res: Response) {
  const {
    printerId,
    documentId,
    copies = 1,
    paperSize = 'A4',
    side = 'ONE_SIDED',
    orientation = 'PORTRAIT',
    pageRange,
  } = req.body as {
    printerId: string;
    documentId: string;
    copies?: number;
    paperSize?: 'A4' | 'A3';
    side?: 'ONE_SIDED' | 'DOUBLE_SIDED';
    orientation?: 'PORTRAIT' | 'LANDSCAPE';
    pageRange?: string;
  };

  if (!printerId || !documentId) {
    return res.status(400).json({ message: 'printerId và documentId là bắt buộc' });
  }
  if (copies <= 0) {
    return res.status(400).json({ message: 'Số bản in phải lớn hơn 0' });
  }

  const pool = getPool();
  if (!pool) {
    return res.status(500).json({ message: 'Database connection not available' });
  }

  const studentIdHeader = req.header('x-student-id');
  if (!studentIdHeader) {
    return res.status(400).json({ message: 'Thiếu header x-student-id' });
  }

  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Check printer
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
      return res.status(404).json({ message: 'Máy in không tồn tại' });
    }

    const printer = printerResult.recordset[0];
    if (!printer.IsActive || printer.Status !== 'AVAILABLE') {
      await transaction.rollback();
      return res.status(404).json({ message: 'Máy in không hoạt động' });
    }

    // Check document
    const documentResult = await transaction
      .request()
      .input('docId', sql.UniqueIdentifier, documentId)
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query(`
        SELECT d.DocID, d.FileName, d.FileSize, d.StudentID
        FROM Documents d
        INNER JOIN Students s ON d.StudentID = s.StudentID
        WHERE d.DocID = @docId AND s.StudentID = @studentId
      `);

    if (documentResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(404).json({ message: 'Tài liệu không tồn tại' });
    }

    const document = documentResult.recordset[0];

    // Get system config for A3 to A4 ratio
    const configResult = await transaction
      .request()
      .query('SELECT TOP 1 A4ToA3Ratio FROM SystemConfigs ORDER BY UpdatedAt DESC');

    const a3ToA4Ratio = configResult.recordset[0]?.A4ToA3Ratio || 2.0;

    // Lấy lại detectedPageCount từ DB (tính lại từ file path để đảm bảo chính xác)
    // Nếu không có file path hoặc không đếm được, estimate từ file size
    let detectedPageCount: number;
    try {
      const fsSync = await import('fs');
      const path = await import('path');
      const { countDocumentPages } = await import('../utils/pageCounter.js');
      
      if (document.FilePath && fsSync.existsSync(document.FilePath)) {
        // Lấy file type từ FileName
        const fileExt = path.extname(document.FileName).toLowerCase();
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
        
        console.log(`[printJob] Re-counting pages for document: ${document.FileName}`);
        detectedPageCount = await countDocumentPages(document.FilePath, mimeType, document.FileSize);
        console.log(`[printJob] Detected page count: ${detectedPageCount}`);
      } else {
        // Fallback: estimate từ file size (sử dụng logic tương tự pageCounter)
        console.warn(`[printJob] File path not found, estimating from file size: ${document.FileSize} bytes`);
        const fileExt = path.extname(document.FileName).toLowerCase();
        if (fileExt === '.pdf') {
          detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (50 * 1024)));
        } else if (['.doc', '.docx'].includes(fileExt)) {
          // Adjusted: ~30KB per page (was 25KB)
          detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
        } else if (['.ppt', '.pptx'].includes(fileExt)) {
          // Adjusted: ~110KB per slide (was 150KB)
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
      console.error('[printJob] Error counting pages:', error);
      // Fallback: estimate từ file size nếu có lỗi
      detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (100 * 1024)));
    }

    // Calculate cost
    const totalCost = validateAndCalculateCost(
      detectedPageCount,
      copies,
      paperSize,
      side,
      pageRange,
      a3ToA4Ratio,
    );

    // Check balance
    const balanceResult = await transaction
      .request()
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query(`
        SELECT CurrentBalance
        FROM PageBalances
        WHERE StudentID = @studentId
      `);

    if (balanceResult.recordset.length === 0) {
      await transaction.rollback();
      return res.status(402).json({
        message: 'Không tìm thấy số dư tài khoản',
        requiredPages: totalCost,
        availablePages: 0,
      });
    }

    const currentBalance = balanceResult.recordset[0].CurrentBalance || 0;

    if (currentBalance < totalCost) {
      await transaction.rollback();
      return res.status(402).json({
        message: 'Không đủ số lượng trang in. Vui lòng mua thêm.',
        requiredPages: totalCost,
        availablePages: currentBalance,
      });
    }

    // Create print config
    const configId = crypto.randomUUID();
    await transaction
      .request()
      .input('configId', sql.UniqueIdentifier, configId)
      .input('paperSize', sql.NVarChar, paperSize)
      .input('copies', sql.Int, copies)
      .input('isColor', sql.Bit, false) // Default to black & white
      .input('isDoubleSided', sql.Bit, side === 'DOUBLE_SIDED')
      .input('pageRange', sql.NVarChar, pageRange || null)
      .input('orientation', sql.NVarChar, orientation)
      .query(`
        INSERT INTO PrintConfigs (ConfigID, PaperSize, Copies, IsColor, IsDoubleSided, PageRange, Orientation)
        VALUES (@configId, @paperSize, @copies, @isColor, @isDoubleSided, @pageRange, @orientation)
      `);

    // Create print job
    const jobId = crypto.randomUUID();
    await transaction
      .request()
      .input('jobId', sql.UniqueIdentifier, jobId)
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
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
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .input('pagesToDeduct', sql.Int, totalCost)
      .query(`
        UPDATE PageBalances
        SET CurrentBalance = CurrentBalance - @pagesToDeduct,
            UsedPages = UsedPages + @pagesToDeduct,
            LastUpdated = GETDATE()
        WHERE StudentID = @studentId
      `);

    await transaction.commit();

    return res.status(201).json({
      message: 'Lệnh in đã được tạo thành công',
      job: {
        id: jobId,
        status: 'PENDING',
        totalCost,
      },
    });
  } catch (error) {
    await transaction.rollback();
    console.error('Error creating print job:', error);
    return res.status(400).json({
      message: error instanceof Error ? error.message : 'Lỗi khi tính toán chi phí in',
    });
  }
}

