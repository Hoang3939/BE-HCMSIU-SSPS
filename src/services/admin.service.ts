import sql from 'mssql';
import crypto from 'crypto';
import { getPool } from '../config/database.js';
import type { SystemConfig, UpdateSystemConfigRequest } from '../types/config.types.js';
import { BadRequestError, InternalServerError } from '../errors/AppError.js';

/**
 * Service cho Admin Dashboard và System Configuration
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

// ====== SYSTEM CONFIGURATION MANAGEMENT ======

// In-memory store for system configs (có thể migrate sang database sau)
const getDefaultSemesterDates = () => {
  const now = new Date();
  const year = now.getFullYear();
  return {
    semester1: new Date(year, 8, 1).toISOString(), // 1/9 (tháng 9)
    semester2: new Date(year + 1, 1, 1).toISOString(), // 1/2 năm sau
    semester3: new Date(year + 1, 5, 1).toISOString(), // 1/6 năm sau
  };
};

let systemConfig: SystemConfig = {
  default_page_balance: 100,
  allowed_file_types: ['pdf', 'docx', 'pptx', 'doc', 'ppt', 'xls', 'xlsx', 'txt'],
  max_file_size_mb: 20,
  price_per_page: 500,
  semester_dates: getDefaultSemesterDates(),
};

/**
 * Lấy cấu hình hệ thống hiện tại
 */
export async function getSystemConfigs(): Promise<SystemConfig> {
  try {
    const pool = await getPool();
    if (!pool) {
      // Fallback to in-memory store if DB not available
      console.warn('[adminService] Database not available, using in-memory config');
      return { ...systemConfig };
    }

    // Try to get from database first
    const result = await pool.request().query(`
      SELECT TOP 1 
        ConfigID,
        DefaultPageBalance,
        PricePerPage,
        MaxFileSizeMB,
        AllowedFileTypes,
        Semester1Date,
        Semester2Date,
        Semester3Date,
        UpdatedAt
      FROM SystemConfigs
      ORDER BY UpdatedAt DESC
    `);

    if (result.recordset.length > 0) {
      const dbConfig = result.recordset[0];
      // Map DB columns to SystemConfig interface
      const config: SystemConfig = {
        default_page_balance: dbConfig.DefaultPageBalance || systemConfig.default_page_balance,
        allowed_file_types: dbConfig.AllowedFileTypes 
          ? JSON.parse(dbConfig.AllowedFileTypes) 
          : systemConfig.allowed_file_types,
        max_file_size_mb: dbConfig.MaxFileSizeMB || systemConfig.max_file_size_mb,
        price_per_page: dbConfig.PricePerPage || systemConfig.price_per_page,
        semester_dates: {
          semester1: dbConfig.Semester1Date?.toISOString() || systemConfig.semester_dates.semester1,
          semester2: dbConfig.Semester2Date?.toISOString() || systemConfig.semester_dates.semester2,
          semester3: dbConfig.Semester3Date?.toISOString() || systemConfig.semester_dates.semester3,
        },
      };

      // Update in-memory store to keep it in sync
      systemConfig = config;
      return { ...config };
    }

    // If no config in DB, use in-memory store
    console.log('[adminService] No config in database, using in-memory config');
    return { ...systemConfig };
  } catch (error) {
    console.error('[adminService] Error getting system configs from DB, using in-memory:', error);
    // Fallback to in-memory store on error
    return { ...systemConfig };
  }
}

/**
 * Cập nhật cấu hình hệ thống
 */
