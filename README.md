# BE-HCMSIU-SSPS

Backend cho hệ thống **Smart Student Printing Service (SSPS)** tại HCMIU.

- **Stack:** Node.js + Express + TypeScript
- **Database:** SQL Server (`mssql`)
- **Auth:** JWT + Session model
- **Mail:** Nodemailer
- **File upload:** Multer
- **API docs:** Swagger (`/api-docs`)

---

## 1) Cấu trúc dự án

```text
BE-HCMSIU-SSPS/
├─ src/
│  ├─ config/                 # cấu hình DB
│  ├─ controllers/            # xử lý request/response
│  ├─ errors/                 # AppError, error abstraction
│  ├─ middleware/             # auth, validation, error handler, async handler
│  ├─ models/                 # User, Session, OTP, ...
│  ├─ routes/                 # định tuyến API
│  ├─ services/               # business logic
│  ├─ types/                  # type definitions
│  ├─ utils/                  # utility functions
│  └─ index.ts                # entrypoint
├─ scripts/                   # script generate env/seed/jwt secret
├─ uploads/                   # file upload runtime
├─ package.json
├─ tsconfig.json
└─ README.md
```

---

## 2) Yêu cầu môi trường

- Node.js 18+
- npm 9+
- SQL Server

---

## 3) Cài đặt

```bash
npm install
```

---

## 4) Cấu hình biến môi trường

Có thể tạo nhanh bằng script:

```bash
npm run generate-env
```

Hoặc tự tạo `.env` theo nhu cầu. Một số biến quan trọng:

```env
PORT=3000
NODE_ENV=development
DB_HOST=localhost
DB_PORT=1433
DB_USER=sa
DB_PASSWORD=your_password
DB_NAME=SSPS
JWT_ACCESS_SECRET=your_access_secret
JWT_REFRESH_SECRET=your_refresh_secret
```

Nếu cần xoay secret JWT:

```bash
npm run update-jwt-secrets
```

---

## 5) Chạy dự án

### Development

```bash
npm run dev
```

### Build + Production

```bash
npm run build
npm run start
```

---

## 6) API Documentation

Sau khi chạy server, truy cập:

```text
http://localhost:3000/api-docs
```

---

## 7) Scripts tiện ích

- `npm run generate-env`: tạo file `.env` mẫu
- `npm run update-jwt-secrets`: cập nhật JWT secrets
- `npm run generate-seed-data`: tạo dữ liệu seed

---

## 8) Ghi chú vận hành

- Không commit `.env` thật hoặc secret production.
- Thư mục `uploads/` là dữ liệu runtime.
- Khi đổi schema/database, cần đồng bộ scripts và model/service liên quan.
