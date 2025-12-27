#!/bin/bash

# Script test CRUD cho User Management
# Chạy: bash test-user-crud.sh

BASE_URL="http://localhost:3001"
ADMIN_USERNAME="admin001"
ADMIN_PASSWORD="Admin@123"

echo "=========================================="
echo "🧪 TEST USER MANAGEMENT CRUD APIs"
echo "=========================================="
echo ""

# Màu sắc cho output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Bước 1: Login để lấy token
echo "📝 Bước 1: Login để lấy token..."
LOGIN_RESPONSE=$(curl -s -X POST "$BASE_URL/api/auth/login" \
  -H "Content-Type: application/json" \
  -d "{\"username\":\"$ADMIN_USERNAME\",\"password\":\"$ADMIN_PASSWORD\"}")

TOKEN=$(echo $LOGIN_RESPONSE | grep -o '"token":"[^"]*"' | cut -d'"' -f4)

if [ -z "$TOKEN" ]; then
  echo -e "${RED}❌ Login thất bại!${NC}"
  echo "Response: $LOGIN_RESPONSE"
  exit 1
fi

echo -e "${GREEN}✅ Login thành công!${NC}"
echo "Token: ${TOKEN:0:50}..."
echo ""

# Bước 2: GET - Xem danh sách users
echo "📋 Bước 2: GET /admin/users - Xem danh sách users..."
GET_RESPONSE=$(curl -s -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response:"
echo $GET_RESPONSE | python3 -m json.tool 2>/dev/null || echo $GET_RESPONSE
echo ""

# Bước 3: POST - Tạo user mới
echo "➕ Bước 3: POST /admin/users - Tạo user mới..."
TEST_USERNAME="testuser_$(date +%s)"
TEST_EMAIL="testuser_$(date +%s)@hcmsiu.edu.vn"

POST_RESPONSE=$(curl -s -X POST "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"username\": \"$TEST_USERNAME\",
    \"email\": \"$TEST_EMAIL\",
    \"password\": \"password123\",
    \"role\": \"STUDENT\"
  }")

echo "Request: username=$TEST_USERNAME, email=$TEST_EMAIL"
echo "Response:"
echo $POST_RESPONSE | python3 -m json.tool 2>/dev/null || echo $POST_RESPONSE

# Extract user ID từ response
USER_ID=$(echo $POST_RESPONSE | grep -o '"id":"[^"]*"' | cut -d'"' -f4)

if [ -z "$USER_ID" ]; then
  echo -e "${RED}❌ Tạo user thất bại!${NC}"
  echo ""
else
  echo -e "${GREEN}✅ Tạo user thành công!${NC}"
  echo "User ID: $USER_ID"
  echo ""
fi

# Bước 4: PUT - Cập nhật user
if [ ! -z "$USER_ID" ]; then
  echo "✏️  Bước 4: PUT /admin/users/$USER_ID - Cập nhật user..."
  PUT_RESPONSE=$(curl -s -X PUT "$BASE_URL/admin/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json" \
    -d "{
      \"username\": \"${TEST_USERNAME}_updated\",
      \"email\": \"${TEST_EMAIL}\",
      \"role\": \"STUDENT\"
    }")
  
  echo "Response:"
  echo $PUT_RESPONSE | python3 -m json.tool 2>/dev/null || echo $PUT_RESPONSE
  
  if echo $PUT_RESPONSE | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Cập nhật user thành công!${NC}"
  else
    echo -e "${RED}❌ Cập nhật user thất bại!${NC}"
  fi
  echo ""
fi

# Bước 5: DELETE - Xóa user (soft delete)
if [ ! -z "$USER_ID" ]; then
  echo "🗑️  Bước 5: DELETE /admin/users/$USER_ID - Xóa user..."
  DELETE_RESPONSE=$(curl -s -X DELETE "$BASE_URL/admin/users/$USER_ID" \
    -H "Authorization: Bearer $TOKEN" \
    -H "Content-Type: application/json")
  
  echo "Response:"
  echo $DELETE_RESPONSE | python3 -m json.tool 2>/dev/null || echo $DELETE_RESPONSE
  
  if echo $DELETE_RESPONSE | grep -q "success.*true"; then
    echo -e "${GREEN}✅ Xóa user thành công!${NC}"
  else
    echo -e "${RED}❌ Xóa user thất bại!${NC}"
  fi
  echo ""
fi

# Bước 6: Verify trong database (GET lại danh sách)
echo "🔍 Bước 6: GET /admin/users - Kiểm tra lại danh sách sau khi xóa..."
GET_RESPONSE2=$(curl -s -X GET "$BASE_URL/admin/users" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json")

echo "Response:"
echo $GET_RESPONSE2 | python3 -m json.tool 2>/dev/null || echo $GET_RESPONSE2
echo ""

echo "=========================================="
echo -e "${GREEN}✅ Hoàn thành test CRUD!${NC}"
echo "=========================================="


