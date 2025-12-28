import type { Request, Response } from 'express';
import * as adminService from '../services/admin.service.js';
import { BadRequestError } from '../errors/AppError.js';

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

// ====== SYSTEM CONFIGURATION CONTROLLERS ======

/**
 * @swagger
 * /api/admin/configs:
 *   get:
 *     summary: Lấy cấu hình hệ thống hiện tại
 *     tags: [Admin - Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Lấy cấu hình thành công
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
 *                     default_page_balance:
 *                       type: integer
 *                       example: 100
 *                     allowed_file_types:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["pdf", "docx", "pptx"]
 *                     max_file_size_mb:
 *                       type: number
 *                       example: 20
 *                     price_per_page:
 *                       type: integer
 *                       example: 500
 *                     semester_start_date:
 *                       type: string
 *                       format: date-time
 *                       example: "2024-09-01T00:00:00Z"
 *       500:
 *         description: Lỗi server
 */
/**
 * @swagger
 * /api/config/upload-limits:
 *   get:
 *     summary: Lấy thông tin giới hạn upload (public, không cần authentication)
 *     tags: [Public - Configuration]
 *     description: API công khai để lấy thông tin max_file_size_mb và allowed_file_types cho student
 *     responses:
 *       200:
 *         description: Lấy thông tin thành công
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
 *                     max_file_size_mb:
 *                       type: number
 *                       example: 20
 *                     allowed_file_types:
 *                       type: array
 *                       items:
 *                         type: string
 *                       example: ["pdf", "docx", "pptx"]
 *       500:
 *         description: Lỗi server
 */
export async function getUploadLimits(req: Request, res: Response): Promise<void> {
  try {
    const configs = await adminService.getSystemConfigs();
    // Chỉ trả về thông tin cần thiết cho upload và pricing (public)
    res.status(200).json({
      success: true,
      data: {
        max_file_size_mb: configs.max_file_size_mb,
        allowed_file_types: configs.allowed_file_types,
        price_per_page: configs.price_per_page,
      },
    });
  } catch (error) {
    console.error('[adminController] Error getting upload limits:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

export async function getSystemConfigs(req: Request, res: Response): Promise<void> {
  try {
    const configs = await adminService.getSystemConfigs();
    res.status(200).json({
      success: true,
      data: configs,
    });
  } catch (error) {
    console.error('[adminController] Error getting system configs:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/configs:
 *   put:
 *     summary: Cập nhật cấu hình hệ thống
 *     tags: [Admin - Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               default_page_balance:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 1000
 *                 example: 100
 *               allowed_file_types:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["pdf", "docx", "pptx"]
 *               max_file_size_mb:
 *                 type: number
 *                 minimum: 1
 *                 maximum: 100
 *                 example: 20
 *               price_per_page:
 *                 type: integer
 *                 minimum: 0
 *                 example: 500
 *               semester_start_date:
 *                 type: string
 *                 format: date-time
 *                 example: "2024-09-01T00:00:00Z"
 *     responses:
 *       200:
 *         description: Cập nhật thành công
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       500:
 *         description: Lỗi server
 */
export async function updateSystemConfigs(req: Request, res: Response): Promise<void> {
  try {
    const updates = req.body;
    const updatedConfigs = await adminService.updateSystemConfigs(updates);
    res.status(200).json({
      success: true,
      data: updatedConfigs,
      message: 'Cập nhật cấu hình thành công',
    });
  } catch (error) {
    console.error('[adminController] Error updating system configs:', error);
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/configs/reset-pages:
 *   post:
 *     summary: Reset số trang về mặc định cho tất cả sinh viên
 *     tags: [Admin - Configuration]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Reset thành công
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
 *                     resetCount:
 *                       type: integer
 *                       description: Số lượng sinh viên đã được reset
 *       500:
 *         description: Lỗi server
 */
export async function resetStudentPages(req: Request, res: Response): Promise<void> {
  try {
    const result = await adminService.resetStudentPages();
    res.status(200).json({
      success: true,
      data: result,
      message: `Đã reset số trang cho ${result.resetCount} sinh viên`,
    });
  } catch (error) {
    console.error('[adminController] Error resetting student pages:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/configs/allocate-semester-pages:
 *   post:
 *     summary: Cấp trang tự động cho sinh viên khi sang học kỳ mới (dùng để test)
 *     tags: [Admin - Configuration]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - semesterNumber
 *             properties:
 *               semesterNumber:
 *                 type: integer
 *                 enum: [1, 2, 3]
 *                 description: Số học kỳ (1 = Học kỳ 1, 2 = Học kỳ 2, 3 = Học kỳ phụ)
 *                 example: 2
 *               simulateDate:
 *                 type: string
 *                 format: date-time
 *                 description: Ngày giả lập để test (optional, nếu không có thì dùng ngày hiện tại)
 *                 example: "2026-01-31T00:00:00Z"
 *     responses:
 *       200:
 *         description: Cấp trang thành công
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
 *                     allocatedCount:
 *                       type: integer
 *                       description: Số lượng sinh viên đã được cấp trang
 *                     semesterDate:
 *                       type: string
 *                       format: date-time
 *                       description: Ngày bắt đầu học kỳ
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ hoặc chưa đến ngày bắt đầu học kỳ
 *       500:
 *         description: Lỗi server
 */
export async function allocateSemesterPages(req: Request, res: Response): Promise<void> {
  try {
    const { semesterNumber, simulateDate } = req.body;

    if (!semesterNumber || ![1, 2, 3].includes(semesterNumber)) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: 'semesterNumber phải là 1, 2, hoặc 3',
      });
      return;
    }

    const simulateDateObj = simulateDate ? new Date(simulateDate) : undefined;
    
    const result = await adminService.allocatePagesForSemester(
      semesterNumber as 1 | 2 | 3,
      simulateDateObj
    );

    res.status(200).json({
      success: true,
      data: result,
      message: `Đã cấp trang cho ${result.allocatedCount} sinh viên khi sang học kỳ ${semesterNumber}`,
    });
  } catch (error) {
    console.error('[adminController] Error allocating semester pages:', error);
    
    if (error instanceof BadRequestError) {
      res.status(400).json({
        success: false,
        error: 'Bad Request',
        message: error.message,
      });
      return;
    }

    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

