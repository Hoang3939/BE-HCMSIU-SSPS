/**
 * Print Job Routes
 * Định nghĩa routes cho module Print Jobs
 */

import { Router } from 'express';
import { PrintJobController } from '../controllers/printJob.controller.js';

const router = Router();

/**
 * @openapi
 * /api/print-jobs/create:
 *   post:
 *     summary: Tạo lệnh in với cấu hình chi tiết
 *     description: |
 *       Giai đoạn 2: Cấu hình in & thanh toán
 *       
 *       Server: http://localhost:3001
 *       
 *       Hệ thống sẽ:
 *       - Kiểm tra máy in có hoạt động không
 *       - Kiểm tra tài liệu có tồn tại không
 *       - Tính toán chi phí dựa trên các tham số
 *       - Kiểm tra số dư tài khoản
 *       - Trừ quỹ giấy nếu đủ
 *       - Tạo lệnh in
 *     tags:
 *       - Print Jobs
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - printerId
 *               - documentId
 *             properties:
 *               printerId:
 *                 type: string
 *                 description: ID của máy in đích
 *               documentId:
 *                 type: string
 *                 description: ID của tài liệu đã upload
 *               copies:
 *                 type: integer
 *                 minimum: 1
 *                 default: 1
 *               paperSize:
 *                 type: string
 *                 enum: [A4, A3]
 *                 default: A4
 *               side:
 *                 type: string
 *                 enum: [ONE_SIDED, DOUBLE_SIDED]
 *                 default: ONE_SIDED
 *               orientation:
 *                 type: string
 *                 enum: [PORTRAIT, LANDSCAPE]
 *                 default: PORTRAIT
 *               pageRange:
 *                 type: string
 *                 nullable: true
 *                 description: 'Phạm vi trang cần in (ví dụ: "1-5, 8")'
 *     responses:
 *       201:
 *         description: Tạo lệnh in thành công
 *       400:
 *         description: Lỗi validation
 *       402:
 *         description: Tài khoản không đủ số lượng trang in
 *       404:
 *         description: Không tìm thấy máy in hoặc tài liệu
 *       500:
 *         description: Lỗi server
 */
router.post('/create', PrintJobController.create);

export default router;
