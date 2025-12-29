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

  const pool = await getPool();
  const result = await pool
    .request()
    .input('locationID', sql.UniqueIdentifier, locationID)
    .query('SELECT LocationID FROM PrinterLocations WHERE LocationID = @locationID');

  if (result.recordset.length === 0) {
    throw new Error(`LocationID '${locationID}' does not exist in PrinterLocations table`);
  }
}

/**
 * Check if a printer with the same Name or IPAddress already exists
 * @throws Error with code 'DUPLICATE_NAME' or 'DUPLICATE_IP' if duplicate found
 */
async function checkDuplicatePrinter(name: string, ipAddress: string | null | undefined, excludePrinterId?: string): Promise<void> {
  console.log('[Backend Service] checkDuplicatePrinter: Starting check', {
    name,
    ipAddress,
    excludePrinterId
  });
  
  try {
    const pool = await getPool();
    const request = pool.request();
    
    // Check for duplicate Name
    let nameQuery = 'SELECT PrinterID, Name FROM Printers WHERE Name = @name';
    if (excludePrinterId) {
      nameQuery += ' AND PrinterID != @excludePrinterId';
      request.input('excludePrinterId', sql.UniqueIdentifier, excludePrinterId);
    }
    request.input('name', sql.NVarChar, name);
    
    console.log('[Backend Service] checkDuplicatePrinter: Checking duplicate name', nameQuery);
    const nameResult = await request.query(nameQuery);
    console.log('[Backend Service] checkDuplicatePrinter: Name check result', {
      recordCount: nameResult.recordset.length,
      records: nameResult.recordset
    });
    
    if (nameResult.recordset.length > 0) {
      const error: any = new Error(`A printer with the name "${name}" already exists`);
      error.code = 'DUPLICATE_NAME';
      console.log('[Backend Service] checkDuplicatePrinter: Duplicate name found', error);
      throw error;
    }
    
    // Check for duplicate IPAddress (only if IPAddress is provided and not empty)
    // NOTE: Hiện tại logic yêu cầu IP phải duy nhất.
    // Nếu nhiều máy in có thể dùng chung IP (ví dụ: network printer với port khác nhau, virtual printers),
    // hãy comment out phần kiểm tra IP duplicate này hoặc chuyển sang cảnh báo (warning) thay vì lỗi (error).
    if (ipAddress && ipAddress.trim().length > 0) {
      const ipRequest = pool.request();
      let ipQuery = 'SELECT PrinterID, IPAddress FROM Printers WHERE IPAddress = @ipAddress';
      if (excludePrinterId) {
        ipQuery += ' AND PrinterID != @excludePrinterId';
        ipRequest.input('excludePrinterId', sql.UniqueIdentifier, excludePrinterId);
      }
      ipRequest.input('ipAddress', sql.NVarChar, ipAddress.trim());
      
      console.log('[Backend Service] checkDuplicatePrinter: Checking duplicate IP', ipQuery);
      const ipResult = await ipRequest.query(ipQuery);
      console.log('[Backend Service] checkDuplicatePrinter: IP check result', {
        recordCount: ipResult.recordset.length,
        records: ipResult.recordset
      });
      
      if (ipResult.recordset.length > 0) {
        const duplicateCount = ipResult.recordset.length;
        const error: any = new Error(
          `Địa chỉ IP "${ipAddress}" đã được sử dụng bởi ${duplicateCount} máy in khác trong hệ thống. Vui lòng sử dụng địa chỉ IP khác hoặc liên hệ quản trị viên nếu bạn muốn nhiều máy in dùng chung IP.`
        );
        error.code = 'DUPLICATE_IP';
        error.duplicateCount = duplicateCount;
        console.log('[Backend Service] checkDuplicatePrinter: Duplicate IP found', {
          error,
          duplicateCount,
          ipAddress
        });
        throw error;
      }
    } else {
      console.log('[Backend Service] checkDuplicatePrinter: No IP address provided, skipping IP check');
    }
    
    console.log('[Backend Service] checkDuplicatePrinter: No duplicates found');
  } catch (error: any) {
    console.error('[Backend Service] checkDuplicatePrinter: Error occurred', {
      error,
      message: error?.message,
      code: error?.code
    });
    throw error;
  }
}

/**
 * Get list of printers with pagination and filters
 */
