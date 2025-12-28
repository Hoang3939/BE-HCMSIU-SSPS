/**
 * Script để test việc cấp trang cho sinh viên khi sang học kỳ mới
 * Có thể chạy thủ công để test mà không cần đợi đến ngày thực tế
 * 
 * Usage:
 *   npm run test:semester-pages
 *   hoặc
 *   tsx scripts/test-semester-page-allocation.ts
 */

import { getPool, connectDB, closeDB } from '../src/config/database.js';
import sql from 'mssql';
import { resetStudentPages } from '../src/services/admin.service.js';

async function testResetStudentPages() {
  try {
    console.log('=============================================');
    console.log('Testing Reset Student Pages');
    console.log('=============================================\n');

    await connectDB();
    const pool = await getPool();

    if (!pool) {
      console.error('❌ Database connection not available');
      return;
    }

    // Option 1: Sử dụng API resetStudentPages
    console.log('📋 Option 1: Using resetStudentPages API...');
    try {
      const result = await resetStudentPages();
      console.log(`✅ Reset ${result.resetCount} students successfully!`);
    } catch (error) {
      console.error('❌ Error using API:', error);
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

      // Update PageBalances
      const updateResult = await pool
        .request()
        .input('defaultPages', sql.Int, defaultPages)
        .query(`
          UPDATE PageBalances
          SET 
            CurrentBalance = @defaultPages,
            DefaultPages = @defaultPages,
            UsedPages = 0,
            LastUpdated = GETDATE()
        `);

      const updatedCount = updateResult.rowsAffected[0] || 0;
      console.log(`✅ Manually updated ${updatedCount} PageBalances to ${defaultPages} pages`);

      // Insert for students without PageBalance
      const insertResult = await pool
        .request()
        .input('defaultPages', sql.Int, defaultPages)
        .query(`
          INSERT INTO PageBalances (StudentID, CurrentBalance, DefaultPages, PurchasedPages, UsedPages, LastUpdated)
          SELECT 
              s.StudentID,
              @defaultPages,
              @defaultPages,
              0,
              0,
              GETDATE()
          FROM Students s
          WHERE NOT EXISTS (
              SELECT 1 FROM PageBalances pb WHERE pb.StudentID = s.StudentID
          )
        `);

      const insertedCount = insertResult.rowsAffected[0] || 0;
      if (insertedCount > 0) {
        console.log(`✅ Inserted ${insertedCount} new PageBalances`);
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
          pb.LastUpdated
        FROM PageBalances pb
        INNER JOIN Students s ON pb.StudentID = s.StudentID
        INNER JOIN Users u ON s.StudentID = u.UserID
        ORDER BY s.StudentCode
      `);

    console.log('\n📊 Current PageBalances:');
    console.table(verifyResult.recordset);

    // Summary
    const summaryResult = await pool
      .request()
      .query(`
        SELECT 
          COUNT(*) AS TotalStudents,
          SUM(CurrentBalance) AS TotalPages,
          AVG(CurrentBalance) AS AvgPages,
          MIN(CurrentBalance) AS MinPages,
          MAX(CurrentBalance) AS MaxPages
        FROM PageBalances
      `);

    console.log('\n📈 Summary:');
    console.table(summaryResult.recordset);

    console.log('\n✅ Test completed successfully!');
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await closeDB();
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  testResetStudentPages();
}

export { testResetStudentPages };

