import sql from 'mssql';
import { getPool } from '../config/database.js';

/**
 * Service cho Admin Dashboard
 */

export interface DashboardStats {
  totalPrinters: number;
  activePrinters: number;
  totalStudents: number;
  totalPrintJobs: number;
  printJobsToday: number;
  failedPrintJobs: number;
}

export interface RecentActivity {
  id: string;
  type: 'print' | 'error';
  studentId: string;
  studentName?: string;
  printerId: string;
  printerName?: string;
  pages: number;
  status: 'success' | 'failed';
  createdAt: Date;
  timeAgo: string;
}

/**
 * Lấy thống kê tổng quan cho Dashboard
 */
export async function getDashboardStats(): Promise<DashboardStats> {
  const pool = await getPool();

  try {
    // Lấy tổng số máy in và số máy đang hoạt động
    const printerStatsResult = await pool.request().query(`
      SELECT 
        COUNT(*) as totalPrinters,
        SUM(CASE WHEN IsActive = 1 AND Status = 'AVAILABLE' THEN 1 ELSE 0 END) as activePrinters
      FROM Printers
    `);

    // Lấy tổng số sinh viên
    const studentsResult = await pool.request().query(`
      SELECT COUNT(*) as totalStudents
      FROM Students
    `);

    // Lấy tổng số print jobs
    const totalPrintJobsResult = await pool.request().query(`
      SELECT COUNT(*) as totalPrintJobs
      FROM PrintJobs
    `);

    // Lấy số print jobs hôm nay
    const todayPrintJobsResult = await pool.request().query(`
      SELECT COUNT(*) as printJobsToday
      FROM PrintJobs
      WHERE CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
    `);

    // Lấy số print jobs thất bại (hôm nay)
    const failedPrintJobsResult = await pool.request().query(`
      SELECT COUNT(*) as failedPrintJobs
      FROM PrintJobs
      WHERE Status = 'FAILED' 
        AND CAST(StartTime AS DATE) = CAST(GETDATE() AS DATE)
    `);

    const printerStats = printerStatsResult.recordset[0];
    const students = studentsResult.recordset[0];
    const totalPrintJobs = totalPrintJobsResult.recordset[0];
    const todayPrintJobs = todayPrintJobsResult.recordset[0];
    const failedPrintJobs = failedPrintJobsResult.recordset[0];

    return {
      totalPrinters: printerStats.totalPrinters || 0,
      activePrinters: printerStats.activePrinters || 0,
      totalStudents: students.totalStudents || 0,
      totalPrintJobs: totalPrintJobs.totalPrintJobs || 0,
      printJobsToday: todayPrintJobs.printJobsToday || 0,
      failedPrintJobs: failedPrintJobs.failedPrintJobs || 0,
    };
  } catch (error) {
    console.error('[adminService] Error getting dashboard stats:', error);
    throw error;
  }
}

/**
 * Lấy các hoạt động in ấn gần đây
 */
export async function getRecentActivities(limit: number = 10): Promise<RecentActivity[]> {
  const pool = await getPool();

  if (!pool) {
    throw new Error('Database connection not available');
  }

  try {
    // Validate limit
    const validLimit = Math.max(1, Math.min(limit || 10, 100)); // Between 1 and 100

    const result = await pool
      .request()
      .input('limit', sql.Int, validLimit)
      .query(`
        SELECT TOP (@limit)
          pj.JobID as id,
          pj.Status,
          ISNULL(pj.TotalPages, 0) as pages,
          pj.StartTime as createdAt,
          pj.StudentID as studentId,
          u.Username as studentName,
          s.StudentCode,
          pj.PrinterID as printerId,
          p.Name as printerName
        FROM PrintJobs pj
        LEFT JOIN Students s ON pj.StudentID = s.StudentID
        LEFT JOIN Users u ON s.StudentID = u.UserID
        LEFT JOIN Printers p ON pj.PrinterID = p.PrinterID
        WHERE pj.JobID IS NOT NULL
        ORDER BY pj.StartTime DESC
      `);

    if (!result.recordset || result.recordset.length === 0) {
      return [];
    }

    const activities: RecentActivity[] = result.recordset.map((row: any) => {
      // Safely parse createdAt (from StartTime)
      let createdAt: Date;
      try {
        createdAt = row.createdAt ? new Date(row.createdAt) : new Date();
        if (isNaN(createdAt.getTime())) {
          createdAt = new Date();
        }
      } catch {
        createdAt = new Date();
      }

      const now = new Date();
      const diffMs = now.getTime() - createdAt.getTime();
      const diffMins = Math.floor(diffMs / 60000);
      
      let timeAgo = '';
      if (diffMins < 1) {
        timeAgo = 'Vừa xong';
      } else if (diffMins < 60) {
        timeAgo = `${diffMins} phút trước`;
      } else if (diffMins < 1440) {
        const hours = Math.floor(diffMins / 60);
        timeAgo = `${hours} giờ trước`;
      } else {
        const days = Math.floor(diffMins / 1440);
        timeAgo = `${days} ngày trước`;
      }

      // Safely extract values with defaults
      const status = row.Status || 'PENDING';
      const studentId = row.studentId ? String(row.studentId) : '';
      const printerId = row.printerId ? String(row.printerId) : '';

      return {
        id: row.id ? String(row.id) : '',
        type: status === 'FAILED' ? 'error' : 'print',
        studentId,
        studentName: row.studentName || row.StudentCode || undefined,
        printerId,
        printerName: row.printerName || undefined,
        pages: row.pages ? parseInt(row.pages, 10) : 0,
        status: status === 'FAILED' ? 'failed' : 'success',
        createdAt,
        timeAgo,
      };
    });

    return activities;
  } catch (error) {
    console.error('[adminService] Error getting recent activities:', error);
    console.error('[adminService] Error details:', {
      message: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined,
    });
    throw error;
  }
}

