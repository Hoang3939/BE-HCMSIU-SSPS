import sql from 'mssql';
import { getPool } from '../config/database.js';
import type { Printer, CreatePrinterDto, UpdatePrinterDto, PrinterQueryParams, PaginatedResponse } from '../types/printer.js';

/**
 * Service layer for Printer - Handle database operations
 */

/**
 * Validate if LocationID exists in PrinterLocations table
 */
async function validateLocationID(locationID: string | null | undefined): Promise<void> {
  if (!locationID) {
    return; // null is allowed
  }

  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  const result = await pool
    .request()
    .input('locationID', sql.UniqueIdentifier, locationID)
    .query('SELECT LocationID FROM PrinterLocations WHERE LocationID = @locationID');

  if (result.recordset.length === 0) {
    throw new Error(`LocationID '${locationID}' does not exist in PrinterLocations table`);
  }
}

/**
 * Get list of printers with pagination and filters
 */
export async function getPrinters(params: PrinterQueryParams = {}): Promise<PaginatedResponse<Printer>> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  const page = params.page || 1;
  const limit = params.limit || 10;
  const offset = (page - 1) * limit;

  // Xây dựng query với filters
  let whereConditions: string[] = [];

  const countRequest = pool.request();
  const dataRequest = pool.request();

  if (params.status) {
    whereConditions.push('p.Status = @status');
    countRequest.input('status', sql.NVarChar, params.status);
    dataRequest.input('status', sql.NVarChar, params.status);
  }

  if (params.isActive !== undefined) {
    whereConditions.push('p.IsActive = @isActive');
    countRequest.input('isActive', sql.Bit, params.isActive);
    dataRequest.input('isActive', sql.Bit, params.isActive);
  }

  if (params.search) {
    whereConditions.push('(p.Name LIKE @search OR p.Brand LIKE @search OR p.Model LIKE @search)');
    const searchValue = `%${params.search}%`;
    countRequest.input('search', sql.NVarChar, searchValue);
    dataRequest.input('search', sql.NVarChar, searchValue);
  }

  const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

  // Query để đếm tổng số records
  const countQuery = `
    SELECT COUNT(*) as total
    FROM Printers p
    ${whereClause}
  `;

  // Query để lấy data
  const dataQuery = `
    SELECT 
      p.PrinterID,
      p.Name,
      p.Brand,
      p.Model,
      p.Description,
      p.Status,
      p.IPAddress,
      p.CUPSPrinterName,
      p.LocationID,
      p.IsActive,
      p.CreatedAt,
      p.UpdatedAt
    FROM Printers p
    ${whereClause}
    ORDER BY p.CreatedAt DESC
    OFFSET @offset ROWS
    FETCH NEXT @limit ROWS ONLY
  `;

  // Thêm pagination parameters cho data query
  dataRequest.input('offset', sql.Int, offset);
  dataRequest.input('limit', sql.Int, limit);

  // Thực thi queries
  const [countResult, dataResult] = await Promise.all([
    countRequest.query(countQuery),
    dataRequest.query(dataQuery)
  ]);

  const total = countResult.recordset[0].total;
  const totalPages = Math.ceil(total / limit);

  return {
    data: dataResult.recordset.map(mapPrinterFromDb),
    pagination: {
      page,
      limit,
      total,
      totalPages,
    },
  };
}

/**
 * Get printer details by ID
 */
export async function getPrinterById(printerId: string): Promise<Printer | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  const result = await pool
    .request()
    .input('printerId', sql.UniqueIdentifier, printerId)
    .query(`
      SELECT 
        PrinterID,
        Name,
        Brand,
        Model,
        Description,
        Status,
        IPAddress,
        CUPSPrinterName,
        LocationID,
        IsActive,
        CreatedAt,
        UpdatedAt
      FROM Printers
      WHERE PrinterID = @printerId
    `);

  if (result.recordset.length === 0) {
    return null;
  }

  return mapPrinterFromDb(result.recordset[0]);
}

/**
 * Create a new printer
 */
