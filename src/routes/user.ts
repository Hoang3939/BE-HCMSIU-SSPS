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
 *       Nếu người dùng không có bản ghi trong PageBalances (ví dụ Admin), balancePages sẽ trả về 0.
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
 *                         description: ID của người dùng (UserID)
 *                         example: 1
 *                       username:
 *                         type: string
 *                         description: Tên đăng nhập
 *                         example: "user001"
 *                       email:
 *                         type: string
 *                         description: Email của người dùng
 *                         example: "user001@example.com"
 *                       role:
 *                         type: string
 *                         description: Vai trò của người dùng
 *                         example: "Student"
 *                       isActive:
 *                         type: boolean
 *                         description: Trạng thái hoạt động của tài khoản
 *                         example: true
 *                       balancePages:
 *                         type: integer
 *                         description: Số trang hiện có của người dùng (CurrentBalance). Trả về 0 nếu NULL.
 *                         example: 100
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
    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available',
      });
    }

    // Query để lấy danh sách user với LEFT JOIN PageBalances
    // LEFT JOIN để lấy cả user không có balance (ví dụ Admin)
    // ISNULL để trả về 0 nếu CurrentBalance là NULL
    const result = await pool
      .request()
      .query(`
        SELECT 
          u.UserID AS id,
          u.Username AS username,
          u.Email AS email,
          u.Role AS role,
          u.IsActive AS isActive,
          ISNULL(pb.CurrentBalance, 0) AS balancePages
        FROM Users u
        LEFT JOIN PageBalances pb ON u.UserID = pb.StudentID
        ORDER BY u.UserID ASC
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

