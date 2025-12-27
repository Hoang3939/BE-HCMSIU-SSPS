/**
 * Document Routes
 * Định nghĩa routes cho module Documents
 */

import { Router } from 'express';
import { DocumentController } from '../controllers/document.controller.js';
import { upload } from '../utils/fileUpload.js';

const router = Router();

// Middleware Multer cho upload
export const uploadMiddleware = upload;

/**
 * @openapi
 * /api/documents/upload:
 *   post:
 *     summary: Upload tài liệu lên hệ thống
 *     description: |
 *       Giai đoạn 1: Tải lên và kiểm tra tài liệu
 *       
 *       Server: http://localhost:3001
 *       
 *       Hệ thống sẽ:
 *       - Kiểm tra định dạng file (chỉ chấp nhận PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)
 *       - Kiểm tra dung lượng (tối đa 100MB)
 *       - Lưu file vào storage
 *       - Đếm số trang tự động
 *       - Trả về thông tin tài liệu
 *     tags:
 *       - Documents
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
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: File tài liệu cần upload (PDF, DOCX, PPTX, XLS, XLSX, TXT)
 *     responses:
 *       200:
 *         description: Tải lên thành công
 *       400:
 *         description: Không có file được upload
 *       413:
 *         description: File quá lớn
 *       415:
 *         description: Định dạng file không được hỗ trợ
 *       500:
 *         description: Lỗi server khi xử lý file
 */
router.post('/upload', upload.single('file'), DocumentController.upload);

/**
 * @openapi
 * /api/documents/{documentId}:
 *   get:
 *     summary: Lấy thông tin tài liệu đã upload
 *     description: |
 *       Server: http://localhost:3001
 *       
 *       Lấy thông tin chi tiết của tài liệu đã upload
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: documentId
 *         schema:
 *           type: string
 *         required: true
 *         description: ID của tài liệu
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: Thông tin tài liệu
 *       404:
 *         description: Không tìm thấy tài liệu
 */
router.get('/:documentId', DocumentController.getDocument);

/**
 * @openapi
 * /api/documents/{documentId}/preview:
 *   get:
 *     summary: Lấy file document để preview
 *     description: Trả về file document (PDF hoặc convert sang PDF) để preview
 *     tags:
 *       - Documents
 *     parameters:
 *       - in: path
 *         name: documentId
 *         required: true
 *         schema:
 *           type: string
 *         description: ID của document
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: File document để preview
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Không tìm thấy document
 *       500:
 *         description: Lỗi server
 */
router.get('/:documentId/preview', DocumentController.getPreview);

export default router;
