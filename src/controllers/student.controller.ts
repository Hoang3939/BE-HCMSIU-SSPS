/**
 * Student Controller
 * Handles HTTP requests for student operations
 */

import { Request, Response, NextFunction } from 'express';
import { StudentService } from '../services/student.service.js';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { BadRequestError } from '../errors/AppError.js';
import { ApiResponse } from '../types/common.types.js';
import { validateUUID } from '../utils/validation.util.js';
import type { StudentBalance } from '../types/student.types.js';

export class StudentController {
  /**
   * GET /api/student/balance
   * Get student balance
   */
  static getBalance = asyncHandler(async (req: Request, res: Response, next: NextFunction) => {
    const studentIdHeader = req.header('x-student-id');
    if (!studentIdHeader) {
      throw new BadRequestError('Thiếu header x-student-id');
    }

    // Validate UUID
    const validatedStudentId = validateUUID(studentIdHeader, 'x-student-id');

    const result: StudentBalance = await StudentService.getBalance({
      studentId: validatedStudentId,
    });

    const response: ApiResponse<StudentBalance> = {
      success: true,
      message: 'Lấy số dư thành công',
      data: result,
    };

    res.status(200).json(response);
  });
}

