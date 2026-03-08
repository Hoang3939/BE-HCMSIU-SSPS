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
    console.log('[adminController] getDashboardStats called');
    const stats = await adminService.getDashboardStats();
    console.log('[adminController] getDashboardStats success:', {
      totalPrinters: stats.totalPrinters,
      activePrinters: stats.activePrinters,
      totalStudents: stats.totalStudents,
    });
    
    const response = {
      success: true,
      data: stats,
    };
    
    console.log('[adminController] Sending response:', JSON.stringify(response));
    res.status(200).json(response);
  } catch (error) {
    console.error('[adminController] Error getting dashboard stats:', error);
    console.error('[adminController] Error stack:', error instanceof Error ? error.stack : undefined);
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
    console.log('[adminController] getRecentActivities called, limit:', req.query.limit);
    
    // Parse and validate limit parameter
    let limit = 10;
    if (req.query.limit) {
      const parsedLimit = parseInt(req.query.limit as string, 10);
      if (!isNaN(parsedLimit) && parsedLimit > 0) {
        limit = parsedLimit;
      }
    }

    console.log('[adminController] Calling adminService.getRecentActivities with limit:', limit);
    const activities = await adminService.getRecentActivities(limit);
    console.log('[adminController] getRecentActivities success, count:', activities.length);
    
    // Convert Date objects to ISO strings for JSON serialization
    const serializedActivities = activities.map(activity => ({
      ...activity,
      createdAt: activity.createdAt.toISOString(),
    }));

    const response = {
      success: true,
      data: serializedActivities,
    };
    
    console.log('[adminController] Sending response with', serializedActivities.length, 'activities');
    res.status(200).json(response);
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

