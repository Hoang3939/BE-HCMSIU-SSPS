/**
 * Types for Printer Management
 */

export interface Printer {
  PrinterID: string;
  Name: string;
  Brand: string | null;
  Model: string | null;
  Description: string | null;
  Status: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';
  IPAddress: string | null;
  CUPSPrinterName: string | null;
  LocationID: string | null;
  IsActive: boolean;
  CreatedAt: Date | string;
  UpdatedAt: Date | string;
}

export interface CreatePrinterDto {
  Name: string;
  Brand?: string;
  Model?: string;
  Description?: string;
  Status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';
  IPAddress?: string;
  CUPSPrinterName?: string;
  LocationID?: string;
  IsActive?: boolean;
}

export interface UpdatePrinterDto {
  Name?: string;
  Brand?: string;
  Model?: string;
  Description?: string;
  Status?: 'AVAILABLE' | 'BUSY' | 'OFFLINE' | 'MAINTENANCE' | 'ERROR';
  IPAddress?: string;
  CUPSPrinterName?: string;
  LocationID?: string | null;
  IsActive?: boolean;
}

export interface PrinterQueryParams {
  page?: number;
  limit?: number;
  status?: string;
  search?: string;
  isActive?: boolean;
}

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

