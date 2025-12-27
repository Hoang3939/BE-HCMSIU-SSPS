import { Router, type Request, type Response } from 'express';
import { getPool } from '../config/database.js';
import sql from 'mssql';
import { randomUUID } from 'crypto';
import { hashPassword } from '../utils/bcrypt.util.js';
import { UserModel } from '../models/User.model.js';
import { BadRequestError, NotFoundError, ConflictError } from '../errors/AppError.js';
import { validateUUID } from '../utils/validation.util.js';

const router = Router();

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
 *                         type: string
 *                         description: ID của người dùng (UserID - UUID)
 *                         example: "550e8400-e29b-41d4-a716-446655440000"
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
 *                         example: "STUDENT"
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
 *       500:
 *         description: Lỗi server khi truy vấn database
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

/**
 * @openapi
 * /admin/users:
 *   post:
 *     tags:
 *       - Admin - User Management
 *     summary: Tạo người dùng mới (Cấp tài khoản)
 *     description: |
 *       API này cho phép admin tạo tài khoản mới cho người dùng.
 *       Mật khẩu sẽ được mã hóa bằng bcrypt trước khi lưu vào database.
 *       Yêu cầu: username và email phải unique, password tối thiểu 6 ký tự.
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - username
 *               - email
 *               - password
 *               - role
 *             properties:
 *               username:
 *                 type: string
 *                 description: Tên đăng nhập (phải unique)
 *                 example: "student001"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email của người dùng (phải unique)
 *                 example: "student001@example.com"
 *               password:
 *                 type: string
 *                 description: Mật khẩu (tối thiểu 6 ký tự)
 *                 example: "password123"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, STUDENT, SPSO]
 *                 description: Vai trò của người dùng
 *                 example: "STUDENT"
 *     responses:
 *       201:
 *         description: Tạo người dùng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User created successfully"
 *                 data:
 *                   type: object
 *                   properties:
 *                     id:
 *                       type: string
 *                       example: "550e8400-e29b-41d4-a716-446655440000"
 *                     username:
 *                       type: string
 *                       example: "student001"
 *                     email:
 *                       type: string
 *                       example: "student001@example.com"
 *                     role:
 *                       type: string
 *                       example: "STUDENT"
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       409:
 *         description: Username hoặc email đã tồn tại
 *       500:
 *         description: Lỗi server
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { username, email, password, role } = req.body;

    // Validate input
    if (!username || typeof username !== 'string' || username.trim().length === 0) {
      throw new BadRequestError('Username là bắt buộc và không được rỗng');
    }

    if (!email || typeof email !== 'string' || email.trim().length === 0) {
      throw new BadRequestError('Email là bắt buộc và không được rỗng');
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email.trim())) {
      throw new BadRequestError('Email không đúng định dạng');
    }

    if (!password || typeof password !== 'string' || password.length < 6) {
      throw new BadRequestError('Password là bắt buộc và phải có ít nhất 6 ký tự');
    }

    if (!role || typeof role !== 'string' || !['ADMIN', 'STUDENT', 'SPSO'].includes(role.toUpperCase())) {
      throw new BadRequestError('Role là bắt buộc và phải là một trong: ADMIN, STUDENT, SPSO');
    }

    const normalizedUsername = username.trim();
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedRole = role.toUpperCase();

    // Check if username already exists
    const existingUserByUsername = await UserModel.findByUsername(normalizedUsername);
    if (existingUserByUsername) {
      throw new ConflictError('Username đã tồn tại');
    }

    // Check if email already exists
    const existingUserByEmail = await UserModel.findByEmail(normalizedEmail);
    if (existingUserByEmail) {
      throw new ConflictError('Email đã tồn tại');
    }

    // Hash password using bcrypt (hàm của nhóm trưởng)
    const hashedPassword = await hashPassword(password);

    // Generate UUID for new user
    const userID = sql.UniqueIdentifier();

    // Insert user into database
    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available',
      });
    }

    const request = pool.request();
    request.input('UserID', sql.UniqueIdentifier, userID);
    request.input('Username', sql.NVarChar(100), normalizedUsername);
    request.input('Email', sql.NVarChar(255), normalizedEmail);
    request.input('Role', sql.NVarChar(50), normalizedRole);
    request.input('PasswordHash', sql.NVarChar(255), hashedPassword);
    request.input('IsActive', sql.Bit, true);

    await request.query(`
      INSERT INTO Users (UserID, Username, Email, Role, PasswordHash, IsActive, CreatedAt)
      VALUES (@UserID, @Username, @Email, @Role, @PasswordHash, @IsActive, GETDATE())
    `);

    // Get created user (without password)
    const result = await pool
      .request()
      .input('UserID', sql.UniqueIdentifier, userID)
      .query(`
        SELECT 
          UserID AS id,
          Username AS username,
          Email AS email,
          Role AS role,
          IsActive AS isActive,
          CreatedAt AS createdAt
        FROM Users
        WHERE UserID = @UserID
      `);

    return res.status(201).json({
      success: true,
      message: 'User created successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('[user-router]: Error creating user:', error);
    
    if (error instanceof BadRequestError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /admin/users/{id}:
 *   put:
 *     tags:
 *       - Admin - User Management
 *     summary: Cập nhật thông tin người dùng
 *     description: |
 *       API này cho phép admin cập nhật thông tin người dùng.
 *       Có thể cập nhật username, email, role, password, và isActive.
 *       Nếu cập nhật password, mật khẩu mới sẽ được mã hóa bằng bcrypt.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UserID của người dùng cần cập nhật
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *                 description: Tên đăng nhập mới (phải unique nếu thay đổi)
 *                 example: "student001_updated"
 *               email:
 *                 type: string
 *                 format: email
 *                 description: Email mới (phải unique nếu thay đổi)
 *                 example: "student001_updated@example.com"
 *               password:
 *                 type: string
 *                 description: Mật khẩu mới (tối thiểu 6 ký tự, chỉ cập nhật nếu có)
 *                 example: "newpassword123"
 *               role:
 *                 type: string
 *                 enum: [ADMIN, STUDENT, SPSO]
 *                 description: Vai trò mới
 *                 example: "STUDENT"
 *               isActive:
 *                 type: boolean
 *                 description: Trạng thái hoạt động
 *                 example: true
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       404:
 *         description: Không tìm thấy người dùng
 *       409:
 *         description: Username hoặc email đã tồn tại
 *       500:
 *         description: Lỗi server
 */
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userID = validateUUID(req.params.id, 'UserID');

    const { username, email, password, role, isActive } = req.body;

    // Check if user exists
    const existingUser = await UserModel.findByUserID(userID);
    if (!existingUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available',
      });
    }

    const request = pool.request();
    request.input('UserID', sql.UniqueIdentifier, userID);

    // Build update query dynamically based on provided fields
    const updateFields: string[] = [];
    const updateValues: any[] = [];

    // Update username if provided
    if (username !== undefined) {
      if (typeof username !== 'string' || username.trim().length === 0) {
        throw new BadRequestError('Username không được rỗng');
      }
      const normalizedUsername = username.trim();
      
      // Check if username is already taken by another user
      const userWithSameUsername = await UserModel.findByUsername(normalizedUsername);
      if (userWithSameUsername && userWithSameUsername.userID !== userID) {
        throw new ConflictError('Username đã được sử dụng bởi người dùng khác');
      }

      updateFields.push('Username = @Username');
      request.input('Username', sql.NVarChar(100), normalizedUsername);
    }

    // Update email if provided
    if (email !== undefined) {
      if (typeof email !== 'string' || email.trim().length === 0) {
        throw new BadRequestError('Email không được rỗng');
      }
      const normalizedEmail = email.trim().toLowerCase();
      
      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(normalizedEmail)) {
        throw new BadRequestError('Email không đúng định dạng');
      }

      // Check if email is already taken by another user
      const userWithSameEmail = await UserModel.findByEmail(normalizedEmail);
      if (userWithSameEmail && userWithSameEmail.userID !== userID) {
        throw new ConflictError('Email đã được sử dụng bởi người dùng khác');
      }

      updateFields.push('Email = @Email');
      request.input('Email', sql.NVarChar(255), normalizedEmail);
    }

    // Update password if provided
    if (password !== undefined) {
      if (typeof password !== 'string' || password.length < 6) {
        throw new BadRequestError('Password phải có ít nhất 6 ký tự');
      }
      
      // Hash password using bcrypt (hàm của nhóm trưởng)
      const hashedPassword = await hashPassword(password);
      updateFields.push('PasswordHash = @PasswordHash');
      request.input('PasswordHash', sql.NVarChar(255), hashedPassword);
    }

    // Update role if provided
    if (role !== undefined) {
      if (typeof role !== 'string' || !['ADMIN', 'STUDENT', 'SPSO'].includes(role.toUpperCase())) {
        throw new BadRequestError('Role phải là một trong: ADMIN, STUDENT, SPSO');
      }
      updateFields.push('Role = @Role');
      request.input('Role', sql.NVarChar(50), role.toUpperCase());
    }

    // Update isActive if provided
    if (isActive !== undefined) {
      if (typeof isActive !== 'boolean') {
        throw new BadRequestError('isActive phải là boolean');
      }
      updateFields.push('IsActive = @IsActive');
      request.input('IsActive', sql.Bit, isActive);
    }

    // If no fields to update
    if (updateFields.length === 0) {
      throw new BadRequestError('Không có trường nào để cập nhật');
    }

    // Execute update query
    const updateQuery = `
      UPDATE Users
      SET ${updateFields.join(', ')}
      WHERE UserID = @UserID
    `;

    await request.query(updateQuery);

    // Get updated user
    const result = await pool
      .request()
      .input('UserID', sql.UniqueIdentifier, userID)
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
        WHERE u.UserID = @UserID
      `);

    return res.status(200).json({
      success: true,
      message: 'User updated successfully',
      data: result.recordset[0],
    });
  } catch (error) {
    console.error('[user-router]: Error updating user:', error);
    
    if (error instanceof BadRequestError || error instanceof NotFoundError || error instanceof ConflictError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * @openapi
 * /admin/users/{id}:
 *   delete:
 *     tags:
 *       - Admin - User Management
 *     summary: Xóa người dùng (Soft Delete)
 *     description: |
 *       API này thực hiện soft delete bằng cách set IsActive = 0.
 *       Người dùng sẽ không bị xóa khỏi database nhưng sẽ không thể đăng nhập.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: UserID của người dùng cần xóa
 *     responses:
 *       200:
 *         description: Xóa người dùng thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 message:
 *                   type: string
 *                   example: "User deleted successfully"
 *       404:
 *         description: Không tìm thấy người dùng
 *       500:
 *         description: Lỗi server
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userID = validateUUID(req.params.id, 'UserID');

    // Check if user exists
    const existingUser = await UserModel.findByUserID(userID);
    if (!existingUser) {
      throw new NotFoundError('Không tìm thấy người dùng');
    }

    // Soft delete: Set IsActive = 0
    const pool = await getPool();
    if (!pool) {
      return res.status(500).json({
        success: false,
        message: 'Database connection not available',
      });
    }

    const request = pool.request();
    request.input('UserID', sql.UniqueIdentifier, userID);

    await request.query(`
      UPDATE Users
      SET IsActive = 0
      WHERE UserID = @UserID
    `);

    return res.status(200).json({
      success: true,
      message: 'User deleted successfully',
    });
  } catch (error) {
    console.error('[user-router]: Error deleting user:', error);
    
    if (error instanceof NotFoundError || error instanceof BadRequestError) {
      return res.status(error.statusCode).json({
        success: false,
        message: error.message,
      });
    }

    return res.status(500).json({
      success: false,
      message: 'Internal server error',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
