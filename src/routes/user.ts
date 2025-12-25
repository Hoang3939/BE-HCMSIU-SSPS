import { Router, type Request, type Response } from 'express';
import { getPool } from '../config/database.js';
import sql from 'mssql';

const router = Router();

// TODO: Import và sử dụng middleware xác thực khi có
// import { authRequired } from '../middleware/auth.js';
// const authMiddleware = authRequired;

/**
 * @openapi
 * /admin/users:
 *   get:
 *     tags:
 *       - Admin - User Management
 *     summary: Lấy danh sách tất cả người dùng
 *     description: |
 *       API này trả về danh sách tất cả người dùng trong hệ thống.
 *       Mỗi người dùng có thông tin về số trang hiện có (balancePages).
 *       Mật khẩu sẽ được ẩn khỏi kết quả trả về.
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách người dùng được trả về thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       id:
 *                         type: integer
 *                         description: ID của người dùng
 *                         example: 1
 *                       username:
 *                         type: string
 *                         description: Tên đăng nhập
 *                         example: "user001"
 *                       email:
 *                         type: string
 *                         description: Email của người dùng
 *                         example: "user001@example.com"
 *                       fullName:
 *                         type: string
 *                         description: Họ và tên đầy đủ
 *                         example: "Nguyễn Văn A"
 *                       balancePages:
 *                         type: integer
 *                         description: Số trang hiện có của người dùng
 *                         example: 100
 *                       createdAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian tạo tài khoản
 *                         example: "2024-01-01T00:00:00.000Z"
 *                       updatedAt:
 *                         type: string
 *                         format: date-time
 *                         description: Thời gian cập nhật cuối cùng
 *                         example: "2024-01-01T00:00:00.000Z"
 *       401:
 *         description: Không có quyền truy cập (chưa xác thực)
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Unauthorized"
 *       500:
 *         description: Lỗi server khi truy vấn database
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: false
 *                 message:
 *                   type: string
 *                   example: "Internal server error"
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available',
      });
    }

    // Query để lấy danh sách user, loại bỏ password
    // Giả sử bảng users có các cột: id, username, email, password, fullName, balancePages, createdAt, updatedAt
    const result = await pool
      .request()
      .query(`
        SELECT 
          id,
          username,
          email,
          fullName,
          balancePages,
          createdAt,
          updatedAt
        FROM users
        ORDER BY id ASC
      `);

    return res.status(200).json({
      success: true,
      data: result.recordset,
    });
  } catch (error) {
    console.error('[user-router]: Error fetching users:', error);
    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;

