/**
 * Config Controller
 * Controller để xử lý các request liên quan đến cấu hình hệ thống
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { getPool } from '../config/database.js';
import sql from 'mssql';
import { InternalServerError, BadRequestError } from '../errors/AppError.js';

export class ConfigController {
    /**
     * Lấy upload limits (public endpoint - không cần auth)
     * GET /api/config/upload-limits
     */
    static getUploadLimits = asyncHandler(async (req: Request, res: Response) => {
        const pool = await getPool();
        if (!pool) {
            throw new InternalServerError('Database connection not available');
        }

        try {
            // Lấy config từ SystemConfigs (lấy record mới nhất)
            const result = await pool.request().query(`
        SELECT TOP 1
          DefaultPagePrice,
          MaxFileSize,
          AllowedFileTypes
        FROM SystemConfigs
        ORDER BY UpdatedAt DESC
      `);

            if (result.recordset.length === 0) {
                // Trả về default values nếu không có config
                return res.status(200).json({
                    success: true,
                    data: {
                        max_file_size_mb: 100,
                        allowed_file_types: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'],
                        price_per_page: 500,
                    },
                });
            }

            const config = result.recordset[0];

            // Parse AllowedFileTypes từ JSON string hoặc array
            let allowedFileTypes: string[] = [];
            if (config.AllowedFileTypes) {
                try {
                    if (typeof config.AllowedFileTypes === 'string') {
                        allowedFileTypes = JSON.parse(config.AllowedFileTypes);
                    } else {
                        allowedFileTypes = config.AllowedFileTypes;
                    }
                } catch (e) {
                    // Nếu parse lỗi, dùng default
                    allowedFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
                }
            } else {
                allowedFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
            }

            // Convert MaxFileSize từ bytes sang MB
            const maxFileSizeMB = config.MaxFileSize
                ? Math.round(config.MaxFileSize / 1024 / 1024)
                : 100;

            res.status(200).json({
                success: true,
                data: {
                    max_file_size_mb: maxFileSizeMB,
                    allowed_file_types: allowedFileTypes.map((type: string) =>
                        type.replace(/^\./, '').toLowerCase()
                    ),
                    price_per_page: config.DefaultPagePrice || 500,
                },
            });
        } catch (error) {
            console.error('[ConfigController] Error getting upload limits:', error);
            // Trả về default values nếu có lỗi
            res.status(200).json({
                success: true,
                data: {
                    max_file_size_mb: 100,
                    allowed_file_types: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'],
                    price_per_page: 500,
                },
            });
        }
    });

    /**
     * Lấy cấu hình hệ thống (Admin only)
     * GET /api/admin/configs
     */
    static getSystemConfig = asyncHandler(async (req: Request, res: Response) => {
        const pool = await getPool();
        if (!pool) {
            throw new InternalServerError('Database connection not available');
        }

        try {
            const result = await pool.request().query(`
                SELECT TOP 1
                    DefaultPagePrice,
                    DefaultPagesPerSemester,
                    AllowedFileTypes,
                    MaxFileSize,
                    A4ToA3Ratio,
                    PagePackages,
                    SemesterStartDate,
                    SemesterEndDate,
                    AutoResetDate
                FROM SystemConfigs
                ORDER BY UpdatedAt DESC
            `);

            if (result.recordset.length === 0) {
                // Return default config if none exists
                return res.status(200).json({
                    success: true,
                    data: {
                        default_page_balance: 100,
                        allowed_file_types: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'],
                        max_file_size_mb: 100,
                        price_per_page: 0,
                        semester_dates: {
                            semester1: null,
                            semester2: null,
                            semester3: null,
                        },
                    },
                });
            }

            const config = result.recordset[0];

            // Parse AllowedFileTypes
            let allowedFileTypes: string[] = [];
            if (config.AllowedFileTypes) {
                try {
                    if (typeof config.AllowedFileTypes === 'string') {
                        allowedFileTypes = JSON.parse(config.AllowedFileTypes);
                    } else {
                        allowedFileTypes = config.AllowedFileTypes;
                    }
                } catch (e) {
                    allowedFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
                }
            } else {
                allowedFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
            }

            // Convert MaxFileSize from bytes to MB
            const maxFileSizeMB = config.MaxFileSize
                ? Math.round(config.MaxFileSize / 1024 / 1024)
                : 100;

            res.status(200).json({
                success: true,
                data: {
                    default_page_balance: config.DefaultPagesPerSemester || 100,
                    allowed_file_types: allowedFileTypes.map((type: string) =>
                        type.replace(/^\./, '').toLowerCase()
                    ),
                    max_file_size_mb: maxFileSizeMB,
                    price_per_page: config.DefaultPagePrice || 0,
                    semester_dates: {
                        semester1: config.SemesterStartDate ? new Date(config.SemesterStartDate).toISOString() : null,
                        semester2: null, // Not in schema, can be added later
                        semester3: null, // Not in schema, can be added later
                    },
                },
            });
        } catch (error) {
            console.error('[ConfigController] Error getting system config:', error);
            throw new InternalServerError('Failed to get system configuration');
        }
    });

    /**
     * Cập nhật cấu hình hệ thống (Admin only)
     * PUT /api/admin/configs
     */
    static updateSystemConfig = asyncHandler(async (req: Request, res: Response) => {
        const pool = await getPool();
        if (!pool) {
            throw new InternalServerError('Database connection not available');
        }

        const {
            default_page_balance,
            allowed_file_types,
            max_file_size_mb,
            price_per_page,
            semester_dates,
        } = req.body;

        try {
            // Get current config or create new one
            const getResult = await pool.request().query(`
                SELECT TOP 1 ConfigID
                FROM SystemConfigs
                ORDER BY UpdatedAt DESC
            `);

            const request = pool.request();

            // Build update fields
            const updateFields: string[] = [];
            
            if (default_page_balance !== undefined) {
                if (typeof default_page_balance !== 'number' || default_page_balance < 0) {
                    throw new BadRequestError('default_page_balance must be a non-negative number');
                }
                updateFields.push('DefaultPagesPerSemester = @defaultPagesPerSemester');
                request.input('defaultPagesPerSemester', sql.Int, default_page_balance);
            }

            if (allowed_file_types !== undefined) {
                if (!Array.isArray(allowed_file_types)) {
                    throw new BadRequestError('allowed_file_types must be an array');
                }
                updateFields.push('AllowedFileTypes = @allowedFileTypes');
                request.input('allowedFileTypes', sql.NVarChar(sql.MAX), JSON.stringify(allowed_file_types));
            }

            if (max_file_size_mb !== undefined) {
                if (typeof max_file_size_mb !== 'number' || max_file_size_mb <= 0) {
                    throw new BadRequestError('max_file_size_mb must be a positive number');
                }
                updateFields.push('MaxFileSize = @maxFileSize');
                request.input('maxFileSize', sql.BigInt, max_file_size_mb * 1024 * 1024); // Convert MB to bytes
            }

            if (price_per_page !== undefined) {
                if (typeof price_per_page !== 'number' || price_per_page < 0) {
                    throw new BadRequestError('price_per_page must be a non-negative number');
                }
                updateFields.push('DefaultPagePrice = @defaultPagePrice');
                request.input('defaultPagePrice', sql.Decimal(10, 2), price_per_page);
            }

            if (semester_dates?.semester1 !== undefined) {
                updateFields.push('SemesterStartDate = @semesterStartDate');
                request.input('semesterStartDate', sql.DateTime, semester_dates.semester1 ? new Date(semester_dates.semester1) : null);
            }

            if (updateFields.length === 0) {
                throw new BadRequestError('No fields to update');
            }

            updateFields.push('UpdatedAt = GETDATE()');

            if (getResult.recordset.length > 0) {
                // Update existing config
                const configId = getResult.recordset[0].ConfigID;
                request.input('configId', sql.UniqueIdentifier, configId);
                
                await request.query(`
                    UPDATE SystemConfigs
                    SET ${updateFields.join(', ')}
                    WHERE ConfigID = @configId
                `);
            } else {
                // Create new config - use provided values or defaults
                const newConfigId = require('crypto').randomUUID();
                request.input('configId', sql.UniqueIdentifier, newConfigId);
                
                // Set defaults for fields not provided
                const finalDefaultPages = default_page_balance !== undefined ? default_page_balance : 100;
                const finalAllowedTypes = allowed_file_types !== undefined 
                    ? JSON.stringify(allowed_file_types) 
                    : JSON.stringify(['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt']);
                const finalMaxFileSize = max_file_size_mb !== undefined 
                    ? max_file_size_mb * 1024 * 1024 
                    : 100 * 1024 * 1024;
                const finalPricePerPage = price_per_page !== undefined ? price_per_page : 0;
                const finalSemesterStart = semester_dates?.semester1 
                    ? new Date(semester_dates.semester1) 
                    : null;
                
                request.input('defaultPagesPerSemester', sql.Int, finalDefaultPages);
                request.input('allowedFileTypes', sql.NVarChar(sql.MAX), finalAllowedTypes);
                request.input('maxFileSize', sql.BigInt, finalMaxFileSize);
                request.input('defaultPagePrice', sql.Decimal(10, 2), finalPricePerPage);
                request.input('semesterStartDate', sql.DateTime, finalSemesterStart);
                
                await request.query(`
                    INSERT INTO SystemConfigs (ConfigID, DefaultPagePrice, DefaultPagesPerSemester, AllowedFileTypes, MaxFileSize, SemesterStartDate, UpdatedAt)
                    VALUES (
                        @configId,
                        @defaultPagePrice,
                        @defaultPagesPerSemester,
                        @allowedFileTypes,
                        @maxFileSize,
                        @semesterStartDate,
                        GETDATE()
                    )
                `);
            }

            // Return updated config
            const updatedResult = await pool.request().query(`
                SELECT TOP 1
                    DefaultPagePrice,
                    DefaultPagesPerSemester,
                    AllowedFileTypes,
                    MaxFileSize,
                    SemesterStartDate
                FROM SystemConfigs
                ORDER BY UpdatedAt DESC
            `);

            const config = updatedResult.recordset[0];
            let allowedFileTypes: string[] = [];
            if (config.AllowedFileTypes) {
                try {
                    if (typeof config.AllowedFileTypes === 'string') {
                        allowedFileTypes = JSON.parse(config.AllowedFileTypes);
                    } else {
                        allowedFileTypes = config.AllowedFileTypes;
                    }
                } catch (e) {
                    allowedFileTypes = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'txt'];
                }
            }

            const maxFileSizeMB = config.MaxFileSize
                ? Math.round(config.MaxFileSize / 1024 / 1024)
                : 100;

            res.status(200).json({
                success: true,
                data: {
                    default_page_balance: config.DefaultPagesPerSemester || 100,
                    allowed_file_types: allowedFileTypes.map((type: string) =>
                        type.replace(/^\./, '').toLowerCase()
                    ),
                    max_file_size_mb: maxFileSizeMB,
                    price_per_page: config.DefaultPagePrice || 0,
                    semester_dates: {
                        semester1: config.SemesterStartDate ? new Date(config.SemesterStartDate).toISOString() : null,
                        semester2: null,
                        semester3: null,
                    },
                },
            });
        } catch (error) {
            console.error('[ConfigController] Error updating system config:', error);
            if (error instanceof BadRequestError) {
                throw error;
            }
            throw new InternalServerError('Failed to update system configuration');
        }
    });

    /**
     * Reset số trang về mặc định cho tất cả sinh viên (Admin only)
     * POST /api/admin/configs/reset-pages
     */
    static resetStudentPages = asyncHandler(async (req: Request, res: Response) => {
        const pool = await getPool();
        if (!pool) {
            throw new InternalServerError('Database connection not available');
        }

        try {
            // Get default pages from config
            const configResult = await pool.request().query(`
                SELECT TOP 1 DefaultPagesPerSemester
                FROM SystemConfigs
                ORDER BY UpdatedAt DESC
            `);

            const defaultPages = configResult.recordset.length > 0 
                ? (configResult.recordset[0].DefaultPagesPerSemester || 100)
                : 100;

            // Reset all student balances
            const updateResult = await pool.request()
                .input('defaultPages', sql.Int, defaultPages)
                .query(`
                    UPDATE PageBalances
                    SET CurrentBalance = @defaultPages,
                        DefaultPages = @defaultPages,
                        UsedPages = 0,
                        LastUpdated = GETDATE()
                `);

            res.status(200).json({
                success: true,
                data: {
                    resetCount: updateResult.rowsAffected[0] || 0,
                },
            });
        } catch (error) {
            console.error('[ConfigController] Error resetting student pages:', error);
            throw new InternalServerError('Failed to reset student pages');
        }
    });
}

