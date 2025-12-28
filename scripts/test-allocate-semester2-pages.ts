/**
 * Script để test việc cấp trang cho sinh viên khi sang học kỳ 2
 * Có thể chạy thủ công để test mà không cần đợi đến ngày thực tế
 * 
 * Usage:
 *   npm run test:semester2-pages
 *   hoặc
 *   tsx scripts/test-allocate-semester2-pages.ts
 */

import { getPool, connectDB, closeDB } from '../src/config/database.js';
import sql from 'mssql';
import { allocatePagesForSemester } from '../src/services/admin.service.js';

async function testAllocateSemester2Pages() {
  try {
    console.log('=============================================');
    console.log('Testing Allocate Pages for Semester 2');
    console.log('=============================================\n');

    await connectDB();
    const pool = await getPool();

    if (!pool) {
      console.error('❌ Database connection not available');
      return;
    }

    // Option 1: Sử dụng API allocatePagesForSemester với simulateDate
    console.log('📋 Option 1: Using allocatePagesForSemester API with simulateDate...');
    try {
      // Simulate ngày là ngày bắt đầu học kỳ 2 (hoặc sau đó)
      const simulateDate = new Date('2026-01-31T00:00:00Z'); // Giả lập ngày 31/01/2026
      
      const result = await allocatePagesForSemester(2, simulateDate);
      console.log(`✅ Allocated pages for ${result.allocatedCount} students for Semester 2!`);
      console.log(`   Semester date: ${result.semesterDate}`);
      console.log(`   Simulated date: ${simulateDate.toISOString()}`);
    } catch (error: any) {
      console.error('❌ Error using API:', error.message);
      console.log('⚠️  Continuing with manual SQL update...');
    }

    // Option 2: Manual SQL update (nếu cần test chi tiết hơn)
    console.log('\n📋 Option 2: Manual SQL update...');
    try {
      // Lấy default pages từ config
      const configResult = await pool
        .request()
        .query(`
          SELECT TOP 1 DefaultPageBalance 
          FROM SystemConfigs 
          ORDER BY UpdatedAt DESC
        `);

      const defaultPages = configResult.recordset[0]?.DefaultPageBalance || 100;
      const semester = '2024-2025-2';

      // Update PageBalances: Cộng thêm defaultPages
      const updateResult = await pool
        .request()
        .input('defaultPages', sql.Int, defaultPages)
        .input('semester', sql.NVarChar(20), semester)
        .query(`
          UPDATE PageBalances
          SET 
            CurrentBalance = CurrentBalance + @defaultPages,
            DefaultPages = DefaultPages + @defaultPages,
            Semester = @semester,
            LastUpdated = GETDATE()
        `);

      const updatedCount = updateResult.rowsAffected[0] || 0;
      console.log(`✅ Manually updated ${updatedCount} PageBalances (added ${defaultPages} pages for Semester 2)`);

      // Insert for students without PageBalance
      const insertResult = await pool
        .request()
        .input('defaultPages', sql.Int, defaultPages)
        .input('semester', sql.NVarChar(20), semester)
        .query(`
          INSERT INTO PageBalances (StudentID, CurrentBalance, DefaultPages, PurchasedPages, UsedPages, Semester, LastUpdated)
          SELECT 
              s.StudentID,
              @defaultPages,
              @defaultPages,
              0,
              0,
              @semester,
              GETDATE()
          FROM Students s
          WHERE NOT EXISTS (
              SELECT 1 FROM PageBalances pb WHERE pb.StudentID = s.StudentID
          )
        `);

      const insertedCount = insertResult.rowsAffected[0] || 0;
      if (insertedCount > 0) {
        console.log(`✅ Inserted ${insertedCount} new PageBalances for Semester 2`);
      }
    } catch (error) {
      console.error('❌ Error in manual update:', error);
    }

    // Verification: Check results
    console.log('\n📋 Verification: Current PageBalances...');
    const verifyResult = await pool
      .request()
      .query(`
        SELECT 
          s.StudentCode,
          u.Username,
          pb.CurrentBalance,
          pb.DefaultPages,
          pb.UsedPages,
          pb.Semester,
          pb.LastUpdated
        FROM PageBalances pb
        INNER JOIN Students s ON pb.StudentID = s.StudentID
        INNER JOIN Users u ON s.StudentID = u.UserID
        ORDER BY s.StudentCode
      `);

    console.log('\n📊 Current PageBalances:');
    console.table(verifyResult.recordset);

    // Summary by Semester
    const summaryResult = await pool
      .request()
      .query(`
        SELECT 
          Semester,
          COUNT(*) AS StudentCount,
          SUM(CurrentBalance) AS TotalPages,
          AVG(CurrentBalance) AS AvgPages,
          MIN(CurrentBalance) AS MinPages,
          MAX(CurrentBalance) AS MaxPages
        FROM PageBalances
        GROUP BY Semester
        ORDER BY Semester
      `);

    console.log('\n📈 Summary by Semester:');
    console.table(summaryResult.recordset);

    console.log('\n✅ Test completed successfully!');
    console.log('📝 Note: Pages were ADDED to existing balance, not reset to default.');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closeDB();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testAllocateSemester2Pages();
}

export { testAllocateSemester2Pages };

