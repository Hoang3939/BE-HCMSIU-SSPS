# 📡 Hướng dẫn kết nối API giữa Frontend và Backend

Tài liệu này hướng dẫn cách kết nối Frontend với Backend API của hệ thống Smart Printing Service.

---

## 🚀 Bắt đầu nhanh

### 1. Cấu hình Backend

Đảm bảo backend đang chạy:
```bash
cd BE-HCMSIU-SSPS
npm run dev
```

Backend sẽ chạy tại: `http://localhost:3001`

### 2. Cấu hình CORS

Backend đã được cấu hình CORS để cho phép:
- `http://localhost:3000` (mặc định cho React/Next.js)
- URL từ biến môi trường `FRONTEND_URL`

Để thêm frontend URL khác, thêm vào file `.env`:
```env
FRONTEND_URL=http://localhost:3000,https://your-frontend-domain.com
```

### 3. Sử dụng API Client Helper

File `frontend-api-client.ts` đã được tạo sẵn với tất cả các functions cần thiết.

#### Cách 1: Copy file vào project Frontend

```bash
# Copy file vào project frontend của bạn
cp frontend-api-client.ts /path/to/your/frontend/src/api/client.ts
```

#### Cách 2: Sử dụng trực tiếp (nếu frontend và backend cùng repo)

```typescript
import { apiClient } from '../backend/frontend-api-client';
```

---

## 📚 Các API Endpoints

### 🔐 Authentication

#### Login
```typescript
const response = await apiClient.login({
  username: 'student001',
  password: 'encrypted_password'
});

if (response.success) {
  console.log('Token:', response.data.token);
  console.log('User:', response.data.user);
}
```

#### Refresh Token
Token sẽ tự động được refresh khi hết hạn. Bạn cũng có thể refresh thủ công:
```typescript
await apiClient.refreshToken();
```

#### Logout
```typescript
await apiClient.logout();
```

---

### 📄 Documents

#### Upload Document
```typescript
const fileInput = document.querySelector('input[type="file"]');
const file = fileInput.files[0];
const studentId = 'your-student-id';

const response = await apiClient.uploadDocument(file, studentId);

if (response.success) {
  console.log('Document ID:', response.data.id);
  console.log('Page count:', response.data.detectedPageCount);
}
```

#### Get Document
```typescript
const response = await apiClient.getDocument(documentId, studentId);
console.log('Document:', response.data);
```

#### Get Document Preview URL
```typescript
const previewUrl = apiClient.getDocumentPreviewUrl(documentId, studentId);
// Sử dụng URL này trong thẻ <iframe> hoặc <img>
```

---

### 👤 Students

#### Get Student Balance
```typescript
const response = await apiClient.getStudentBalance(studentId);
console.log('Balance pages:', response.data.balancePages);
```

---

### 🖨️ Print Jobs

#### Create Print Job
```typescript
const response = await apiClient.createPrintJob({
  printerId: 'printer-uuid',
  documentId: 'document-uuid',
  copies: 1,
  paperSize: 'A4',
  side: 'ONE_SIDED',
  orientation: 'PORTRAIT',
  pageRange: '1-5, 8' // Optional
}, studentId);

if (response.success) {
  console.log('Print job created:', response.data.id);
  console.log('Total cost:', response.data.totalCost);
}
```

---

### 🖨️ Printers

#### Get Available Printers
```typescript
const response = await apiClient.getAvailablePrinters();
console.log('Available printers:', response.data);
```

#### Get Printers with Map Locations
```typescript
const response = await apiClient.getPrintersWithMap();
console.log('Printers with locations:', response.data);
```

---

### 💳 Payment

#### Create Payment
```typescript
const response = await apiClient.createPayment(50000, 100);
if (response.success) {
  console.log('Transaction ID:', response.data.transId);
  console.log('QR Code URL:', response.data.qrUrl);
}
```

#### Check Payment Status
```typescript
const response = await apiClient.checkPaymentStatus(transId);
console.log('Payment status:', response.data.status);
```

---

