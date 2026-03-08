import express from 'express';
import * as mapController from '../../controllers/map.controller.js';
import { authRequired, requireRole } from '../../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * tags:
 *   - name: Admin - Map
 *     description: API quản lý vị trí máy in trên bản đồ
 */

// GET /api/admin/map/printers - Get all printers with locations
router.get('/printers', authRequired, requireRole('ADMIN', 'SPSO'), mapController.getPrintersWithLocations);

// GET /api/admin/map/printers/:printerId - Get map location for a printer
router.get('/printers/:printerId', authRequired, requireRole('ADMIN', 'SPSO'), mapController.getMapLocation);

// PUT /api/admin/map/printers/:printerId - Create or update map location
router.put('/printers/:printerId', authRequired, requireRole('ADMIN', 'SPSO'), mapController.upsertMapLocation);

// DELETE /api/admin/map/printers/:printerId - Delete map location
router.delete('/printers/:printerId', authRequired, requireRole('ADMIN', 'SPSO'), mapController.deleteMapLocation);

export default router;