export async function updateSystemConfigs(
  updates: UpdateSystemConfigRequest
): Promise<SystemConfig> {
  try {
    // Validation
    if (updates.default_page_balance !== undefined) {
      if (updates.default_page_balance < 0 || updates.default_page_balance > 1000) {
        throw new BadRequestError('default_page_balance phải từ 0 đến 1000');
      }
      systemConfig.default_page_balance = updates.default_page_balance;
    }

    if (updates.allowed_file_types !== undefined) {
      if (updates.allowed_file_types.length === 0) {
        throw new BadRequestError('allowed_file_types không được rỗng');
      }
      // Check duplicates
      const uniqueTypes = [...new Set(updates.allowed_file_types)];
      if (uniqueTypes.length !== updates.allowed_file_types.length) {
        throw new BadRequestError('allowed_file_types không được trùng lặp');
      }
      systemConfig.allowed_file_types = updates.allowed_file_types;
    }

    if (updates.max_file_size_mb !== undefined) {
      if (updates.max_file_size_mb < 1 || updates.max_file_size_mb > 100) {
        throw new BadRequestError('max_file_size_mb phải từ 1 đến 100');
      }
      systemConfig.max_file_size_mb = updates.max_file_size_mb;
    }

    if (updates.price_per_page !== undefined) {
      if (updates.price_per_page < 0) {
        throw new BadRequestError('price_per_page phải >= 0');
      }
      systemConfig.price_per_page = updates.price_per_page;
    }

    if (updates.semester_dates !== undefined) {
      // Validate semester dates
      const dates = updates.semester_dates;
      const semester1 = dates.semester1 ? new Date(dates.semester1) : null;
      const semester2 = dates.semester2 ? new Date(dates.semester2) : null;
      const semester3 = dates.semester3 ? new Date(dates.semester3) : null;

      // Validate format
      if (semester1 && isNaN(semester1.getTime())) {
        throw new BadRequestError('semester1 phải là định dạng ISO8601 hợp lệ');
      }
      if (semester2 && isNaN(semester2.getTime())) {
        throw new BadRequestError('semester2 phải là định dạng ISO8601 hợp lệ');
      }
      if (semester3 && isNaN(semester3.getTime())) {
        throw new BadRequestError('semester3 phải là định dạng ISO8601 hợp lệ');
      }

      // Get current values or use new values
      const currentSemester1 = semester1 || new Date(systemConfig.semester_dates.semester1);
      const currentSemester2 = semester2 || new Date(systemConfig.semester_dates.semester2);
      const currentSemester3 = semester3 || new Date(systemConfig.semester_dates.semester3);

      // Validate order: semester1 <= semester2 <= semester3
      if (currentSemester1 > currentSemester2) {
        throw new BadRequestError('Học kỳ 1 không được lớn hơn Học kỳ 2');
      }
      if (currentSemester2 > currentSemester3) {
        throw new BadRequestError('Học kỳ 2 không được lớn hơn Học kỳ phụ');
      }

      // Update only provided dates
      if (dates.semester1 !== undefined) {
        systemConfig.semester_dates.semester1 = dates.semester1;
      }
      if (dates.semester2 !== undefined) {
        systemConfig.semester_dates.semester2 = dates.semester2;
      }
      if (dates.semester3 !== undefined) {
        systemConfig.semester_dates.semester3 = dates.semester3;
      }
    }

    // Log config change
    console.log('[adminService] System config updated in memory:', systemConfig);

    // Save to database
    try {
      const pool = await getPool();
      if (pool) {
        // Get current config ID or create new one
        const existingConfig = await pool.request().query(`
          SELECT TOP 1 ConfigID FROM SystemConfigs ORDER BY UpdatedAt DESC
        `);

        const configID = existingConfig.recordset.length > 0 
          ? existingConfig.recordset[0].ConfigID 
          : crypto.randomUUID();

        // Update or insert config
        await pool.request()
          .input('ConfigID', sql.UniqueIdentifier, configID)
          .input('DefaultPageBalance', sql.Int, systemConfig.default_page_balance)
          .input('PricePerPage', sql.Decimal(10, 2), systemConfig.price_per_page)
          .input('MaxFileSizeMB', sql.Int, systemConfig.max_file_size_mb)
          .input('AllowedFileTypes', sql.NVarChar(sql.MAX), JSON.stringify(systemConfig.allowed_file_types))
          .input('Semester1Date', sql.DateTime, systemConfig.semester_dates.semester1 ? new Date(systemConfig.semester_dates.semester1) : null)
          .input('Semester2Date', sql.DateTime, systemConfig.semester_dates.semester2 ? new Date(systemConfig.semester_dates.semester2) : null)
          .input('Semester3Date', sql.DateTime, systemConfig.semester_dates.semester3 ? new Date(systemConfig.semester_dates.semester3) : null)
          .query(`
            IF EXISTS (SELECT 1 FROM SystemConfigs WHERE ConfigID = @ConfigID)
            BEGIN
              UPDATE SystemConfigs
              SET 
                DefaultPageBalance = @DefaultPageBalance,
                PricePerPage = @PricePerPage,
                MaxFileSizeMB = @MaxFileSizeMB,
                AllowedFileTypes = @AllowedFileTypes,
                Semester1Date = @Semester1Date,
                Semester2Date = @Semester2Date,
                Semester3Date = @Semester3Date,
                UpdatedAt = GETDATE()
              WHERE ConfigID = @ConfigID
            END
            ELSE
            BEGIN
              INSERT INTO SystemConfigs (
                ConfigID,
                DefaultPageBalance,
                PricePerPage,
                MaxFileSizeMB,
                AllowedFileTypes,
                Semester1Date,
                Semester2Date,
                Semester3Date,
                UpdatedAt
              )
              VALUES (
                @ConfigID,
                @DefaultPageBalance,
                @PricePerPage,
                @MaxFileSizeMB,
                @AllowedFileTypes,
                @Semester1Date,
                @Semester2Date,
                @Semester3Date,
                GETDATE()
              )
            END
          `);

        console.log('[adminService] System config saved to database');
      } else {
        console.warn('[adminService] Database not available, config only updated in memory');
      }
    } catch (dbError) {
      console.error('[adminService] Error saving config to database:', dbError);
      // Don't throw error, config is still updated in memory
    }

    return { ...systemConfig };
  } catch (error) {
    if (error instanceof BadRequestError) {
      throw error;
    }
    console.error('[adminService] Error updating system configs:', error);
    throw new InternalServerError('Không thể cập nhật cấu hình hệ thống');
  }
}

