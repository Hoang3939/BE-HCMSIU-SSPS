/**
 * History Types
 * Định nghĩa types cho module History
 */

export interface TransactionHistoryItem {
  transID: string;
  date: string; // ISO datetime string
  amount: number;
  pagesAdded: number;
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  paymentMethod: string | null;
  paymentRef: string | null;
}

export interface PrintHistoryItem {
  jobID: string;
  date: string; // ISO datetime string
  documentName: string;
  printerName: string;
  pagesUsed: number;
  status: 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  cost: number;
}

export interface TransactionHistoryResponse {
  success: boolean;
  data: TransactionHistoryItem[];
  message?: string;
}

export interface PrintHistoryResponse {
  success: boolean;
  data: PrintHistoryItem[];
  message?: string;
}

