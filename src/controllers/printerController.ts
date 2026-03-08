import type { Request, Response } from 'express';
import * as printerService from '../services/printerService.js';
import type { CreatePrinterDto, UpdatePrinterDto } from '../types/printer.js';

/**
 * Controller layer cho Printer - Xử lý HTTP requests/responses
 */

/**
 * @swagger
 * /api/admin/printers:
 *   get:
 *     summary: Lấy danh sách máy in với phân trang và filter
 *     tags: [Admin - Printers]
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *         description: Số trang (bắt đầu từ 1)
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *         description: Số lượng máy in mỗi trang
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [AVAILABLE, BUSY, OFFLINE, MAINTENANCE, ERROR]
 *         description: Lọc theo trạng thái máy in
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Tìm kiếm theo tên, brand, hoặc model
 *       - in: query
 *         name: isActive
 *         schema:
 *           type: boolean
 *         description: Lọc theo trạng thái hoạt động
 *     responses:
 *       200:
 *         description: Danh sách máy in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Printer'
 *                 pagination:
 *                   $ref: '#/components/schemas/Pagination'
 *       500:
 *         description: Lỗi server
 */
export async function getPrinters(req: Request, res: Response): Promise<void> {
  try {
    const queryParams = {
      page: req.query.page ? parseInt(req.query.page as string) : undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : undefined,
      status: req.query.status as string | undefined,
      search: req.query.search as string | undefined,
      isActive: req.query.isActive !== undefined ? req.query.isActive === 'true' : undefined,
    };

    const result = await printerService.getPrinters(queryParams);
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (error) {
    console.error('[printerController] Error getting printers:', error);
    res.status(500).json({
      success: false,
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/printers/{id}:
 *   get:
 *     summary: Lấy chi tiết một máy in theo ID
 *     tags: [Admin - Printers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của máy in (UUID)
 *     responses:
 *       200:
 *         description: Thông tin máy in
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Printer'
 *       404:
 *         description: Không tìm thấy máy in
 *       500:
 *         description: Lỗi server
 */
export async function getPrinterById(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Printer ID is required' });
      return;
    }

    const printer = await printerService.getPrinterById(id);

    if (!printer) {
      res.status(404).json({ error: 'Printer not found' });
      return;
    }

    res.status(200).json(printer);
  } catch (error) {
    console.error('[printerController] Error getting printer by ID:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/printers:
 *   post:
 *     summary: Tạo máy in mới
 *     tags: [Admin - Printers]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePrinterDto'
 *     responses:
 *       201:
 *         description: Tạo máy in thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Printer'
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       500:
 *         description: Lỗi server
 */
export async function createPrinter(req: Request, res: Response): Promise<void> {
  console.log('[Backend] createPrinter: Request received', {
    body: req.body,
    headers: req.headers,
    method: req.method,
    url: req.url
  });
  
  try {
    const data: CreatePrinterDto = req.body;
    console.log('[Backend] createPrinter: Parsed data', data);

    // Validation
    if (!data.Name || data.Name.trim() === '') {
      console.log('[Backend] createPrinter: Validation failed - Name is required');
      res.status(400).json({ error: 'Name is required' });
      return;
    }

    console.log('[Backend] createPrinter: Calling printerService.createPrinter');
    const printer = await printerService.createPrinter(data);
    console.log('[Backend] createPrinter: Printer created successfully', {
      printerID: printer.PrinterID,
      name: printer.Name
    });
    
    res.status(201).json({
      success: true,
      data: printer,
      message: 'Printer created successfully'
    });
    console.log('[Backend] createPrinter: Response sent with status 201');
  } catch (error: any) {
    console.error('[Backend] createPrinter: Error occurred', {
      error: error,
      message: error?.message,
      code: error?.code,
      stack: error?.stack,
      name: error?.name
    });
    
    // Check for duplicate Name or IPAddress
    if (error?.code === 'DUPLICATE_NAME' || error?.code === 'DUPLICATE_IP') {
      console.log('[Backend] createPrinter: Duplicate detected, returning 409 Conflict', {
        code: error.code,
        message: error.message
      });
      
      // Check if response has already been sent
      if (res.headersSent) {
        console.error('[Backend] createPrinter: Response already sent, cannot send 409');
        return;
      }
      
      res.status(409).json({
        error: 'Conflict',
        message: error.message || 'A printer with this name or IP address already exists',
        code: error.code,
      });
      console.log('[Backend] createPrinter: 409 Conflict response sent');
      return;
    }
    
    // Check if it's a validation error (LocationID not found)
    const errorMessage = error?.message || error?.originalError?.message || '';
    
    if (errorMessage.includes('does not exist in PrinterLocations')) {
      res.status(400).json({
        error: 'Validation error',
        message: errorMessage,
      });
      return;
    }
    
    // Check if it's a foreign key constraint error from SQL Server
    if (errorMessage.includes('FOREIGN KEY constraint') && errorMessage.includes('PrinterLocations')) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid LocationID. The specified location does not exist in PrinterLocations table.',
      });
      return;
    }
    
    // Check for SQL Server error code 547 (Foreign key constraint violation)
    if (error?.number === 547 || error?.originalError?.number === 547) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid LocationID. The specified location does not exist in PrinterLocations table.',
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage || 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/printers/{id}:
 *   put:
 *     summary: Cập nhật thông tin máy in
 *     tags: [Admin - Printers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của máy in (UUID)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UpdatePrinterDto'
 *     responses:
 *       200:
 *         description: Cập nhật máy in thành công
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Printer'
 *       404:
 *         description: Không tìm thấy máy in
 *       400:
 *         description: Dữ liệu đầu vào không hợp lệ
 *       500:
 *         description: Lỗi server
 */
export async function updatePrinter(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;
    const data: UpdatePrinterDto = req.body;

    if (!id) {
      res.status(400).json({ error: 'Printer ID is required' });
      return;
    }

    const printer = await printerService.updatePrinter(id, data);

    if (!printer) {
      res.status(404).json({ error: 'Printer not found' });
      return;
    }

    res.status(200).json({
      success: true,
      data: printer,
      message: 'Printer updated successfully'
    });
  } catch (error: any) {
    console.error('[printerController] Error updating printer:', error);
    
    // Check for duplicate Name or IPAddress
    if (error?.code === 'DUPLICATE_NAME' || error?.code === 'DUPLICATE_IP') {
      res.status(409).json({
        error: 'Conflict',
        message: error.message || 'A printer with this name or IP address already exists',
        code: error.code,
      });
      return;
    }
    
    // Check if it's a validation error (LocationID not found)
    const errorMessage = error?.message || error?.originalError?.message || '';
    
    if (errorMessage.includes('does not exist in PrinterLocations')) {
      res.status(400).json({
        error: 'Validation error',
        message: errorMessage,
      });
      return;
    }
    
    // Check if it's a foreign key constraint error from SQL Server
    if (errorMessage.includes('FOREIGN KEY constraint') && errorMessage.includes('PrinterLocations')) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid LocationID. The specified location does not exist in PrinterLocations table.',
      });
      return;
    }
    
    // Check for SQL Server error code 547 (Foreign key constraint violation)
    if (error?.number === 547 || error?.originalError?.number === 547) {
      res.status(400).json({
        error: 'Validation error',
        message: 'Invalid LocationID. The specified location does not exist in PrinterLocations table.',
      });
      return;
    }
    
    res.status(500).json({
      error: 'Internal server error',
      message: errorMessage || 'Unknown error',
    });
  }
}

/**
 * @swagger
 * /api/admin/printers/{id}:
 *   delete:
 *     summary: Xóa máy in
 *     tags: [Admin - Printers]
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: ID của máy in (UUID)
 *     responses:
 *       200:
 *         description: Xóa máy in thành công
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Printer deleted successfully
 *       404:
 *         description: Không tìm thấy máy in
 *       500:
 *         description: Lỗi server
 */
export async function deletePrinter(req: Request, res: Response): Promise<void> {
  try {
    const { id } = req.params;

    if (!id) {
      res.status(400).json({ error: 'Printer ID is required' });
      return;
    }

    const deleted = await printerService.deletePrinter(id);

    if (!deleted) {
      res.status(404).json({ 
        success: false,
        error: 'Printer not found',
        message: 'Printer not found'
      });
      return;
    }

    res.status(200).json({ 
      success: true,
      message: 'Printer deleted successfully',
      data: { message: 'Printer deleted successfully' }
    });
  } catch (error) {
    console.error('[printerController] Error deleting printer:', error);
    res.status(500).json({
      error: 'Internal server error',
      message: error instanceof Error ? error.message : 'Unknown error',
    });
  }
}