/**
 * Reset số trang về mặc định cho tất cả sinh viên
 * Cập nhật PageBalances.CurrentBalance về default_page_balance
 */
export async function resetStudentPages(): Promise<{ resetCount: number }> {
  const pool = await getPool();
  if (!pool) {
    throw new InternalServerError('Database connection not available');
  }

  try {
    const defaultPages = systemConfig.default_page_balance;

    // Update tất cả PageBalances về default_page_balance
    // Nếu student chưa có PageBalance, tạo mới
    const result = await pool
      .request()
      .input('defaultPages', sql.Int, defaultPages)
      .query(`
        -- Update existing PageBalances
        UPDATE PageBalances
        SET CurrentBalance = @defaultPages,
            DefaultPages = @defaultPages,
            UsedPages = 0,
            LastUpdated = GETDATE()
        
        -- Insert PageBalance for students who don't have one
        INSERT INTO PageBalances (StudentID, CurrentBalance, DefaultPages, PurchasedPages, UsedPages, LastUpdated)
        SELECT 
            s.StudentID,
            @defaultPages,
            @defaultPages,
            0,
            0,
            GETDATE()
        FROM Students s
        WHERE NOT EXISTS (
            SELECT 1 FROM PageBalances pb WHERE pb.StudentID = s.StudentID
        )
      `);

    // Get count of affected rows
    const updateResult = await pool
      .request()
      .input('defaultPages', sql.Int, defaultPages)
      .query(`
        SELECT COUNT(*) as UpdatedCount
        FROM PageBalances
        WHERE CurrentBalance = @defaultPages AND DefaultPages = @defaultPages
      `);

    const resetCount = updateResult.recordset[0]?.UpdatedCount || 0;

    console.log(`[adminService] Reset ${resetCount} students to ${defaultPages} pages`);

    return { resetCount };
  } catch (error) {
    console.error('[adminService] Error resetting student pages:', error);
    throw new InternalServerError('Không thể reset số trang cho sinh viên');
  }
}

