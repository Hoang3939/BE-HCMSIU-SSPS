/**
 * Print Job Controller
 * Handles HTTP requests for print job operations
 */

import { Request, Response, NextFunction } from 'express';
import { PrintJobService } from '../services/printJob.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/AppError.js';
import { ApiResponse } from '../types/common.types.js';
import { validateUUID, validatePositiveInteger } from '../utils/validation.util.js';
import type { CreatePrintJobRequest, CreatePrintJobResponse } from '../types/printJob.types.js';

export class PrintJobController {
  /**
   * POST /api/print-jobs/create
   * Create print job
   */
  static create = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const {
      printerId,
      documentId,
      copies = 1,
      paperSize = 'A4',
      side = 'ONE_SIDED',
      orientation = 'PORTRAIT',
      pageRange,
    } = req.body as CreatePrintJobRequest;

    const studentIdHeader = req.header('x-student-id');
    if (!studentIdHeader) {
      throw new BadRequestError('Thiếu header x-student-id');
    }

    // Validate UUIDs
    const validatedPrinterId = validateUUID(printerId, 'printerId');
    const validatedDocumentId = validateUUID(documentId, 'documentId');
    const validatedStudentId = validateUUID(studentIdHeader, 'x-student-id');
    const validatedCopies = validatePositiveInteger(copies, 'copies', 1);

    // Validate enum values
    if (paperSize && !['A4', 'A3'].includes(paperSize)) {
      throw new BadRequestError('paperSize phải là A4 hoặc A3');
    }
    if (side && !['ONE_SIDED', 'DOUBLE_SIDED'].includes(side)) {
      throw new BadRequestError('side phải là ONE_SIDED hoặc DOUBLE_SIDED');
    }
    if (orientation && !['PORTRAIT', 'LANDSCAPE'].includes(orientation)) {
      throw new BadRequestError('orientation phải là PORTRAIT hoặc LANDSCAPE');
    }

    const request: CreatePrintJobRequest = {
      printerId: validatedPrinterId,
      documentId: validatedDocumentId,
      copies: validatedCopies,
      paperSize: (paperSize as 'A4' | 'A3') || 'A4',
      side: (side as 'ONE_SIDED' | 'DOUBLE_SIDED') || 'ONE_SIDED',
      orientation: (orientation as 'PORTRAIT' | 'LANDSCAPE') || 'PORTRAIT',
      pageRange: pageRange?.trim() || undefined,
      studentId: validatedStudentId,
    };

    const result: CreatePrintJobResponse = await PrintJobService.createPrintJob(request);

    const response: ApiResponse<CreatePrintJobResponse> = {
      success: true,
      message: result.message,
      data: result,
    };

    res.status(201).json(response);
  });
}

