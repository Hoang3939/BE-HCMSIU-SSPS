import express from 'express';
import * as adminController from '../../controllers/admin.controller.js';
import { authRequired, requireRole } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin - Dashboard
 *     description: API quản lý Dashboard cho Admin
 */

// GET /api/admin/dashboard/stats - Lấy thống kê tổng quan
router.get('/stats', authRequired, requireRole('ADMIN', 'SPSO'), adminController.getDashboardStats);

// GET /api/admin/dashboard/recent-activities - Lấy hoạt động gần đây
router.get('/recent-activities', authRequired, requireRole('ADMIN', 'SPSO'), adminController.getRecentActivities);

export default router;

