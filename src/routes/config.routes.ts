/**
 * Config Routes
 * Routes cho các endpoint cấu hình hệ thống
 */

import { Router } from 'express';
import { ConfigController } from '../controllers/config.controller.js';

const router = Router();

// Public endpoint - không cần authentication
router.get('/upload-limits', ConfigController.getUploadLimits);

export default router;

