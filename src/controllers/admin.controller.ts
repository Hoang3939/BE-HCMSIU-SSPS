import type { Request, Response } from 'express';
import * as adminService from '../services/admin.service.js';

/**
 * Controller cho Admin Dashboard
 */

/**
 * @swagger
 * /api/admin/dashboard/stats:
 *   get:
 *     summary: Lấy thống kê tổng quan cho Admin Dashboard
 *     tags: [Admin - Dashboard]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Thống kê thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     totalPrinters:
 *                       type: integer
 *                     activePrinters:
 *                       type: integer
 *                     totalStudents:
 *                       type: integer
 *                     totalPrintJobs:
 *                       type: integer
 *                     printJobsToday:
 *                       type: integer
 *                     failedPrintJobs:
 *                       type: integer
 *       500:
 *         description: Lỗi server
 */
export async function getDashboardStats(req: Request, res: Response): Promise<void> {
  try {
    const stats = await adminService.getDashboardStats();
    res.status(200).json({
      success: true,
      data: stats,
    });
  } catch (error) {
    console.error('[adminController] Error getting dashboard stats:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/dashboard/recent-activities:
 *   get:
 *     summary: Lấy các hoạt động in ấn gần đây
 *     tags: [Admin - Dashboard]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng hoạt động cần lấy
 *     responses:
 *       200:
 *         description: Danh sách hoạt động thành công
 *       500:
 *         description: Lỗi server
 */
export async function getRecentActivities(req: Request, res: Response): Promise<void> {
  try {
    // Parse and validate limit parameter
    let limit = 10;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    const activities = await adminService.getRecentActivities(limit);
    
    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivities = activities.map(activity => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    }));

    res.status(200).json({
      success: true,
      data: serializedActivities,
    });
  } catch (error) {
    console.error('[adminController] Error getting recent activities:', error);
    console.error('[adminController] Error stack:', error instanceof Error ? error.stack : undefined);
    
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

