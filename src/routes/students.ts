/**
 * Student Routes
 * Định nghĩa routes cho module Students
 */

import { Router } from 'express';
import { StudentController } from '../controllers/student.controller.js';

const router = Router();

/**
 * @openapi
 * /api/student/balance:
 *   get:
 *     summary: Lấy số dư trang của sinh viên
 *     description: |
 *       Server: http://localhost:3001
 *       
 *       Trả về số trang A4 còn lại trong tài khoản của sinh viên
 *     tags:
 *       - Students
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: Số dư trang
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 balancePages:
 *                   type: number
 *                   description: Số trang A4 còn lại
 *       404:
 *         description: Không tìm thấy số dư
 */
router.get('/balance', StudentController.getBalance);

export default router;
