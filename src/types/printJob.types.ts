/**
 * Print Job Types
 * Định nghĩa các types cho module Print Jobs
 */

export type PaperSize = 'A4' | 'A3';
export type PrintSide = 'ONE_SIDED' | 'DOUBLE_SIDED';
export type Orientation = 'PORTRAIT' | 'LANDSCAPE';
export type PrintJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface CreatePrintJobRequest {
  printerId: string;
  documentId: string;
  copies?: number;
  paperSize?: PaperSize;
  side?: PrintSide;
  orientation?: Orientation;
  pageRange?: string;
  studentId: string;
}

export interface CreatePrintJobResponse {
  id: string;
  status: PrintJobStatus;
  totalCost: number;
  message: string;
}

export interface PrintJob {
  JobID: string;
  StudentID: string;
  PrinterID: string;
  DocumentID: string;
  ConfigID: string;
  TotalPages: number;
  Cost: number;
  Status: PrintJobStatus;
  CreatedAt: Date;
  UpdatedAt: Date;
}

