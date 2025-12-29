/**
 * Admin Config Routes
 * Routes cho các endpoint cấu hình hệ thống (Admin only)
 */

import { Router } from 'express';
import { ConfigController } from '../../controllers/config.controller.js';

const router = Router();

// GET /api/admin/configs - Lấy cấu hình hệ thống
router.get('/', ConfigController.getSystemConfig);

// PUT /api/admin/configs - Cập nhật cấu hình hệ thống
router.put('/', ConfigController.updateSystemConfig);

// POST /api/admin/configs/reset-pages - Reset số trang cho tất cả sinh viên
router.post('/reset-pages', ConfigController.resetStudentPages);

export default router;

