/**
 * Map Location Controller
 * Handle HTTP requests for map location management
 */

import type { Request, Response } from 'express';
import * as mapService from '../services/map.service.js';
import { authRequired, requireRole } from '../middleware/auth.js';
import type { CreateMapLocationDto, UpdateMapLocationDto } from '../types/map.types.js';

/**
 * GET /api/admin/map/printers
 * Get all printers with their map locations
 */
export async function getPrintersWithLocations(req: Request, res: Response): Promise<void> {
  try {
    const building = req.query.building as string | undefined;
    const floor = req.query.floor ? parseInt(req.query.floor as string) : undefined;

    const printers = await mapService.getPrintersWithLocations(building, floor);
    res.status(200).json({
      success: true,
      data: printers,
    });
  } catch (error) {
    console.error('[mapController] Error getting printers with locations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/admin/map/printers/:printerId
 * Get map location for a specific printer
 */
export async function getMapLocation(req: Request, res: Response): Promise<void> {
  try {
    const { printerId } = req.params;

    if (!printerId) {
      res.status(400).json({
        success: false,
        error: 'Printer ID is required',
      });
      return;
    }

    const location = await mapService.getMapLocationByPrinterId(printerId);

    if (!location) {
      res.status(404).json({
        success: false,
        error: 'Map location not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('[mapController] Error getting map location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * PUT /api/admin/map/printers/:printerId
 * Create or update map location for a printer
 */
export async function upsertMapLocation(req: Request, res: Response): Promise<void> {
  try {
    const { printerId } = req.params;
    const data: CreateMapLocationDto | UpdateMapLocationDto = req.body;

    if (!printerId) {
      res.status(400).json({
        success: false,
        error: 'Printer ID is required',
      });
      return;
    }

    const location = await mapService.upsertMapLocation(printerId, data);

    res.status(200).json({
      success: true,
      data: location,
    });
  } catch (error) {
    console.error('[mapController] Error upserting map location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * DELETE /api/admin/map/printers/:printerId
 * Delete map location for a printer
 */
export async function deleteMapLocation(req: Request, res: Response): Promise<void> {
  try {
    const { printerId } = req.params;

    if (!printerId) {
      res.status(400).json({
        success: false,
        error: 'Printer ID is required',
      });
      return;
    }

    const deleted = await mapService.deleteMapLocation(printerId);

    if (!deleted) {
      res.status(404).json({
        success: false,
        error: 'Map location not found',
      });
      return;
    }

    res.status(200).json({
      success: true,
      message: 'Map location deleted successfully',
    });
  } catch (error) {
    console.error('[mapController] Error deleting map location:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * GET /api/printers/map
 * Public endpoint for students to get printers with locations
 */
export async function getPublicPrintersWithLocations(req: Request, res: Response): Promise<void> {
  try {
    const building = req.query.building as string | undefined;
    const floor = req.query.floor ? parseInt(req.query.floor as string) : undefined;

    const printers = await mapService.getPrintersWithLocations(building, floor);
    res.status(200).json({
      success: true,
      data: printers,
    });
  } catch (error) {
    console.error('[mapController] Error getting public printers with locations:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

