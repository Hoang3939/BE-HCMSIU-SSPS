/**
 * Seed Admin User
 * Script để tạo tài khoản ADMIN mặc định
 * 
 * Cách chạy:
 * npx tsx scripts/seed-admin.ts
 * hoặc
 * npm run seed:admin
 */

import sql from 'mssql';
import { randomUUID } from 'crypto';
import { getPool } from '../src/config/database.js';
import { hashPassword } from '../src/utils/bcrypt.util.js';

async function seedAdminUser() {
  try {
    console.log('🔍 Đang kết nối database...');
    const pool = await getPool();
    
    if (!pool) {
      throw new Error('❌ Không thể kết nối database. Vui lòng kiểm tra cấu hình.');
    }

    console.log('✅ Đã kết nối database thành công!');

    // Thông tin admin mặc định
    const adminUsername = process.env.ADMIN_USERNAME || 'admin';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123';
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';

    console.log(`\n📝 Tạo tài khoản ADMIN:`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Password: ${adminPassword}\n`);

    // Hash password
    console.log('🔐 Đang hash password...');
    const passwordHash = await hashPassword(adminPassword);
    console.log('✅ Password đã được hash!');

    // Kiểm tra xem user đã tồn tại chưa
    const checkRequest = pool.request();
    const checkResult = await checkRequest
      .input('Username', sql.NVarChar(100), adminUsername)
      .query(`
        SELECT UserID, Username, Email, Role, IsActive
        FROM Users
        WHERE Username = @Username
      `);

    if (checkResult.recordset.length > 0) {
      const existingUser = checkResult.recordset[0];
      console.log(`\n⚠️  User "${adminUsername}" đã tồn tại!`);
      console.log(`   UserID: ${existingUser.UserID}`);
      console.log(`   Role: ${existingUser.Role}`);
      console.log(`   IsActive: ${existingUser.IsActive}`);
      
      // Hỏi có muốn update password không
      const shouldUpdate = process.argv.includes('--update-password') || process.argv.includes('-u');
      
      if (shouldUpdate) {
        console.log('\n🔄 Đang cập nhật password...');
        const updateRequest = pool.request();
        await updateRequest
          .input('Username', sql.NVarChar(100), adminUsername)
          .input('PasswordHash', sql.NVarChar(255), passwordHash)
          .query(`
            UPDATE Users
            SET PasswordHash = @PasswordHash,
                UpdatedAt = GETDATE()
            WHERE Username = @Username
          `);
        console.log('✅ Password đã được cập nhật!');
      } else {
        console.log('\n💡 Nếu muốn cập nhật password, chạy lại với flag: --update-password');
      }
      
      await pool.close();
      return;
    }

    // Tạo user mới
    console.log('👤 Đang tạo user mới...');
    const userID = randomUUID();
    const request = pool.request();
    
    await request
      .input('UserID', sql.UniqueIdentifier, userID)
      .input('Username', sql.NVarChar(100), adminUsername)
      .input('Email', sql.NVarChar(255), adminEmail)
      .input('PasswordHash', sql.NVarChar(255), passwordHash)
      .input('Role', sql.NVarChar(50), 'ADMIN')
      .query(`
        INSERT INTO Users (UserID, Username, Email, PasswordHash, Role, IsActive, CreatedAt)
        VALUES (@UserID, @Username, @Email, @PasswordHash, @Role, 1, GETDATE())
      `);

    console.log('\n✅ Tạo user thành công!');
    console.log(`   UserID: ${userID}`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Role: ADMIN`);
    console.log(`\n🎉 Bây giờ bạn có thể đăng nhập với:`);
    console.log(`   Username: ${adminUsername}`);
    console.log(`   Password: ${adminPassword}\n`);

    await pool.close();
  } catch (error: any) {
    console.error('\n❌ Lỗi khi seed admin user:', error.message);
    if (error.stack) {
      console.error(error.stack);
    }
    process.exit(1);
  }
}

// Chạy script
seedAdminUser();

