import { type Request, type Response } from 'express';
import { upload, MAX_FILE_SIZE } from '../utils/fileUpload.js';
import { countDocumentPages } from '../utils/pageCounter.js';
import { getPool } from '../config/database.js';
import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';

// Middleware Multer cho upload
export const uploadMiddleware = upload;

/**
 * @openapi
 * /api/documents/upload:
 *   post:
 *     summary: Upload tài liệu lên hệ thống
 *     description: |
 *       Giai đoạn 1: Tải lên và kiểm tra tài liệu
 *       
 *       Server: http://localhost:3001
 *       
 *       Hệ thống sẽ:
 *       - Kiểm tra định dạng file (chỉ chấp nhận PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)
 *       - Kiểm tra dung lượng (tối đa 100MB)
 *       - Lưu file vào storage
 *       - Đếm số trang tự động
 *       - Trả về thông tin tài liệu
 *     tags:
 *       - Documents
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File tài liệu cần upload (PDF, DOCX, PPTX, XLS, XLSX, TXT)
 *     responses:
 *       200:
 *         description: Tải lên thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Tải thành công - File có 15 trang
 *                 document:
 *                   type: object
 *                   properties:
 *                     id: { type: 'string' }
 *                     originalFileName: { type: 'string' }
 *                     detectedPageCount: { type: 'number' }
 *                     fileSize: { type: 'number' }
 *                     uploadedAt: { type: 'string', format: 'date-time' }
 *       400:
 *         description: Không có file được upload
 *       413:
 *         description: File quá lớn
 *       415:
 *         description: Định dạng file không được hỗ trợ
 *       500:
 *         description: Lỗi server khi xử lý file
 */
