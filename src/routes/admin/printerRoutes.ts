import express from 'express';
import * as printerController from '../../controllers/printerController.js';
import { authRequired, requireRole } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin - Printers
 *     description: API quản lý máy in cho Admin
 */

// All routes require authentication and ADMIN/SPSO role
router.use(authRequired);
router.use(requireRole('ADMIN', 'SPSO'));

// GET /api/admin/printers - Lấy danh sách máy in
router.get('/', printerController.getPrinters);

// GET /api/admin/printers/:id - Lấy chi tiết máy in
router.get('/:id', printerController.getPrinterById);

// POST /api/admin/printers - Tạo máy in mới
router.post('/', printerController.createPrinter);

// PUT /api/admin/printers/:id - Cập nhật máy in
router.put('/:id', printerController.updatePrinter);

// DELETE /api/admin/printers/:id - Xóa máy in
router.delete('/:id', printerController.deletePrinter);

export default router;

