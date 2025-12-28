/**
 * Payment Routes
 * Định nghĩa routes cho module Payment
 */

import { Router } from 'express';
import { PaymentController } from '../controllers/payment.controller.js';
import { verifySePayWebhook } from '../middleware/sepayAuth.middleware.js';

const router = Router();

/**
 * @swagger
 * tags:
 *   name: Payment
 *   description: API endpoints for payment processing
 */

/**
 * @swagger
 * /api/payment/create:
 *   post:
 *     summary: Tạo giao dịch thanh toán và QR code
 *     tags: [Payment]
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: StudentID (GUID) của sinh viên
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - amount
 *               - pageQuantity
 *             properties:
 *               amount:
 *                 type: number
 *                 description: Số tiền thanh toán (2,000 - 500,000 VNĐ)
 *                 example: 10000
 *               pageQuantity:
 *                 type: integer
 *                 description: Số trang muốn mua (10 - 500 trang)
 *                 example: 50
 *     responses:
 *       201:
 *         description: Giao dịch đã được tạo thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     transId:
 *                       type: string
 *                       format: uuid
 *                       example: "5f31d48a-ebb0-4290-a23b-0123456789ab"
 *                     qrUrl:
 *                       type: string
 *                       example: "https://img.vietqr.io/image/BIDV-96247SSPS-compact2.png?amount=10000&addInfo=SSPS%205f31d48a-ebb0-4290-a23b-0123456789ab"
 *       400:
 *         description: Dữ liệu không hợp lệ hoặc thiếu header x-student-id
 */
router.post('/create', PaymentController.createPayment);

/**
 * @swagger
 * /api/payment/sepay-webhook:
 *   post:
 *     summary: Webhook nhận thông báo từ SePay (Internal - không dùng trực tiếp)
 *     tags: [Payment]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               id:
 *                 type: integer
 *               gateway:
 *                 type: string
 *               transactionDate:
 *                 type: string
 *               accountNumber:
 *                 type: string
 *               content:
 *                 type: string
 *               transferType:
 *                 type: string
 *                 enum: [in, out]
 *               transferAmount:
 *                 type: number
 *               referenceCode:
 *                 type: string
 *               description:
 *                 type: string
 *     responses:
 *       200:
 *         description: Webhook đã được xử lý
 *       401:
 *         description: Invalid API key
 */
// Test endpoint để verify route hoạt động (không cần auth)
router.get('/test', (req, res) => {
  const sepayApiKey = process.env.SEPAY_API_KEY;
  res.json({ 
    message: 'Payment routes are working!', 
    path: req.path, 
    url: req.url,
    webhookEndpoint: '/api/payment/sepay-webhook',
    method: 'POST',
    sepayApiKeyConfigured: !!sepayApiKey,
    sepayApiKeyPreview: sepayApiKey ? `${sepayApiKey.substring(0, 4)}...${sepayApiKey.substring(sepayApiKey.length - 4)}` : 'NOT SET',
    note: 'Webhook requires Authorization header: Apikey <SEPAY_API_KEY>'
  });
});

// Webhook endpoint - yêu cầu POST + Authorization header
router.post('/sepay-webhook', verifySePayWebhook, PaymentController.handleWebhook);

/**
 * @swagger
 * /api/payment/status/{transId}:
 *   get:
 *     summary: Kiểm tra trạng thái giao dịch
 *     tags: [Payment]
 *     parameters:
 *       - in: path
 *         name: transId
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: Transaction ID
 *     responses:
 *       200:
 *         description: Trạng thái giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     status:
 *                       type: string
 *                       enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *                       example: "COMPLETED"
 *                     pages:
 *                       type: integer
 *                       example: 50
 *       404:
 *         description: Không tìm thấy giao dịch
 */
router.get('/status/:transId', PaymentController.getStatus);

export default router;

