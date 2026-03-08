/**
 * Payment Types
 * Định nghĩa các types cho module Payment
 */

export interface CreatePaymentRequest {
  amount: number;
  pageQuantity: number;
}

export interface PaymentResponse {
  transId: string;
  qrUrl: string;
}

export interface SePayWebhookPayload {
  id: number;
  gateway: string;
  transactionDate: string;
  accountNumber: string;
  subAccount: string | null;
  code: string | null;
  content: string; // Nội dung đã được SePay xử lý
  transferType: 'in' | 'out';
  transferAmount: number; // Số tiền thực nhận
  accumulated: number | null;
  referenceCode: string;
  description: string; // Nội dung gốc từ ngân hàng
}

export interface PaymentStatusResponse {
  status: 'PENDING' | 'COMPLETED' | 'FAILED' | 'REFUNDED';
  pages: number;
}

