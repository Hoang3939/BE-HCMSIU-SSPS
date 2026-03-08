/**
 * Document Controller
 * Handles HTTP requests for document operations
 */

import { Request, Response, NextFunction } from 'express';
import { DocumentService } from '../services/document.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/AppError.js';
import { ApiResponse } from '../types/common.types.js';
import { validateUUID } from '../utils/validation.util.js';
import type {
  UploadDocumentResponse,
  GetDocumentResponse,
} from '../types/document.types.js';
import path from 'path';
import fs from 'fs';

export class DocumentController {
  /**
   * POST /api/documents/upload
   * Upload document
   */
  static upload = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    if (!req.file) {
      throw new BadRequestError('Không có file được upload');
    }

    const studentIdHeader = req.header('x-student-id');
    if (!studentIdHeader) {
      // Clean up uploaded file
      if (req.file.path && fs.existsSync(req.file.path)) {
        fs.unlinkSync(req.file.path);
      }
      throw new BadRequestError('Thiếu header x-student-id');
    }

    // Validate UUID
    const validatedStudentId = validateUUID(studentIdHeader, 'x-student-id');

    const result: UploadDocumentResponse = await DocumentService.uploadDocument({
      file: req.file,
      studentId: validatedStudentId,
    });

    const response: ApiResponse<UploadDocumentResponse> = {
      success: true,
      message: `Tải thành công - File có ${result.detectedPageCount} trang`,
      data: result,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(response);
  });

  /**
   * GET /api/documents/:documentId
   * Get document information
   */
  static getDocument = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { documentId } = req.params;
    const studentIdHeader = req.header('x-student-id');

    // Validate UUIDs
    const validatedDocumentId = validateUUID(documentId, 'documentId');
    const validatedStudentId = validateUUID(studentIdHeader, 'x-student-id');

    const result: GetDocumentResponse = await DocumentService.getDocument(
      validatedDocumentId,
      validatedStudentId
    );

    const response: ApiResponse<GetDocumentResponse> = {
      success: true,
      message: 'Lấy thông tin document thành công',
      data: result,
    };

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.status(200).json(response);
  });

  /**
   * GET /api/documents/:documentId/preview
   * Get document preview (PDF)
   */
  static getPreview = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const { documentId } = req.params;
    const studentIdHeader = req.header('x-student-id');

    // Validate UUIDs
    const validatedDocumentId = validateUUID(documentId, 'documentId');
    const validatedStudentId = validateUUID(studentIdHeader, 'x-student-id');

    const { filePath, fileName, isPdf } = await DocumentService.getDocumentPreviewPath({
      documentId: validatedDocumentId,
      studentId: validatedStudentId,
    });

    // Set headers
    res.setHeader('Content-Type', 'application/pdf');
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodedFileName}`);

    // Check if this is a converted PDF (temporary file)
    const isConvertedFile = !filePath.includes('uploads') && isPdf;

    // Send file
    res.sendFile(path.resolve(filePath), (err) => {
      if (err) {
        console.error('[DocumentController] Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({
            success: false,
            message: 'Lỗi khi gửi file preview',
          });
        }
      }

      // Clean up converted PDF after sending (if it's a temporary file)
      if (isConvertedFile) {
        setTimeout(() => {
          try {
            if (fs.existsSync(filePath)) {
              fs.unlinkSync(filePath);
              const pdfDir = path.dirname(filePath);
              if (fs.existsSync(pdfDir)) {
                fs.rmdirSync(pdfDir, { recursive: true });
              }
              console.log(`[DocumentController] Cleaned up temp PDF: ${filePath}`);
            }
          } catch (cleanupErr) {
            console.error('[DocumentController] Error cleaning up temp files:', cleanupErr);
          }
        }, 2000);
      }
    });
  });
}

