/**
 * Map Location Service
 * Handle database operations for MapLocations
 */

import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../config/database.js';
import type { MapLocation, CreateMapLocationDto, UpdateMapLocationDto, PrinterWithLocation } from '../types/map.types.js';

/**
 * Get map location by printer ID
 */
export async function getMapLocationByPrinterId(printerId: string): Promise<MapLocation | null> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('printerId', sql.UniqueIdentifier, printerId)
    .query(`
      SELECT 
        MapLocationID,
        PrinterID,
        X,
        Y,
        Floor,
        Building,
        Room,
        Description
      FROM MapLocations
      WHERE PrinterID = @printerId
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  const row = result.recordset[0];
  return {
    MapLocationID: row.MapLocationID,
    PrinterID: row.PrinterID,
    X: row.X,
    Y: row.Y,
    Floor: row.Floor,
    Building: row.Building,
    Room: row.Room,
    Description: row.Description,
  };
}

/**
 * Get all printers with their map locations
 */
export async function getPrintersWithLocations(building?: string, floor?: number): Promise<PrinterWithLocation[]> {
  const pool = await getPool();
  
  let whereClause = '';
  const request = pool.request();
  
  if (building) {
    whereClause += ' AND ml.Building = @building';
    request.input('building', sql.NVarChar, building);
  }
  
  if (floor !== undefined) {
    whereClause += ' AND ml.Floor = @floor';
    request.input('floor', sql.Int, floor);
  }

  const result = await request.query(`
    SELECT 
      p.PrinterID,
      p.Name,
      p.Status,
      ml.MapLocationID,
      ml.X,
      ml.Y,
      ml.Floor,
      ml.Building,
      ml.Room
    FROM Printers p
    LEFT JOIN MapLocations ml ON p.PrinterID = ml.PrinterID
    WHERE p.IsActive = 1
    ${whereClause}
    ORDER BY p.Name
  `);

  return result.recordset.map((row: any) => ({
    PrinterID: row.PrinterID,
    Name: row.Name,
    Status: row.Status,
    MapLocationID: row.MapLocationID || null,
    X: row.X || null,
    Y: row.Y || null,
    Floor: row.Floor || null,
    Building: row.Building || null,
    Room: row.Room || null,
  }));
}

/**
 * Create or update map location for a printer
 */
export async function upsertMapLocation(printerId: string, data: CreateMapLocationDto | UpdateMapLocationDto): Promise<MapLocation> {
  const pool = await getPool();
  const transaction = new sql.Transaction(pool);

  try {
    await transaction.begin();

    // Check if location already exists
    const existingResult = await transaction
      .request()
      .input('printerId', sql.UniqueIdentifier, printerId)
      .query('SELECT MapLocationID FROM MapLocations WHERE PrinterID = @printerId');

    if (existingResult.recordset.length > 0) {
      // Update existing location
      const mapLocationId = existingResult.recordset[0].MapLocationID;
      
      const updateData: UpdateMapLocationDto = {
        X: (data as CreateMapLocationDto).X ?? (data as UpdateMapLocationDto).X,
        Y: (data as CreateMapLocationDto).Y ?? (data as UpdateMapLocationDto).Y,
        Floor: (data as CreateMapLocationDto).Floor ?? (data as UpdateMapLocationDto).Floor,
        Building: (data as CreateMapLocationDto).Building ?? (data as UpdateMapLocationDto).Building,
        Room: (data as CreateMapLocationDto).Room ?? (data as UpdateMapLocationDto).Room,
        Description: data.Description,
      };

      const updateRequest = transaction.request();
      const updateFields: string[] = [];
      
      if (updateData.X !== undefined) {
        updateFields.push('X = @x');
        updateRequest.input('x', sql.Float, updateData.X);
      }
      if (updateData.Y !== undefined) {
        updateFields.push('Y = @y');
        updateRequest.input('y', sql.Float, updateData.Y);
      }
      if (updateData.Floor !== undefined) {
        updateFields.push('Floor = @floor');
        updateRequest.input('floor', sql.Int, updateData.Floor);
      }
      if (updateData.Building !== undefined) {
        updateFields.push('Building = @building');
        updateRequest.input('building', sql.NVarChar, updateData.Building || '');
      }
      if (updateData.Room !== undefined) {
        updateFields.push('Room = @room');
        updateRequest.input('room', sql.NVarChar, updateData.Room || '');
      }
      if (updateData.Description !== undefined) {
        updateFields.push('Description = @description');
        updateRequest.input('description', sql.NVarChar, updateData.Description || null);
      }

      updateRequest.input('mapLocationId', sql.UniqueIdentifier, mapLocationId);
      
      await updateRequest.query(`
        UPDATE MapLocations
        SET ${updateFields.join(', ')}
        WHERE MapLocationID = @mapLocationId
      `);

      await transaction.commit();

      // Return updated location
      const updated = await getMapLocationByPrinterId(printerId);
      if (!updated) {
        throw new Error('Failed to retrieve updated map location');
      }
      return updated;
    } else {
      // Create new location
      const createData = data as CreateMapLocationDto;
      
      if (createData.X === undefined || createData.Y === undefined) {
        throw new Error('X and Y coordinates are required for creating map location');
      }

      // Generate UUID for MapLocationID
      const mapLocationId = randomUUID();

      await transaction
        .request()
        .input('mapLocationId', sql.UniqueIdentifier, mapLocationId)
        .input('printerId', sql.UniqueIdentifier, printerId)
        .input('x', sql.Float, createData.X)
        .input('y', sql.Float, createData.Y)
        .input('floor', sql.Int, createData.Floor ?? 0)
        .input('building', sql.NVarChar, createData.Building || '')
        .input('room', sql.NVarChar, createData.Room || '')
        .input('description', sql.NVarChar, createData.Description || null)
        .query(`
          INSERT INTO MapLocations (MapLocationID, PrinterID, X, Y, Floor, Building, Room, Description)
          VALUES (@mapLocationId, @printerId, @x, @y, @floor, @building, @room, @description)
        `);

      await transaction.commit();

      const created = await getMapLocationByPrinterId(printerId);
      if (!created) {
        throw new Error('Failed to retrieve created map location');
      }
      return created;
    }
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
}

/**
 * Delete map location by printer ID
 */
export async function deleteMapLocation(printerId: string): Promise<boolean> {
  const pool = await getPool();
  const result = await pool
    .request()
    .input('printerId', sql.UniqueIdentifier, printerId)
    .query('DELETE FROM MapLocations WHERE PrinterID = @printerId');

  return result.rowsAffected[0] > 0;
}