export async function uploadDocument(req: Request, res: Response) {
  try {
    console.log('[upload] Request received');
    console.log('[upload] Headers:', req.headers);

    if (!req.file) {
      console.log('[upload] No file in request');
      return res.status(400).json({
        message: 'Không có file được upload',
        code: 'NO_FILE',
      });
    }

    const file = req.file;
    console.log('[upload] File received:', {
      originalname: file.originalname,
      mimetype: file.mimetype,
      size: file.size,
      path: file.path,
    });

    // Lấy StudentID từ header (demo, không dùng login)
    const studentIdHeader = req.header('x-student-id');
    console.log('[upload] Student ID header:', studentIdHeader);

    if (!studentIdHeader) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(400).json({ message: 'Thiếu header x-student-id' });
    }

    // Business Rule: Validate file size
    if (file.size > MAX_FILE_SIZE) {
      fs.unlinkSync(file.path);
      return res.status(413).json({
        message: `File quá lớn. Dung lượng tối đa là ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE,
      });
    }

    // Business Rule: Đếm số trang
    let detectedPageCount: number;
    try {
      detectedPageCount = await countDocumentPages(file.path, file.mimetype, file.size);
    } catch (error) {
      fs.unlinkSync(file.path);
      return res.status(500).json({
        message: 'Không thể xử lý file để đếm số trang',
        code: 'PROCESSING_ERROR',
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    }

    // Kiểm tra student có tồn tại
    const pool = getPool();
    if (!pool) {
      console.error('[upload] Database pool not available');
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(500).json({ message: 'Database connection not available' });
    }

    console.log('[upload] Checking student exists:', studentIdHeader);
    const studentResult = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query('SELECT StudentID FROM Students WHERE StudentID = @studentId');

    if (studentResult.recordset.length === 0) {
      console.error('[upload] Student not found:', studentIdHeader);
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      return res.status(403).json({ message: 'Chỉ sinh viên mới được upload tài liệu' });
    }

    console.log('[upload] Student verified');

    const studentId = studentResult.recordset[0].StudentID;

    // Business Rule: Lưu vào database
    const docId = crypto.randomUUID();
    // Decode filename để xử lý tiếng Việt có dấu
    // Multer có thể nhận filename đã được encode, cần decode đúng cách
    let originalFileName = file.originalname;
    try {
      // Thử decode URI component (nếu được encode)
      if (file.originalname.includes('%')) {
        originalFileName = decodeURIComponent(file.originalname);
      } else {
        // Nếu không có %, có thể là UTF-8 string bị encode sai
        // Thử decode từ Buffer nếu cần
        originalFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      }
    } catch (e) {
      // Nếu decode thất bại, giữ nguyên và log warning
      console.warn('[upload] Failed to decode filename, using original:', file.originalname);
      originalFileName = file.originalname;
    }
    const fileType = path.extname(originalFileName).substring(1).toLowerCase();

    await pool
      .request()
      .input('docId', sql.UniqueIdentifier, docId)
      .input('fileName', sql.NVarChar, originalFileName)
      .input('fileType', sql.NVarChar, fileType)
      .input('fileSize', sql.BigInt, file.size)
      .input('filePath', sql.NVarChar, file.path)
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query(`
        INSERT INTO Documents (DocID, FileName, FileType, FileSize, FilePath, StudentID)
        VALUES (@docId, @fileName, @fileType, @fileSize, @filePath, @studentId)
      `);

    // Đảm bảo response có charset UTF-8 để hiển thị đúng tiếng Việt
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Encoding', 'utf-8');

    return res.status(200).json({
      message: `Tải thành công - File có ${detectedPageCount} trang`,
      document: {
        id: docId,
        originalFileName: originalFileName, // Đã được decode ở trên
        detectedPageCount,
        fileSize: file.size,
        uploadedAt: new Date().toISOString(),
      },
    });
  } catch (error) {
    if (req.file?.path && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    if (error instanceof Error && error.message.includes('File too large')) {
      return res.status(413).json({
        message: `File quá lớn. Dung lượng tối đa là ${MAX_FILE_SIZE / 1024 / 1024}MB`,
        code: 'FILE_TOO_LARGE',
        maxSize: MAX_FILE_SIZE,
      });
    }
    if (error instanceof Error && error.message.includes('Định dạng file không được hỗ trợ')) {
      return res.status(415).json({
        message: error.message,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
    console.error('[upload] Error uploading document:', error);
    console.error('[upload] Error stack:', error instanceof Error ? error.stack : 'No stack');
    return res.status(500).json({
      message: 'Lỗi server khi upload tài liệu',
      code: 'SERVER_ERROR',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @openapi
 * /api/documents/{documentId}:
 *   get:
 *     summary: Lấy thông tin tài liệu đã upload
 *     description: |
 *       Server: http://localhost:3001
 *       
 *       Lấy thông tin chi tiết của tài liệu đã upload
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: documentId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của tài liệu
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: Thông tin tài liệu
 *       404:
 *         description: Không tìm thấy tài liệu
 */
/**
 * @openapi
 * /api/documents/{documentId}/preview:
 *   get:
 *     summary: Lấy file document để preview
 *     description: Trả về file document (PDF hoặc convert sang PDF) để preview
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của document
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: File document để preview
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Không tìm thấy document
 *       500:
 *         description: Lỗi server
 */
export async function getDocumentPreview(req: Request, res: Response) {
  try {
    const { documentId } = req.params;
    const studentIdHeader = req.header('x-student-id');

    if (!studentIdHeader) {
      return res.status(400).json({ message: 'Thiếu header x-student-id' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(500).json({ message: 'Database connection not available' });
    }

    // Get document info
    const result = await pool
      .request()
      .input('docId', sql.UniqueIdentifier, documentId)
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query(`
        SELECT d.*
        FROM Documents d
        INNER JOIN Students s ON d.StudentID = s.StudentID
        WHERE d.DocID = @docId AND s.StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
    }

    const document = result.recordset[0];
    const filePath = document.FilePath;
    const fileExt = path.extname(document.FileName).toLowerCase();

    console.log(`[preview] Request for document: ${document.FileName}, path: ${filePath}, ext: ${fileExt}`);

    // Check if file exists
    if (!fs.existsSync(filePath)) {
      console.error(`[preview] File not found: ${filePath}`);
      return res.status(404).json({ message: 'File không tồn tại' });
    }

    // If PDF, serve directly
    if (fileExt === '.pdf') {
      console.log(`[preview] Serving PDF directly: ${filePath}`);
      res.setHeader('Content-Type', 'application/pdf');
      // Encode filename to handle special characters (Vietnamese, etc.)
      const encodedFileName = encodeURIComponent(document.FileName);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);
      return res.sendFile(path.resolve(filePath));
    }

    // For other formats, convert to PDF first using LibreOffice
    console.log(`[preview] Converting ${fileExt} file to PDF: ${filePath}`);
    try {
      const { convertToPdfWithLibreOffice } = await import('../utils/pageCounter.js');

      let convertedPdfPath: string | null = null;
      try {
        convertedPdfPath = await convertToPdfWithLibreOffice(filePath);
      } catch (convertError) {
        console.error('[preview] LibreOffice conversion error:', convertError);
        // Check if error is about LibreOffice not found
        if (convertError instanceof Error && convertError.message.includes('LibreOffice không được cài đặt')) {
          return res.status(503).json({
            message: 'LibreOffice chưa được cài đặt. Vui lòng cài LibreOffice để xem preview file Word/PPT.',
            error: 'LibreOffice not installed',
            suggestion: 'Cài đặt LibreOffice từ https://www.libreoffice.org/'
          });
        }
        // Re-throw other errors
        throw convertError;
      }

      if (!convertedPdfPath) {
        console.error('[preview] convertToPdfWithLibreOffice returned null');
        return res.status(500).json({
          message: 'LibreOffice không thể convert file sang PDF. Vui lòng kiểm tra file có hợp lệ không.',
          error: 'Conversion returned null'
        });
      }

      if (!fs.existsSync(convertedPdfPath)) {
        console.error('[preview] Converted PDF file does not exist:', convertedPdfPath);
        return res.status(500).json({
          message: 'File PDF sau khi convert không tồn tại.',
          error: 'Converted file not found',
          path: convertedPdfPath
        });
      }

      console.log(`[preview] Successfully converted to PDF: ${convertedPdfPath}`);
      res.setHeader('Content-Type', 'application/pdf');
      // Encode filename to handle special characters (Vietnamese, etc.)
      const pdfFileName = `${path.basename(document.FileName, fileExt)}.pdf`;
      const encodedFileName = encodeURIComponent(pdfFileName);
      res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);

      // Read file and send it, then clean up
      const pdfBuffer = fs.readFileSync(convertedPdfPath);
      const pdfDir = path.dirname(convertedPdfPath);

      res.send(pdfBuffer);

      // Clean up after a delay to ensure file is sent
      setTimeout(() => {
        try {
          if (fs.existsSync(convertedPdfPath!)) {
            fs.unlinkSync(convertedPdfPath!);
            console.log(`[preview] Cleaned up temp PDF: ${convertedPdfPath}`);
          }
          if (fs.existsSync(pdfDir)) {
            fs.rmdirSync(pdfDir, { recursive: true });
            console.log(`[preview] Cleaned up temp directory: ${pdfDir}`);
          }
        } catch (cleanupErr) {
          console.error('[preview] Error cleaning up temp files:', cleanupErr);
        }
      }, 2000);
    } catch (error) {
      console.error('[preview] Error converting to PDF:', error);
      console.error('[preview] Error type:', error?.constructor?.name);
      console.error('[preview] Error stack:', error instanceof Error ? error.stack : 'No stack');

      // Provide more specific error messages
      let errorMessage = 'Không thể convert file sang PDF để preview';
      let statusCode = 500;

      if (error instanceof Error) {
        if (error.message.includes('LibreOffice không được cài đặt')) {
          errorMessage = 'LibreOffice chưa được cài đặt. Vui lòng cài LibreOffice để xem preview file Word/PPT.';
          statusCode = 503;
        } else if (error.message.includes('timeout')) {
          errorMessage = 'Quá trình convert mất quá nhiều thời gian. Vui lòng thử lại hoặc kiểm tra file có quá lớn không.';
        } else if (error.message.includes('exit code 1') || error.message.includes('exit code')) {
          errorMessage = 'LibreOffice không thể convert file này. Có thể file Word bị lỗi, bị mã hóa, hoặc có vấn đề về định dạng. Vui lòng thử file khác hoặc kiểm tra file có mở được trong Word không.';
        } else if (error.message.includes('Không tìm thấy file PDF')) {
          errorMessage = 'LibreOffice không tạo được file PDF sau khi convert. Vui lòng kiểm tra file có hợp lệ không.';
        } else {
          errorMessage = error.message;
        }
      }

      return res.status(statusCode).json({
        message: errorMessage,
        error: error instanceof Error ? error.message : 'Unknown error',
        details: error instanceof Error && error.message.includes('exit code') ? 'LibreOffice conversion failed. Please check if the Word file is valid and not corrupted.' : undefined
      });
    }
  } catch (error) {
    console.error('[preview] Error:', error);
    return res.status(500).json({
      message: 'Lỗi server khi lấy preview',
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
}

export async function getDocument(req: Request, res: Response) {
  try {
    const { documentId } = req.params;

    const studentIdHeader = req.header('x-student-id');
    if (!studentIdHeader) {
      return res.status(400).json({ message: 'Thiếu header x-student-id' });
    }

    const pool = getPool();
    if (!pool) {
      return res.status(500).json({ message: 'Database connection not available' });
    }

    const result = await pool
      .request()
      .input('docId', sql.UniqueIdentifier, documentId)
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query(`
        SELECT d.*
        FROM Documents d
        INNER JOIN Students s ON d.StudentID = s.StudentID
        WHERE d.DocID = @docId AND s.StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy tài liệu' });
    }

    const document = result.recordset[0];

    // Re-count pages to get accurate count (using LibreOffice if available)
    let detectedPageCount: number;
    try {
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

      if (document.FilePath && fs.existsSync(document.FilePath)) {
        detectedPageCount = await countDocumentPages(document.FilePath, mimeType, document.FileSize);
        console.log(`[getDocument] Re-counted pages for ${document.FileName}: ${detectedPageCount}`);
      } else {
        // Fallback: estimate from file size
        detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
      }
    } catch (error) {
      console.error('[getDocument] Error counting pages:', error);
      // Fallback: estimate from file size
      detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
    }

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    return res.json({
      ...document,
      detectedPageCount, // Add accurate page count
    });
  } catch (error) {
    console.error('Error getting document:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy thông tin tài liệu' });
  }
}

