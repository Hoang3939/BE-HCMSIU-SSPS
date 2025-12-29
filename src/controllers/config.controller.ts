/**
 * Config Controller
 * Controller để xử lý các request liên quan đến cấu hình hệ thống
 */

import { Request, Response } from 'express';
import { asyncHandler } from '../middleware/asyncHandler.middleware.js';
import { getPool } from '../config/database.js';
import sql from 'mssql';
import { InternalServerError } from '../errors/AppError.js';

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
}

