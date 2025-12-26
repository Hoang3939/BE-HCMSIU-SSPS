import { type Request, type Response } from 'express';
import { getPool } from '../config/database.js';
import sql from 'mssql';

/**
 * @openapi
 * /api/printers/available:
 *   get:
 *     summary: Lấy danh sách máy in có sẵn
 *     description: |
 *       Server: http://localhost:3001
 *       
 *       Trả về danh sách các máy in đang hoạt động và sẵn sàng
 *     tags:
 *       - Printers
 *     parameters:
 *       - in: header
 *         name: x-student-id
 *         required: true
 *         schema:
 *           type: string
 *         description: StudentID (GUID) của sinh viên
 *     responses:
 *       200:
 *         description: Danh sách máy in
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   id:
 *                     type: string
 *                   name:
 *                     type: string
 *                   location:
 *                     type: string
 *                   status:
 *                     type: string
 */
export async function getAvailablePrinters(req: Request, res: Response) {
  try {
    const pool = getPool();
    if (!pool) {
      return res.status(500).json({ message: 'Database connection not available' });
    }

    const result = await pool.request().query(`
      SELECT 
        p.PrinterID as id,
        p.Name as name,
        p.Brand,
        p.Model,
        p.Status as status,
        p.IPAddress,
        p.IsActive,
        CASE 
          WHEN pl.Campus IS NOT NULL THEN 
            CONCAT(pl.Campus, ' - ', pl.Building, ' - Phòng ', pl.Room)
          ELSE 'Chưa xác định'
        END as location
      FROM Printers p
      LEFT JOIN PrinterLocations pl ON p.LocationID = pl.LocationID
      WHERE p.IsActive = 1 AND p.Status IN ('AVAILABLE', 'BUSY')
      ORDER BY p.Name
    `);

    // Map to match frontend expected format
    const printers = result.recordset.map((p: any) => ({
      id: p.id,
      name: p.name,
      location: p.location || 'Chưa xác định',
      status: p.status === 'AVAILABLE' ? 'ENABLED' : p.status,
      brand: p.Brand,
      model: p.Model,
      ipAddress: p.IPAddress,
      isActive: p.IsActive,
    }));

    return res.json(printers);
  } catch (error) {
    console.error('Error getting available printers:', error);
    return res.status(500).json({ message: 'Lỗi server khi lấy danh sách máy in' });
  }
}

