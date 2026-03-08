/**
 * Script test LibreOffice cho Node.js
 * Chạy: node scripts/test-libreoffice.js
 */

import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log('=== Kiểm tra LibreOffice ===\n');

// Kiểm tra LibreOffice
function findLibreOffice() {
  const isWindows = process.platform === 'win32';
  const paths = isWindows
    ? [
        'C:\\Program Files\\LibreOffice\\program\\soffice.exe',
        'C:\\Program Files (x86)\\LibreOffice\\program\\soffice.exe',
      ]
    : ['soffice', '/usr/bin/soffice', '/usr/local/bin/soffice'];

  // Thử tìm qua 'which' command trên Linux
  if (!isWindows) {
    try {
      const whichResult = execSync('which soffice 2>/dev/null', { encoding: 'utf8' }).trim();
      if (whichResult && fs.existsSync(whichResult)) {
        return whichResult;
      }
    } catch (e) {
      // Continue
    }
  }

  // Kiểm tra các đường dẫn
  for (const cmd of paths) {
    if (cmd === 'soffice' && !isWindows) {
      try {
        execSync('soffice --version', { stdio: 'ignore' });
        return 'soffice';
      } catch (e) {
        continue;
      }
    } else if (fs.existsSync(cmd)) {
      return cmd;
    }
  }

  return null;
}

const libreOfficePath = findLibreOffice();

if (!libreOfficePath) {
  console.error('✗ Không tìm thấy LibreOffice');
  console.error('\nĐể cài đặt trên Ubuntu:');
  console.error('  sudo apt update');
  console.error('  sudo apt install libreoffice-common libreoffice-writer libreoffice-calc -y');
  process.exit(1);
}

console.log(`✓ Tìm thấy LibreOffice tại: ${libreOfficePath}\n`);

// Kiểm tra version
try {
  const version = execSync(`${libreOfficePath} --version`, { encoding: 'utf8' });
  console.log('Version:');
  console.log(version);
} catch (e) {
  console.error('✗ Không thể lấy version');
}

// Test chuyển đổi
console.log('\n=== Test chuyển đổi ===\n');

const testDir = path.join(__dirname, '..', 'temp_test_' + Date.now());
fs.mkdirSync(testDir, { recursive: true });

// Tạo file test
const testFile = path.join(testDir, 'test.txt');
fs.writeFileSync(testFile, 'Test document for LibreOffice conversion\nThis is a test file.');

console.log('Đang chuyển đổi test.txt sang PDF...');

(async () => {
  try {
    execSync(
      `${libreOfficePath} --headless --nodefault --nolockcheck --invisible --norestore --convert-to pdf --outdir "${testDir}" "${testFile}"`,
      { stdio: 'pipe', timeout: 30000 }
    );

    // Đợi một chút để LibreOffice hoàn thành
    await new Promise((resolve) => setTimeout(resolve, 2000));

    const pdfPath = path.join(testDir, 'test.pdf');
    if (fs.existsSync(pdfPath)) {
      const stats = fs.statSync(pdfPath);
      console.log(`✓ Chuyển đổi thành công!`);
      console.log(`✓ File PDF: ${pdfPath}`);
      console.log(`✓ Kích thước: ${stats.size} bytes`);
    } else {
      console.error('✗ Không tìm thấy file PDF sau khi chuyển đổi');
    }
  } catch (error) {
    console.error('✗ Lỗi khi chuyển đổi:', error.message);
  }

  // Dọn dẹp
  try {
    fs.rmSync(testDir, { recursive: true, force: true });
  } catch (e) {
    // Ignore
  }

  console.log('\n=== Kết thúc test ===');
  console.log('\nNếu test thành công, LibreOffice đã sẵn sàng để sử dụng!');
})();

