/**
 * Script để cập nhật JWT secret keys vào file .env hiện có
 * Chạy: npm run update-jwt-secrets
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Tạo JWT secret keys ngẫu nhiên (64 bytes = 512 bits)
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');

// Đường dẫn đến file .env (ở root của project)
const envPath = path.join(__dirname, '..', '.env');

try {
  // Kiểm tra xem file .env có tồn tại không
  if (!fs.existsSync(envPath)) {
    console.log('❌ File .env không tồn tại!');
    console.log('   Hãy chạy: npm run generate-env');
    process.exit(1);
  }

  // Đọc file .env hiện tại
  let envContent = fs.readFileSync(envPath, 'utf8');

  // Cập nhật hoặc thêm JWT_SECRET
  if (envContent.includes('JWT_SECRET=')) {
    envContent = envContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}`);
    console.log('✅ Đã cập nhật JWT_SECRET');
  } else {
    // Thêm vào cuối file nếu chưa có
    envContent += `\n# JWT Configuration\nJWT_SECRET=${jwtSecret}\n`;
    console.log('✅ Đã thêm JWT_SECRET');
  }

  // Cập nhật hoặc thêm JWT_REFRESH_SECRET
  if (envContent.includes('JWT_REFRESH_SECRET=')) {
    envContent = envContent.replace(/JWT_REFRESH_SECRET=.*/g, `JWT_REFRESH_SECRET=${jwtRefreshSecret}`);
    console.log('✅ Đã cập nhật JWT_REFRESH_SECRET');
  } else {
    // Thêm vào sau JWT_SECRET nếu chưa có
    if (envContent.includes('JWT_SECRET=')) {
      envContent = envContent.replace(/JWT_SECRET=.*/g, `JWT_SECRET=${jwtSecret}\nJWT_REFRESH_SECRET=${jwtRefreshSecret}`);
    } else {
      envContent += `\nJWT_REFRESH_SECRET=${jwtRefreshSecret}\n`;
    }
    console.log('✅ Đã thêm JWT_REFRESH_SECRET');
  }

  // Đảm bảo có các biến môi trường JWT khác
  if (!envContent.includes('JWT_ACCESS_EXPIRES_IN=')) {
    envContent += 'JWT_ACCESS_EXPIRES_IN=15m\n';
  }
  if (!envContent.includes('JWT_REFRESH_EXPIRES_IN=')) {
    envContent += 'JWT_REFRESH_EXPIRES_IN=7d\n';
  }
  if (!envContent.includes('BCRYPT_SALT_ROUNDS=')) {
    envContent += 'BCRYPT_SALT_ROUNDS=10\n';
  }

  // Ghi lại file .env
  fs.writeFileSync(envPath, envContent, 'utf8');
  
  console.log('\n✅ File .env đã được cập nhật thành công!');
  console.log(`📁 Đường dẫn: ${envPath}`);
  console.log('\n🔐 JWT Secret Keys mới đã được tạo:');
  console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 20)}...`);
  console.log(`   JWT_REFRESH_SECRET: ${jwtRefreshSecret.substring(0, 20)}...`);
  console.log('\n⚠️  LƯU Ý:');
  console.log('   - Các secret keys cũ sẽ không còn hoạt động');
  console.log('   - Users đã đăng nhập sẽ cần đăng nhập lại');
  
} catch (error) {
  console.error('❌ Lỗi khi cập nhật file .env:', error.message);
  process.exit(1);
}


