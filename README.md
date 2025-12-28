# BE-HCMSIU-SSPS  
**Smart Printing Service Backend**

Backend cho **Hệ thống Dịch vụ In ấn Thông minh tại HCMIU**.  
Dự án được xây dựng trên **Node.js + TypeScript**, áp dụng kiến trúc hiện đại, hỗ trợ **ES Modules** và **tài liệu API tự động (Swagger / OpenAPI)**.

---

## 🚀 Công nghệ sử dụng

- **Runtime:** Node.js (v18+)
- **Ngôn ngữ:** TypeScript (v5+)
- **Framework:** Express.js (v5+)
- **API Documentation:** Swagger UI & JSDoc (OpenAPI 3.0)
- **Thực thi & Watch mode:** `tsx`
- **Bảo mật:** CORS
- **Cấu hình môi trường:** dotenv

---

## 🛠 Hướng dẫn thiết lập cho Thành viên Team

### 1️⃣ Cấu hình quyền thực thi (Windows)
```powershell
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser
```

### 2️⃣ Cài đặt Dependencies
```bash
npm install
```

### 3️⃣ Cấu hình biến môi trường
```bash
cp .env.example .env
```

```env
PORT=3001
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

---

## 🏃 Quy trình vận hành

### Development
```bash
npm run dev
```

### Production
```bash
npm run build
npm run start
```

---

## 📖 Swagger API
```text
http://localhost:3001/api-docs
```

---

## 🔌 Kết nối API với Frontend

Backend đã được cấu hình sẵn để kết nối với Frontend. Xem chi tiết tại:

- **[API_CLIENT.md](./API_CLIENT.md)** - Hướng dẫn chi tiết kết nối API
- **frontend-api-client.ts** - API Client helper cho Frontend (TypeScript)
- **frontend-types.ts** - TypeScript types cho Frontend

### Quick Start

1. **Copy API client vào project Frontend:**
   ```bash
   cp frontend-api-client.ts /path/to/your/frontend/src/api/client.ts
   ```

2. **Cấu hình API URL trong Frontend:**
   ```env
   # .env.local (React/Next.js)
   REACT_APP_API_URL=http://localhost:3001
   # hoặc
   NEXT_PUBLIC_API_URL=http://localhost:3001
   ```

3. **Sử dụng trong code:**
   ```typescript
   import { apiClient } from './api/client';
   
   // Login
   const response = await apiClient.login({
     username: 'student001',
     password: 'password'
   });
   ```

### CORS Configuration

Backend đã cấu hình CORS để cho phép:
- `http://localhost:3000` (mặc định)
- URL từ biến môi trường `FRONTEND_URL`

Thêm frontend URL vào `.env`:
```env
FRONTEND_URL=http://localhost:3000,https://your-frontend-domain.com
```

---

## 📁 Cấu trúc thư mục
```text
src/
dist/
.env
tsconfig.json
```

---

## ⚠️ Troubleshooting

- **EJSONPARSE:** `npm init -y`
- **TypeScript compile lỗi:** kiểm tra `tsx` và `"type": "module"`
- **Swagger YAML lỗi:** kiểm tra indent và key trùng