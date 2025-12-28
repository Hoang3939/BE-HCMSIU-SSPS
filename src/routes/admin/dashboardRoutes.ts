import express from 'express';
import * as adminController from '../../controllers/admin.controller.js';
import { authRequired, requireAdmin, blockStudentFromAdmin } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin - Dashboard
 *     description: API quản lý Dashboard cho Admin (chỉ ADMIN)
 */

// GET /api/admin/dashboard/stats - Lấy thống kê tổng quan
router.get('/stats', authRequired, blockStudentFromAdmin, requireAdmin, adminController.getDashboardStats);

// GET /api/admin/dashboard/recent-activities - Lấy hoạt động gần đây
router.get('/recent-activities', authRequired, blockStudentFromAdmin, requireAdmin, adminController.getRecentActivities);

export default router;

