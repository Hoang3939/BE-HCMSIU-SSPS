/**
 * History Routes
 * Định nghĩa routes cho module History
 */

import { Router } from 'express';
import { HistoryController } from '../controllers/history.controller.js';
import { authRequired } from '../middleware/auth.js';

const router = Router();

/**
 * @openapi
 * /api/history/transactions:
 *   get:
 *     summary: Lấy lịch sử giao dịch của sinh viên
 *     description: Trả về danh sách các giao dịch nạp tiền của sinh viên đã đăng nhập
 *     tags:
 *       - History
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách giao dịch
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       transID:
 *                         type: string
 *                         format: uuid
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       amount:
 *                         type: number
 *                       pagesAdded:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [PENDING, COMPLETED, FAILED, REFUNDED]
 *                       paymentMethod:
 *                         type: string
 *                         nullable: true
 *                       paymentRef:
 *                         type: string
 *                         nullable: true
 *       401:
 *         description: Unauthorized
 */
router.get(
  '/transactions',
  authRequired,
  HistoryController.getTransactionHistory
);

/**
 * @openapi
 * /api/history/prints:
 *   get:
 *     summary: Lấy lịch sử in ấn của sinh viên
 *     description: Trả về danh sách các lệnh in của sinh viên đã đăng nhập
 *     tags:
 *       - History
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Danh sách lệnh in
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       jobID:
 *                         type: string
 *                         format: uuid
 *                       date:
 *                         type: string
 *                         format: date-time
 *                       documentName:
 *                         type: string
 *                       printerName:
 *                         type: string
 *                       pagesUsed:
 *                         type: integer
 *                       status:
 *                         type: string
 *                         enum: [PENDING, PROCESSING, COMPLETED, FAILED, CANCELLED]
 *                       cost:
 *                         type: number
 *       401:
 *         description: Unauthorized
 */
router.get('/prints', authRequired, HistoryController.getPrintHistory);

export default router;

