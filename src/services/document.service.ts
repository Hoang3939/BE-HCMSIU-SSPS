/**
 * Document Service
 * Business logic cho module Documents
 */

import { getPool } from '../config/database.js';
import sql from 'mssql';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import { countDocumentPages, convertToPdfWithLibreOffice } from '../utils/pageCounter.js';
import { MAX_FILE_SIZE } from '../utils/fileUpload.js';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  InternalServerError,
} from '../errors/AppError.js';
import type {
  Document,
  UploadDocumentRequest,
  UploadDocumentResponse,
  GetDocumentResponse,
  DocumentPreviewOptions,
} from '../types/document.types.js';

export class DocumentService {
  /**
   * Upload document và lưu vào database
   * @param request - File và studentId
   * @returns Thông tin document đã upload
   */
  static async uploadDocument(request: UploadDocumentRequest): Promise<UploadDocumentResponse> {
    const { file, studentId } = request;

    // Validate file
    if (!file) {
      throw new BadRequestError('Không có file được upload');
    }

    // Validate studentId is valid UUID (already validated in controller, but double-check)
    if (!studentId || studentId.trim().length === 0) {
      throw new BadRequestError('StudentId không hợp lệ');
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      // Clean up uploaded file
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new BadRequestError(
        `File quá lớn. Dung lượng tối đa là ${MAX_FILE_SIZE / 1024 / 1024}MB`
      );
    }

    // Count pages
    let detectedPageCount: number;
    try {
      detectedPageCount = await countDocumentPages(file.path, file.mimetype, file.size);
    } catch (error) {
      // Clean up uploaded file
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new InternalServerError(
        `Không thể xử lý file để đếm số trang: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }

    // Verify student exists
    const pool = await getPool();
    if (!pool) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new InternalServerError('Database connection not available');
    }

    const studentResult = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query('SELECT StudentID FROM Students WHERE StudentID = @studentId');

    if (studentResult.recordset.length === 0) {
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new ForbiddenError('Chỉ sinh viên mới được upload tài liệu');
    }

    // Validate file path exists
    if (!file.path) {
      throw new InternalServerError('File path không tồn tại');
    }

    // Decode filename để xử lý tiếng Việt có dấu
    let originalFileName = file.originalname || 'untitled';
    try {
      if (file.originalname && file.originalname.includes('%')) {
        originalFileName = decodeURIComponent(file.originalname);
      } else if (file.originalname) {
        originalFileName = Buffer.from(file.originalname, 'latin1').toString('utf8');
      }
    } catch (e) {
      console.warn('[DocumentService] Failed to decode filename, using original:', file.originalname);
      originalFileName = file.originalname || 'untitled';
    }

    // Validate file name is not empty and not too long
    if (!originalFileName || originalFileName.trim().length === 0) {
      originalFileName = 'untitled';
    }
    if (originalFileName.length > 255) {
      originalFileName = originalFileName.substring(0, 255);
    }

    const fileType = path.extname(originalFileName).substring(1).toLowerCase() || 'unknown';
    const docId = crypto.randomUUID();

    // Save to database
    try {
      await pool
        .request()
        .input('docId', sql.UniqueIdentifier, docId)
        .input('fileName', sql.NVarChar(sql.MAX), originalFileName)
        .input('fileType', sql.NVarChar(50), fileType)
        .input('fileSize', sql.BigInt, file.size)
        .input('filePath', sql.NVarChar(sql.MAX), file.path)
        .input('studentId', sql.UniqueIdentifier, studentId)
        .query(`
          INSERT INTO Documents (DocID, FileName, FileType, FileSize, FilePath, StudentID, CreatedAt)
          VALUES (@docId, @fileName, @fileType, @fileSize, @filePath, @studentId, GETDATE())
        `);
    } catch (error) {
      // Clean up uploaded file if database insert fails
      if (file.path && fs.existsSync(file.path)) {
        fs.unlinkSync(file.path);
      }
      throw new InternalServerError('Lỗi khi lưu thông tin document vào database');
    }

    return {
      id: docId,
      originalFileName,
      detectedPageCount,
      fileSize: file.size,
      uploadedAt: new Date().toISOString(),
    };
  }

  /**
   * Lấy thông tin document theo ID
   * @param documentId - ID của document
   * @param studentId - ID của student (để verify ownership)
   * @returns Thông tin document
   */
  static async getDocument(documentId: string, studentId: string): Promise<GetDocumentResponse> {
    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    const result = await pool
      .request()
      .input('docId', sql.UniqueIdentifier, documentId)
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query(`
        SELECT d.*
        FROM Documents d
        INNER JOIN Students s ON d.StudentID = s.StudentID
        WHERE d.DocID = @docId AND s.StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundError('Không tìm thấy tài liệu');
    }

    const document = result.recordset[0] as Document;

    // Re-count pages to get accurate count
    let detectedPageCount: number;
    try {
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

      if (document.FilePath && fs.existsSync(document.FilePath)) {
        detectedPageCount = await countDocumentPages(
          document.FilePath,
          mimeType,
          document.FileSize
        );
      } else {
        // Fallback: estimate from file size
        detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
      }
    } catch (error) {
      console.error('[DocumentService] Error counting pages:', error);
      // Fallback: estimate from file size
      detectedPageCount = Math.max(1, Math.ceil(document.FileSize / (30 * 1024)));
    }

    return {
      ...document,
      detectedPageCount,
    };
  }

  /**
   * Lấy file path để preview document
   * @param options - DocumentId và StudentId
   * @returns File path và metadata
   */
  static async getDocumentPreviewPath(
    options: DocumentPreviewOptions
  ): Promise<{ filePath: string; fileName: string; isPdf: boolean }> {
    const { documentId, studentId } = options;

    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    const result = await pool
      .request()
      .input('docId', sql.UniqueIdentifier, documentId)
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query(`
        SELECT d.*
        FROM Documents d
        INNER JOIN Students s ON d.StudentID = s.StudentID
        WHERE d.DocID = @docId AND s.StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundError('Không tìm thấy tài liệu');
    }

    const document = result.recordset[0] as Document;
    const filePath = document.FilePath;

    // Validate file path
    if (!filePath || filePath.trim().length === 0) {
      throw new NotFoundError('File path không hợp lệ');
    }

    if (!fs.existsSync(filePath)) {
      throw new NotFoundError('File không tồn tại');
    }

    const fileExt = path.extname(document.FileName || '').toLowerCase();

    // If PDF, return directly
    if (fileExt === '.pdf') {
      return {
        filePath: path.resolve(filePath),
        fileName: document.FileName,
        isPdf: true,
      };
    }

    // For other formats, convert to PDF
    try {
      const convertedPdfPath = await convertToPdfWithLibreOffice(filePath);
      if (!convertedPdfPath || !fs.existsSync(convertedPdfPath)) {
        throw new InternalServerError('LibreOffice không tạo được file PDF sau khi convert');
      }

      return {
        filePath: convertedPdfPath,
        fileName: `${path.basename(document.FileName, fileExt)}.pdf`,
        isPdf: true,
      };
    } catch (error) {
      if (error instanceof Error && error.message.includes('LibreOffice không được cài đặt')) {
        throw new InternalServerError(
          'LibreOffice chưa được cài đặt. Vui lòng cài LibreOffice để xem preview file Word/PPT.'
        );
      }
      throw new InternalServerError(
        `Không thể convert file sang PDF: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  }
}