export async function getPrinters(params: PrinterQueryParams = {}): Promise<PaginatedResponse<Printer>> {
  const pool = await getPool();

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
    whereConditions.push('(p.Name LIKE @search OR p.Brand LIKE @search OR p.Model LIKE @search OR p.IPAddress LIKE @search)');
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
  const pool = await getPool();
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
  console.log('[Backend Service] createPrinter: Starting', data);
  
  try {
    const pool = await getPool();
    console.log('[Backend Service] createPrinter: Database pool obtained');

    // Check for duplicate Name or IPAddress before creating
    console.log('[Backend Service] createPrinter: Checking for duplicates', {
      name: data.Name,
      ipAddress: data.IPAddress
    });
    await checkDuplicatePrinter(data.Name, data.IPAddress);
    console.log('[Backend Service] createPrinter: No duplicates found');

    // Validate and normalize LocationID
    // Convert empty strings, undefined, or whitespace-only strings to null
    let locationIDValue: string | null = null;
    if (data.LocationID) {
      const trimmed = typeof data.LocationID === 'string' ? data.LocationID.trim() : '';
      if (trimmed.length > 0) {
        console.log('[Backend Service] createPrinter: Validating LocationID', trimmed);
        // Validate LocationID format (must be valid UUID)
        const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(trimmed)) {
          throw new Error('Invalid LocationID format. Must be a valid UUID.');
        }
        await validateLocationID(trimmed);
        locationIDValue = trimmed;
        console.log('[Backend Service] createPrinter: LocationID validated', locationIDValue);
      }
    } else {
      console.log('[Backend Service] createPrinter: No LocationID provided, using null');
    }

    const request = pool.request();
    request.input('name', sql.NVarChar, data.Name);
    request.input('brand', sql.NVarChar, data.Brand || null);
    request.input('model', sql.NVarChar, data.Model || null);
    request.input('description', sql.NVarChar(sql.MAX), data.Description || null);
    request.input('status', sql.NVarChar, data.Status || 'OFFLINE');
    request.input('ipAddress', sql.NVarChar, data.IPAddress || null);
    request.input('cupsPrinterName', sql.NVarChar, data.CUPSPrinterName || null);
    request.input('isActive', sql.Bit, data.IsActive !== undefined ? data.IsActive : true);
    request.input('locationID', sql.UniqueIdentifier, locationIDValue);

    console.log('[Backend Service] createPrinter: Executing INSERT query', {
      name: data.Name,
      brand: data.Brand,
      model: data.Model,
      status: data.Status || 'OFFLINE',
      ipAddress: data.IPAddress,
      isActive: data.IsActive !== undefined ? data.IsActive : true,
      locationID: locationIDValue
    });

    const result = await request
      .query(`
        INSERT INTO Printers (Name, Brand, Model, Description, Status, IPAddress, CUPSPrinterName, LocationID, IsActive)
        OUTPUT INSERTED.*
        VALUES (@name, @brand, @model, @description, @status, @ipAddress, @cupsPrinterName, @locationID, @isActive)
      `);

    console.log('[Backend Service] createPrinter: INSERT successful', {
      rowsAffected: result.rowsAffected,
      recordCount: result.recordset.length
    });

    if (result.recordset.length === 0) {
      console.error('[Backend Service] createPrinter: No record returned from INSERT');
      throw new Error('Failed to create printer - no record returned');
    }

    const printer = mapPrinterFromDb(result.recordset[0]);
    console.log('[Backend Service] createPrinter: Printer mapped successfully', {
      printerID: printer.PrinterID,
      name: printer.Name
    });

    return printer;
  } catch (error: any) {
    console.error('[Backend Service] createPrinter: Error in service', {
      error: error,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      name: error?.name
    });
    throw error;
  }
}

/**
 * Update printer information
 */
export async function updatePrinter(printerId: string, data: UpdatePrinterDto): Promise<Printer | null> {
  const pool = await getPool();

  // Check for duplicate Name or IPAddress if they are being updated
  if (data.Name !== undefined || data.IPAddress !== undefined) {
    // Get current printer to use current values if not updating
    const currentPrinter = await getPrinterById(printerId);
    if (!currentPrinter) {
      return null;
    }
    
    const nameToCheck = data.Name !== undefined ? data.Name : currentPrinter.Name;
    const ipToCheck = data.IPAddress !== undefined ? data.IPAddress : currentPrinter.IPAddress;
    
    await checkDuplicatePrinter(nameToCheck, ipToCheck, printerId);
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
    // Normalize LocationID: empty string becomes null
    let locationIDValue: string | null = null;
    if (data.LocationID && data.LocationID.trim().length > 0) {
      // Validate LocationID format (must be valid UUID)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(data.LocationID.trim())) {
        throw new Error('Invalid LocationID format. Must be a valid UUID.');
      }
      await validateLocationID(data.LocationID.trim());
      locationIDValue = data.LocationID.trim();
    }
    
    updateFields.push('LocationID = @locationID');
    request.input('locationID', sql.UniqueIdentifier, locationIDValue);
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

  // Use table variable to avoid OUTPUT clause conflict with triggers
  const result = await request.query(`
    DECLARE @UpdatedTable TABLE (
      PrinterID UNIQUEIDENTIFIER,
      Name NVARCHAR(255),
      Brand NVARCHAR(100),
      Model NVARCHAR(100),
      Description NVARCHAR(MAX),
      Status NVARCHAR(50),
      IPAddress NVARCHAR(50),
      CUPSPrinterName NVARCHAR(255),
      LocationID UNIQUEIDENTIFIER,
      IsActive BIT,
      CreatedAt DATETIME2,
      UpdatedAt DATETIME2
    );

    UPDATE Printers
    SET ${updateFields.join(', ')}
    OUTPUT INSERTED.* INTO @UpdatedTable
    WHERE PrinterID = @printerId;

    SELECT * FROM @UpdatedTable;
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
  const pool = await getPool();
  const result = await pool
    .request()
    .input('printerId', sql.UniqueIdentifier, printerId)
    .query('DELETE FROM Printers WHERE PrinterID = @printerId');

  return (result.rowsAffected[0] ?? 0) > 0;
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