/**
 * Cấp trang tự động cho sinh viên khi sang học kỳ mới
 * @param semesterNumber - Số học kỳ (1, 2, hoặc 3)
 * @param simulateDate - Ngày giả lập để test (optional, nếu không có thì dùng ngày hiện tại)
 * @returns Số lượng sinh viên đã được cấp trang
 */
export async function allocatePagesForSemester(
  semesterNumber: 1 | 2 | 3,
  simulateDate?: Date
): Promise<{ allocatedCount: number; semesterDate: string }> {
  const pool = await getPool();
  if (!pool) {
    throw new InternalServerError('Database connection not available');
  }

  try {
    const defaultPages = systemConfig.default_page_balance;
    const currentDate = simulateDate || new Date();
    
    // Lấy ngày bắt đầu học kỳ từ config
    const semesterKey = `semester${semesterNumber}` as keyof typeof systemConfig.semester_dates;
    const semesterDateStr = systemConfig.semester_dates[semesterKey];
    
    if (!semesterDateStr) {
      throw new BadRequestError(`Không tìm thấy ngày bắt đầu cho học kỳ ${semesterNumber}`);
    }

    const semesterDate = new Date(semesterDateStr);
    
    // Kiểm tra xem đã đến ngày bắt đầu học kỳ chưa (hoặc đang test với simulateDate)
    if (!simulateDate && currentDate < semesterDate) {
      throw new BadRequestError(
        `Chưa đến ngày bắt đầu học kỳ ${semesterNumber}. Ngày bắt đầu: ${semesterDate.toISOString()}`
      );
    }

    console.log(`[adminService] Allocating pages for semester ${semesterNumber}...`);
    console.log(`[adminService] Semester date: ${semesterDate.toISOString()}`);
    console.log(`[adminService] Current/Simulated date: ${currentDate.toISOString()}`);

    // Cập nhật PageBalances: Thêm defaultPages vào CurrentBalance (không reset về 0)
    // Logic: CurrentBalance = CurrentBalance + defaultPages (cộng thêm, không reset)
    const result = await pool
      .request()
      .input('defaultPages', sql.Int, defaultPages)
      .input('semester', sql.NVarChar(20), `2024-2025-${semesterNumber}`)
      .query(`
        -- Update existing PageBalances: Cộng thêm defaultPages vào CurrentBalance
        UPDATE PageBalances
        SET 
            CurrentBalance = CurrentBalance + @defaultPages,
            DefaultPages = DefaultPages + @defaultPages,
            Semester = @semester,
            LastUpdated = GETDATE()
        
        -- Insert PageBalance for students who don't have one
        INSERT INTO PageBalances (StudentID, CurrentBalance, DefaultPages, PurchasedPages, UsedPages, Semester, LastUpdated)
        SELECT 
            s.StudentID,
            @defaultPages,
            @defaultPages,
            0,
            0,
            @semester,
            GETDATE()
        FROM Students s
        WHERE NOT EXISTS (
            SELECT 1 FROM PageBalances pb WHERE pb.StudentID = s.StudentID
        )
      `);

    // Get count of affected students
    const countResult = await pool
      .request()
      .input('semester', sql.NVarChar(20), `2024-2025-${semesterNumber}`)
      .query(`
        SELECT COUNT(*) as AllocatedCount
        FROM PageBalances
        WHERE Semester = @semester
      `);

    const allocatedCount = countResult.recordset[0]?.AllocatedCount || 0;

    console.log(`[adminService] Allocated ${defaultPages} pages to ${allocatedCount} students for semester ${semesterNumber}`);

    return {
      allocatedCount,
      semesterDate: semesterDate.toISOString(),
    };
  } catch (error) {
    console.error('[adminService] Error allocating pages for semester:', error);
    if (error instanceof BadRequestError) {
      throw error;
    }
    throw new InternalServerError(`Không thể cấp trang cho học kỳ ${semesterNumber}`);
  }
}

