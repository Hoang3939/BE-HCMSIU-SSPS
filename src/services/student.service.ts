/**
 * Student Service
 * Business logic cho module Students
 */

import { getPool } from '../config/database.js';
import sql from 'mssql';
import { NotFoundError, InternalServerError } from '../errors/AppError.js';
import type { StudentBalance, StudentBalanceRequest } from '../types/student.types.js';

export class StudentService {
  /**
   * Lấy số dư trang của student
   * @param request - StudentId
   * @returns Số dư trang
   */
  static async getBalance(request: StudentBalanceRequest): Promise<StudentBalance> {
    const { studentId } = request;

    const pool = await getPool();
    if (!pool) {
      throw new InternalServerError('Database connection not available');
    }

    const result = await pool
      .request()
      .input('studentId', sql.UniqueIdentifier, studentId)
      .query(`
        SELECT CurrentBalance as balancePages
        FROM PageBalances
        WHERE StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      throw new NotFoundError('Không tìm thấy số dư tài khoản');
    }

    return {
      balancePages: result.recordset[0].balancePages || 0,
    };
  }
}

