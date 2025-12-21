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
PORT=3000
NODE_ENV=development
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
http://localhost:3000/api-docs
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