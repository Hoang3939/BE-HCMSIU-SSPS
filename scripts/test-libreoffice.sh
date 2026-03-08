#!/bin/bash

# Script để test LibreOffice trên Ubuntu Server
# Sử dụng: ./scripts/test-libreoffice.sh

echo "=== Kiểm tra LibreOffice ==="
echo ""

# Kiểm tra LibreOffice có được cài đặt không
echo "1. Kiểm tra command 'soffice':"
if command -v soffice &> /dev/null; then
    SOFFICE_PATH=$(which soffice)
    echo "   ✓ Tìm thấy tại: $SOFFICE_PATH"
    echo ""
    echo "2. Kiểm tra version:"
    soffice --version
    echo ""
else
    echo "   ✗ Không tìm thấy 'soffice' trong PATH"
    echo ""
    echo "   Đang kiểm tra các đường dẫn phổ biến..."
    if [ -f "/usr/bin/soffice" ]; then
        echo "   ✓ Tìm thấy tại: /usr/bin/soffice"
        /usr/bin/soffice --version
    elif [ -f "/usr/local/bin/soffice" ]; then
        echo "   ✓ Tìm thấy tại: /usr/local/bin/soffice"
        /usr/local/bin/soffice --version
    else
        echo "   ✗ Không tìm thấy LibreOffice"
        echo ""
        echo "   Để cài đặt LibreOffice, chạy:"
        echo "   sudo apt update"
        echo "   sudo apt install libreoffice-common libreoffice-writer libreoffice-calc -y"
        exit 1
    fi
fi

echo ""
echo "3. Test chuyển đổi file (headless mode):"
echo "   Tạo file test Word đơn giản..."

# Tạo thư mục test nếu chưa có
TEST_DIR="/tmp/libreoffice-test-$$"
mkdir -p "$TEST_DIR"

# Tạo file test đơn giản (text file)
TEST_FILE="$TEST_DIR/test.txt"
echo "Test document for LibreOffice conversion" > "$TEST_FILE"

# Thử chuyển đổi sang PDF
echo "   Đang chuyển đổi test.txt sang PDF..."
if command -v soffice &> /dev/null; then
    SOFFICE_CMD="soffice"
elif [ -f "/usr/bin/soffice" ]; then
    SOFFICE_CMD="/usr/bin/soffice"
else
    SOFFICE_CMD="/usr/local/bin/soffice"
fi

$SOFFICE_CMD --headless --nodefault --nolockcheck --invisible --norestore \
    --convert-to pdf --outdir "$TEST_DIR" "$TEST_FILE" 2>&1 | head -5

# Kiểm tra kết quả
sleep 2
if [ -f "$TEST_DIR/test.pdf" ]; then
    echo "   ✓ Chuyển đổi thành công!"
    echo "   ✓ File PDF được tạo tại: $TEST_DIR/test.pdf"
    PDF_SIZE=$(stat -f%z "$TEST_DIR/test.pdf" 2>/dev/null || stat -c%s "$TEST_DIR/test.pdf" 2>/dev/null)
    echo "   ✓ Kích thước file PDF: $PDF_SIZE bytes"
else
    echo "   ✗ Chuyển đổi thất bại - không tìm thấy file PDF"
    echo "   Kiểm tra lỗi ở trên"
fi

# Dọn dẹp
rm -rf "$TEST_DIR"

echo ""
echo "=== Kết thúc kiểm tra ==="
echo ""
echo "Nếu tất cả các test đều pass, LibreOffice đã sẵn sàng để sử dụng với ứng dụng!"

