/**
 * System Configuration Types
 * Định nghĩa các types cho quản lý cấu hình hệ thống
 */

export interface SystemConfig {
  default_page_balance: number;
  allowed_file_types: string[];
  max_file_size_mb: number;
  price_per_page: number;
  semester_dates: {
    semester1: string; // ISO8601 format - Học kỳ 1
    semester2: string; // ISO8601 format - Học kỳ 2
    semester3: string; // ISO8601 format - Học kỳ phụ
  };
}

export interface UpdateSystemConfigRequest {
  default_page_balance?: number;
  allowed_file_types?: string[];
  max_file_size_mb?: number;
  price_per_page?: number;
  semester_dates?: {
    semester1?: string;
    semester2?: string;
    semester3?: string;
  };
}

export interface SystemConfigResponse {
  success: boolean;
  data: SystemConfig;
  message?: string;
}

