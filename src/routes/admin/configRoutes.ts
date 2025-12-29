import express from 'express';
import * as adminController from '../../controllers/admin.controller.js';
import { authRequired, requireAdmin, blockStudentFromAdmin } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin - Configuration
 *     description: API quản lý cấu hình hệ thống cho Admin (chỉ ADMIN)
 */

// GET /api/admin/configs - Lấy cấu hình hệ thống hiện tại
router.get('/', authRequired, blockStudentFromAdmin, requireAdmin, adminController.getSystemConfigs);

// PUT /api/admin/configs - Cập nhật cấu hình hệ thống
router.put('/', authRequired, blockStudentFromAdmin, requireAdmin, adminController.updateSystemConfigs);

// POST /api/admin/configs/reset-pages - Reset số trang cho tất cả sinh viên
router.post('/reset-pages', authRequired, blockStudentFromAdmin, requireAdmin, adminController.resetStudentPages);

// POST /api/admin/configs/allocate-semester-pages - Cấp trang tự động cho học kỳ mới (dùng để test)
router.post('/allocate-semester-pages', authRequired, blockStudentFromAdmin, requireAdmin, adminController.allocateSemesterPages);

export default router;

