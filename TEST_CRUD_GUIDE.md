# 🧪 Hướng dẫn Test CRUD User Management

## 📋 Yêu cầu
- Server đang chạy (`npm run dev`)
- Database đã kết nối
- Có tài khoản admin001 với password `Admin@123`

## 🚀 Cách chạy test

### Cách 1: Dùng script tự động (Khuyến nghị)
```bash
bash test-user-crud.sh
```

Script sẽ tự động test tất cả các chức năng:
1. ✅ Login để lấy token
2. ✅ GET - Xem danh sách users
3. ✅ POST - Tạo user mới
4. ✅ PUT - Cập nhật user
5. ✅ DELETE - Xóa user (soft delete)
6. ✅ GET - Kiểm tra lại danh sách

### Cách 2: Test thủ công từng bước

#### Bước 1: Login để lấy token
```bash
curl -X POST http://localhost:3001/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin001","password":"Admin@123"}'
```

**Copy token từ response** (field `token`)

#### Bước 2: GET - Xem danh sách users
```bash
curl -X GET http://localhost:3001/admin/users \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Bước 3: POST - Tạo user mới
```bash
curl -X POST http://localhost:3001/admin/users \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser001",
    "email": "testuser001@hcmsiu.edu.vn",
    "password": "password123",
    "role": "STUDENT"
  }'
```

**Copy `id` từ response** để dùng cho PUT và DELETE

#### Bước 4: PUT - Cập nhật user
```bash
curl -X PUT http://localhost:3001/admin/users/<USER_ID> \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json" \
  -d '{
    "username": "testuser001_updated",
    "email": "testuser001_updated@hcmsiu.edu.vn",
    "role": "STUDENT"
  }'
```

#### Bước 5: DELETE - Xóa user (soft delete)
```bash
curl -X DELETE http://localhost:3001/admin/users/<USER_ID> \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"
```

#### Bước 6: GET lại - Kiểm tra user đã bị xóa
```bash
curl -X GET http://localhost:3001/admin/users \
  -H "Authorization: Bearer <YOUR_TOKEN>" \
  -H "Content-Type: application/json"
```

User đã xóa sẽ có `isActive: false`

## 🔍 Kiểm tra Database

Sau khi test, kiểm tra trong Azure Data Studio:

```sql
-- Xem tất cả users
SELECT UserID, Username, Email, Role, IsActive, CreatedAt 
FROM Users 
ORDER BY CreatedAt DESC;

-- Xem users đã bị soft delete (IsActive = 0)
SELECT UserID, Username, Email, Role, IsActive 
FROM Users 
WHERE IsActive = 0;
```

## ✅ Kết quả mong đợi

### POST (Tạo user)
- Status: `201 Created`
- Response có `success: true`
- Có `id` (UUID) trong response
- User được lưu vào database với `IsActive = 1`

### PUT (Cập nhật)
- Status: `200 OK`
- Response có `success: true`
- Username/Email/Role được cập nhật trong database

### DELETE (Xóa)
- Status: `200 OK`
- Response có `success: true`
- User trong database có `IsActive = 0` (soft delete)

### GET (Danh sách)
- Status: `200 OK`
- Response có mảng `data` chứa danh sách users
- Users đã xóa (`IsActive = 0`) vẫn hiển thị trong danh sách

## 🐛 Troubleshooting

### Lỗi 401 Unauthorized
- Token đã hết hạn → Login lại để lấy token mới
- Token không đúng format → Đảm bảo có `Bearer ` trước token

### Lỗi 409 Conflict
- Username hoặc email đã tồn tại → Dùng username/email khác

### Lỗi 500 Internal Server Error
- Kiểm tra console logs để xem lỗi SQL
- Kiểm tra database connection
- Kiểm tra logs: `[user-router]: SQL INSERT error:`

## 📝 Logs quan trọng

Khi test, xem logs trong terminal (nơi chạy `npm run dev`):

```
[user-router]: Attempting to insert user: { userID: '...', username: '...' }
[user-router]: INSERT result: { rowsAffected: [1] }
[user-router]: User created successfully: { ... }
```

Nếu có lỗi:
```
[user-router]: SQL INSERT error: ...
[user-router]: SQL error details: { message: '...', ... }
```