## 🔧 Cấu hình Frontend

### React / Next.js

#### 1. Tạo file `.env.local`:
```env
REACT_APP_API_URL=http://localhost:3001
# hoặc
NEXT_PUBLIC_API_URL=http://localhost:3001
```

#### 2. Sử dụng trong component:
```typescript
import { apiClient, isAuthenticated } from './api/client';
import { useEffect, useState } from 'react';

function App() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    if (isAuthenticated()) {
      // User đã đăng nhập
    }
  }, []);

  const handleLogin = async () => {
    try {
      const response = await apiClient.login({
        username: 'student001',
        password: 'password'
      });
      
      if (response.success) {
        setUser(response.data.user);
      }
    } catch (error) {
      console.error('Login failed:', error);
    }
  };

  return (
    <div>
      {/* Your UI */}
    </div>
  );
}
```

### Vue.js

#### 1. Tạo file `.env`:
```env
VUE_APP_API_URL=http://localhost:3001
```

#### 2. Sử dụng trong component:
```vue
<template>
  <div>
    <button @click="handleLogin">Login</button>
  </div>
</template>

<script setup>
import { apiClient } from './api/client';

const handleLogin = async () => {
  try {
    const response = await apiClient.login({
      username: 'student001',
      password: 'password'
    });
    
    if (response.success) {
      console.log('Logged in:', response.data.user);
    }
  } catch (error) {
    console.error('Login failed:', error);
  }
};
</script>
```

---

## 🔒 Authentication Flow

1. **User đăng nhập** → Nhận `accessToken` và `refreshToken`
2. **Access token** được lưu trong `localStorage` và tự động thêm vào header mỗi request
3. **Khi access token hết hạn** (401), client tự động refresh token
4. **Refresh token hết hạn** → User cần đăng nhập lại

### Token Storage
- Access token: `localStorage.getItem('access_token')`
- Refresh token: `localStorage.getItem('refresh_token')`

---

## 📋 Headers cần thiết

### Authentication Header
```
Authorization: Bearer <access_token>
```

### Student ID Header (cho các API của student)
```
x-student-id: <student-uuid>
```

---

## 🧪 Testing với Swagger

Backend cung cấp Swagger UI để test API:
```
http://localhost:3001/api-docs
```

---

## ⚠️ Lưu ý quan trọng

1. **CORS**: Đảm bảo frontend URL được thêm vào `FRONTEND_URL` trong `.env` của backend
2. **Student ID**: Một số API yêu cầu header `x-student-id`, lấy từ user info sau khi login
3. **File Upload**: Sử dụng `FormData` cho upload file, không dùng JSON
4. **Error Handling**: Luôn kiểm tra `response.success` trước khi sử dụng `response.data`
5. **Token Expiry**: Access token hết hạn sau 15 phút, refresh token sau 7 ngày

---

## 🐛 Troubleshooting

### CORS Error
- Kiểm tra `FRONTEND_URL` trong `.env` của backend
- Đảm bảo frontend đang chạy đúng port (mặc định 3000)

### 401 Unauthorized
- Kiểm tra token có tồn tại không: `localStorage.getItem('access_token')`
- Thử refresh token hoặc đăng nhập lại

### 404 Not Found
- Kiểm tra API base URL: `http://localhost:3001`
- Kiểm tra endpoint path có đúng không

### File Upload Failed
- Kiểm tra file size (tối đa 100MB)
- Kiểm tra file type (chỉ PDF, DOC, DOCX, PPT, PPTX, XLS, XLSX, TXT)
- Đảm bảo header `x-student-id` được gửi kèm

---

## 📞 Hỗ trợ

Nếu gặp vấn đề, kiểm tra:
1. Backend logs trong terminal
2. Browser console để xem lỗi
3. Network tab trong DevTools để xem request/response
4. Swagger docs tại `http://localhost:3001/api-docs`

---

## 📝 Ví dụ hoàn chỉnh

Xem file `frontend-api-client.ts` để xem implementation đầy đủ với TypeScript types và error handling.

