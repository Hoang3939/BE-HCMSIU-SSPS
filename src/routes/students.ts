import { type Request, type Response } from 'express';
import { getPool } from '../config/database.js';
import sql from 'mssql';

/**
 * @openapi
 * /api/student/balance:
 *   get:
 *     summary: Lấy số dư trang của sinh viên
 *     description: |
 *       Server: http://localhost:3001
 *       
 *       Trả về số trang A4 còn lại trong tài khoản của sinh viên
 *     tags:
 *       - Students
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: Số dư trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balancePages:
 *                   type: number
 *                   description: Số trang A4 còn lại
 *       404:
 *         description: Không tìm thấy số dư
 */
export async function getUserBalance(req: Request, res: Response) {
  try {
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
      .input('studentId', sql.UniqueIdentifier, studentIdHeader)
      .query(`
        SELECT CurrentBalance as balancePages
        FROM PageBalances
        WHERE StudentID = @studentId
      `);

    if (result.recordset.length === 0) {
      return res.status(404).json({ message: 'Không tìm thấy số dư tài khoản' });
    }

    return res.json({
      balancePages: result.recordset[0].balancePages || 0,
    });
  } catch (error) {
    console.error('Error getting user balance:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy số dư' });
  }
}

