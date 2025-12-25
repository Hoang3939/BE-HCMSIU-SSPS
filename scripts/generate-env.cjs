/**
 * Script để tạo file .env với JWT secret keys ngẫu nhiên
 * Chạy: npm run generate-env
 */

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

// Tạo JWT secret keys ngẫu nhiên (64 bytes = 512 bits)
const jwtSecret = crypto.randomBytes(64).toString('hex');
const jwtRefreshSecret = crypto.randomBytes(64).toString('hex');

// Nội dung file .env
const envContent = `# Database Configuration
DB_SERVER=localhost
DB_DATABASE=HCMSIU_SSPS
DB_USER=sa
DB_PASSWORD=your_password
DB_PORT=1433
DB_ENCRYPT=false
DB_TRUST_SERVER_CERTIFICATE=true

# Server Configuration
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000

# JWT Configuration
# Secret keys được tạo ngẫu nhiên bằng crypto.randomBytes(64).toString('hex')
# Mỗi lần chạy script này sẽ tạo secret keys mới - Đảm bảo bảo mật!
JWT_SECRET=${jwtSecret}
JWT_REFRESH_SECRET=${jwtRefreshSecret}
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# Bcrypt Configuration
BCRYPT_SALT_ROUNDS=10

# HCMSIU SSO Configuration (TODO: Thêm khi tích hợp SSO)
# SSO_URL=https://sso.hcmsiu.edu.vn/api/auth
# SSO_API_KEY=your-sso-api-key
`;

// Đường dẫn đến file .env (ở root của project)
const envPath = path.join(__dirname, '..', '.env');

try {
  // Kiểm tra xem file .env đã tồn tại chưa
  if (fs.existsSync(envPath)) {
    console.log('⚠️  File .env đã tồn tại!');
    console.log('   Nếu bạn muốn tạo mới, hãy xóa file .env cũ trước.');
    process.exit(1);
  }

  // Ghi file .env
  fs.writeFileSync(envPath, envContent, 'utf8');
  
  console.log('✅ File .env đã được tạo thành công!');
  console.log(`📁 Đường dẫn: ${envPath}`);
  console.log('\n🔐 JWT Secret Keys đã được tạo ngẫu nhiên:');
  console.log(`   JWT_SECRET: ${jwtSecret.substring(0, 20)}...`);
  console.log(`   JWT_REFRESH_SECRET: ${jwtRefreshSecret.substring(0, 20)}...`);
  console.log('\n⚠️  LƯU Ý QUAN TRỌNG:');
  console.log('   - File .env chứa thông tin nhạy cảm, KHÔNG commit vào git!');
  console.log('   - Mỗi môi trường (dev, staging, production) cần có secret keys khác nhau');
  console.log('   - Trong production, hãy sử dụng secret keys mạnh hơn và lưu trữ an toàn');
  console.log('\n📝 Bước tiếp theo:');
  console.log('   1. Cập nhật DB_SERVER, DB_DATABASE, DB_USER, DB_PASSWORD với thông tin database của bạn');
  console.log('   2. Cập nhật FRONTEND_URL nếu frontend chạy ở URL khác');
  
} catch (error) {
  console.error('❌ Lỗi khi tạo file .env:', error.message);
  process.exit(1);
}

