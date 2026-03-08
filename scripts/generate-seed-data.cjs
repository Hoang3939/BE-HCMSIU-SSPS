/**
 * Script để tạo seed data với password đã được hash bằng bcrypt
 * Chạy: npm run generate-seed-data
 */

const bcrypt = require('bcrypt');
const crypto = require('crypto');

// Cấu hình
const SALT_ROUNDS = 10;

// Dữ liệu users mẫu
const users = [
  {
    username: 'student001',
    email: 'student001@hcmsiu.edu.vn',
    password: 'Student@123',
    role: 'STUDENT',
    studentCode: 'SV001',
    semester: '2024-2025-1'
  },
  {
    username: 'student002',
    email: 'student002@hcmsiu.edu.vn',
    password: 'Student@123',
    role: 'STUDENT',
    studentCode: 'SV002',
    semester: '2024-2025-1'
  },
  {
    username: 'admin001',
    email: 'admin001@hcmsiu.edu.vn',
    password: 'Admin@123',
    role: 'ADMIN'
  },
  {
    username: 'admin002',
    email: 'admin002@hcmsiu.edu.vn',
    password: 'Admin@123',
    role: 'ADMIN'
  },
  {
    username: 'spso001',
    email: 'spso001@hcmsiu.edu.vn',
    password: 'SPSO@123',
    role: 'SPSO'
  }
];

async function generateSeedData() {
  console.log('🔐 Đang hash passwords...\n');

  const sqlStatements = [];
  
  // SQL để thêm cột PasswordHash nếu chưa có
  sqlStatements.push(`-- =============================================
-- Add PasswordHash column to Users table if not exists
-- =============================================
IF NOT EXISTS (SELECT 1 FROM sys.columns WHERE object_id = OBJECT_ID('Users') AND name = 'PasswordHash')
BEGIN
    ALTER TABLE Users ADD PasswordHash NVARCHAR(255) NULL;
    PRINT 'PasswordHash column added to Users table';
END
ELSE
BEGIN
    PRINT 'PasswordHash column already exists';
END
GO

-- =============================================
-- INSERT SAMPLE USERS WITH HASHED PASSWORDS
-- =============================================`);

  // Hash passwords và tạo SQL statements
  for (const user of users) {
    const hashedPassword = await bcrypt.hash(user.password, SALT_ROUNDS);
    const userID = crypto.randomUUID();

    // Insert vào Users table
    sqlStatements.push(`
-- User: ${user.username} (${user.role})
DECLARE @UserID_${user.username} UNIQUEIDENTIFIER = '${userID}';

INSERT INTO Users (UserID, Username, Email, Role, PasswordHash, IsActive)
VALUES (
    @UserID_${user.username},
    N'${user.username}',
    N'${user.email}',
    N'${user.role}',
    N'${hashedPassword}',
    1
);`);

    // Insert vào Students table nếu là STUDENT
    if (user.role === 'STUDENT') {
      sqlStatements.push(`
INSERT INTO Students (StudentID, StudentCode, Semester)
VALUES (
    @UserID_${user.username},
    N'${user.studentCode}',
    N'${user.semester}'
);

-- Tạo PageBalance mặc định cho student
INSERT INTO PageBalances (StudentID, CurrentBalance, DefaultPages, Semester)
VALUES (
    @UserID_${user.username},
    100, -- Default pages
    100,
    N'${user.semester}'
);`);
    }

    // Insert vào Admins table nếu là ADMIN hoặc SPSO
    if (user.role === 'ADMIN' || user.role === 'SPSO') {
      sqlStatements.push(`
INSERT INTO Admins (AdminID, Role)
VALUES (
    @UserID_${user.username},
    N'${user.role}'
);`);
    }

    console.log(`✅ ${user.username} (${user.role}) - Password: ${user.password} -> Hashed`);
  }

  sqlStatements.push(`
-- =============================================
-- COMPLETED - Sample Users Inserted
-- =============================================

PRINT 'Sample users inserted successfully!';
PRINT 'Total users:';
SELECT COUNT(*) AS UserCount FROM Users;
PRINT 'Total students:';
SELECT COUNT(*) AS StudentCount FROM Students;
PRINT 'Total admins:';
SELECT COUNT(*) AS AdminCount FROM Admins;
GO`);

  // Ghi vào file
  const fs = require('fs');
  const path = require('path');
  const outputPath = path.join(__dirname, '..', '02_Database_Schema_Data.sql');
  
  // Đọc file hiện tại nếu có
  let existingContent = '';
  if (fs.existsSync(outputPath)) {
    existingContent = fs.readFileSync(outputPath, 'utf8');
  }

  // Tìm vị trí để chèn seed data (sau phần Permissions)
  const insertPosition = existingContent.indexOf('-- =============================================\n-- COMPLETED - Default Data Inserted');
  
  if (insertPosition !== -1) {
    // Chèn seed data trước phần COMPLETED
    const beforeCompleted = existingContent.substring(0, insertPosition);
    const afterCompleted = existingContent.substring(insertPosition);
    
    const newContent = beforeCompleted + '\n' + sqlStatements.join('\n') + '\n\n' + afterCompleted;
    fs.writeFileSync(outputPath, newContent, 'utf8');
  } else {
    // Nếu không tìm thấy, append vào cuối
    const newContent = existingContent + '\n\n' + sqlStatements.join('\n');
    fs.writeFileSync(outputPath, newContent, 'utf8');
  }

  console.log('\n✅ Seed data đã được tạo thành công!');
  console.log(`📁 File: ${outputPath}`);
  console.log('\n📝 Thông tin đăng nhập mẫu:');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  users.forEach(user => {
    console.log(`   ${user.username.padEnd(15)} | Password: ${user.password.padEnd(12)} | Role: ${user.role}`);
  });
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('\n⚠️  LƯU Ý:');
  console.log('   - Passwords đã được hash bằng bcrypt (salt rounds: 10)');
  console.log('   - Chạy file 02_Database_Schema_Data.sql trong SQL Server để insert data');
  console.log('   - Đảm bảo đã chạy 01_Database_Schema_Tables.sql trước');
}

// Chạy script
generateSeedData().catch(error => {
  console.error('❌ Lỗi:', error);
  process.exit(1);
});