export async function createPrinter(data: CreatePrinterDto): Promise<Printer> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  // Validate LocationID if provided
  if (data.LocationID) {
    await validateLocationID(data.LocationID);
  }

  const locationIDValue = data.LocationID || null;

  const result = await pool
    .request()
    .input('name', sql.NVarChar, data.Name)
    .input('brand', sql.NVarChar, data.Brand || null)
    .input('model', sql.NVarChar, data.Model || null)
    .input('description', sql.NVarChar(sql.MAX), data.Description || null)
    .input('status', sql.NVarChar, data.Status || 'OFFLINE')
    .input('ipAddress', sql.NVarChar, data.IPAddress || null)
    .input('cupsPrinterName', sql.NVarChar, data.CUPSPrinterName || null)
    .input('locationID', sql.UniqueIdentifier, locationIDValue)
    .input('isActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : true)
    .query(`
      INSERT INTO Printers (Name, Brand, Model, Description, Status, IPAddress, CUPSPrinterName, LocationID, IsActive)
      OUTPUT INSERTED.*
      VALUES (@name, @brand, @model, @description, @status, @ipAddress, @cupsPrinterName, @locationID, @isActive)
    `);

  return mapPrinterFromDb(result.recordset[0]);
}

/**
 * Update printer information
 */
export async function updatePrinter(printerId: string, data: UpdatePrinterDto): Promise<Printer | null> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  // Validate LocationID if provided
  if (data.LocationID !== undefined && data.LocationID !== null) {
    await validateLocationID(data.LocationID);
  }

  // Build dynamic update query
  const updateFields: string[] = [];
  const request = pool.request().input('printerId', sql.UniqueIdentifier, printerId);

  if (data.Name !== undefined) {
    updateFields.push('Name = @name');
    request.input('name', sql.NVarChar, data.Name);
  }
  if (data.Brand !== undefined) {
    updateFields.push('Brand = @brand');
    request.input('brand', sql.NVarChar, data.Brand);
  }
  if (data.Model !== undefined) {
    updateFields.push('Model = @model');
    request.input('model', sql.NVarChar, data.Model);
  }
  if (data.Description !== undefined) {
    updateFields.push('Description = @description');
    request.input('description', sql.NVarChar(sql.MAX), data.Description);
  }
  if (data.Status !== undefined) {
    updateFields.push('Status = @status');
    request.input('status', sql.NVarChar, data.Status);
  }
  if (data.IPAddress !== undefined) {
    updateFields.push('IPAddress = @ipAddress');
    request.input('ipAddress', sql.NVarChar, data.IPAddress);
  }
  if (data.CUPSPrinterName !== undefined) {
    updateFields.push('CUPSPrinterName = @cupsPrinterName');
    request.input('cupsPrinterName', sql.NVarChar, data.CUPSPrinterName);
  }
  if (data.LocationID !== undefined) {
    updateFields.push('LocationID = @locationID');
    request.input('locationID', sql.UniqueIdentifier, data.LocationID || null);
  }
  if (data.IsActive !== undefined) {
    updateFields.push('IsActive = @isActive');
    request.input('isActive', sql.Bit, data.IsActive);
  }

  if (updateFields.length === 0) {
    // No fields to update, return current printer
    return getPrinterById(printerId);
  }

  // UpdatedAt will be automatically updated by trigger
  updateFields.push('UpdatedAt = GETDATE()');

  const result = await request.query(`
    UPDATE Printers
    SET ${updateFields.join(', ')}
    OUTPUT INSERTED.*
    WHERE PrinterID = @printerId
  `);

  if (result.recordset.length === 0) {
    return null;
  }

  return mapPrinterFromDb(result.recordset[0]);
}

/**
 * Delete a printer
 */
export async function deletePrinter(printerId: string): Promise<boolean> {
  const pool = getPool();
  if (!pool) {
    throw new Error('Database connection not available');
  }

  const result = await pool
    .request()
    .input('printerId', sql.UniqueIdentifier, printerId)
    .query('DELETE FROM Printers WHERE PrinterID = @printerId');

  return result.rowsAffected[0] > 0;
}

/**
 * Map database record to Printer object
 */
function mapPrinterFromDb(record: any): Printer {
  return {
    PrinterID: record.PrinterID,
    Name: record.Name,
    Brand: record.Brand,
    Model: record.Model,
    Description: record.Description,
    Status: record.Status,
    IPAddress: record.IPAddress,
    CUPSPrinterName: record.CUPSPrinterName,
    LocationID: record.LocationID,
    IsActive: record.IsActive,
    CreatedAt: record.CreatedAt,
    UpdatedAt: record.UpdatedAt,
  };
}

