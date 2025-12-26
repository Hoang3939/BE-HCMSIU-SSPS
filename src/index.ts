import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import multer from 'multer';
import * as dotenv from 'dotenv';
import { connectDB, testConnection, closeDB } from './config/database.js';
import * as documentRoutes from './routes/documents.js';
import * as printJobRoutes from './routes/printJobs.js';
import * as printerRoutes from './routes/printers.js';
import * as studentRoutes from './routes/students.js';

dotenv.config();

// ====== CẤU HÌNH CƠ BẢN ======
const app = express();
const PORT = process.env.PORT || 3001;

// Cấu hình CORS cho Frontend
const getAllowedOrigins = (): string | string[] => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    // Hỗ trợ nhiều origins cách nhau bởi dấu phẩy
    return frontendUrl.includes(',') ? frontendUrl.split(',').map(url => url.trim()) : frontendUrl;
  }
  // Mặc định cho development: Next.js thường chạy trên port 3000
  return 'http://localhost:3000';
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-student-id'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

app.use(cors(corsOptions));
console.log(
  `[cors]: Allowed origins: ${Array.isArray(corsOptions.origin) ? corsOptions.origin.join(', ') : corsOptions.origin
  }`,
);
app.use(express.json());

// ====== CORE PRINTING SERVICE ROUTES ======

// Error handling middleware cho multer
const handleMulterError = (err: any, req: Request, res: Response, next: NextFunction) => {
  if (err instanceof multer.MulterError) {
    if (err.code === 'LIMIT_FILE_SIZE') {
      return res.status(413).json({
        message: `File quá lớn. Dung lượng tối đa là 100MB`,
        code: 'FILE_TOO_LARGE',
      });
    }
    return res.status(400).json({
      message: err.message || 'Lỗi khi upload file',
      code: 'UPLOAD_ERROR',
    });
  }
  if (err) {
    // Lỗi từ fileFilter
    if (err.message === 'Định dạng file không được hỗ trợ' || err.message === 'Tên file quá dài (tối đa 255 ký tự)') {
      return res.status(415).json({
        message: err.message,
        code: 'UNSUPPORTED_MEDIA_TYPE',
      });
    }
    return res.status(400).json({
      message: err.message || 'Lỗi khi xử lý file',
      code: 'PROCESSING_ERROR',
    });
  }
  next();
};

// Giai đoạn 1: Upload & Kiểm tra tài liệu
app.post(
  '/api/documents/upload',
  documentRoutes.uploadMiddleware.single('file'),
  handleMulterError,
  documentRoutes.uploadDocument,
);

app.get('/api/documents/:documentId', documentRoutes.getDocument);
app.get('/api/documents/:documentId/preview', documentRoutes.getDocumentPreview);

// Giai đoạn 2: Cấu hình In & Thanh toán
app.post('/api/print-jobs/create', printJobRoutes.createPrintJob);

// Danh sách máy in khả dụng
app.get('/api/printers/available', printerRoutes.getAvailablePrinters);

// Số dư trang của sinh viên
app.get('/api/student/balance', studentRoutes.getUserBalance);

// Cập nhật Swagger dùng PORT từ môi trường
// ====== DOMAIN TẠM THỜI (IN-MEMORY) ======
type Role = 'student' | 'admin';

interface User {
  id: string;
  username: string;
  // Mật khẩu sẽ được hash, không lưu plain text
  passwordHash: string;
  role: Role;
  balancePages: number; // số trang còn lại
}

type PrintJobStatus = 'pending' | 'printing' | 'completed' | 'cancelled';

interface PrintJob {
  id: string;
  userId: string;
  printerId: string;
  fileName: string;
  pages: number;
  createdAt: Date;
  status: PrintJobStatus;
  options: {
    duplex: boolean;
    color: boolean;
    paperSize: 'A4' | 'A3';
  };
}

interface Printer {
  id: string;
  name: string;
  location: string;
  ipAddress: string;
  isActive: boolean;
}

interface PrintParams {
  a3PerA4: number; // vd: 2 A4 = 1 A3
  allowPdf: boolean;
  allowDocx: boolean;
}

// "Database" tạm
const users: User[] = [];
const printers: Printer[] = [];
const jobs: PrintJob[] = [];
let params: PrintParams = {
  a3PerA4: 2,
  allowPdf: true,
  allowDocx: true,
};

// Seed 1 admin + 1 student cho demo
import crypto from 'crypto';
import jwt from 'jsonwebtoken';

function hashPassword(raw: string): string {
  return crypto.createHash('sha256').update(raw).digest('hex');
}

function createId(prefix: string): string {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`;
}

const adminUser: User = {
  id: createId('u'),
  username: 'admin',
  passwordHash: hashPassword('admin123'),
  role: 'admin',
  balancePages: 0,
};

const studentUser: User = {
  id: createId('u'),
  username: 'student1',
  passwordHash: hashPassword('student123'),
  role: 'student',
  balancePages: 100,
};

users.push(adminUser, studentUser);

// Seed 1 printer và một vài job mẫu cho student1 để FE có dữ liệu lịch sử
const demoPrinter: Printer = {
  id: createId('printer'),
  name: 'H6-101',
  location: 'Tòa H6',
  ipAddress: '192.168.1.10',
  isActive: true,
};
printers.push(demoPrinter);
/*
const demoJobs: PrintJob[] = [
  {
    id: createId('job'),
    userId: studentUser.id,
    printerId: demoPrinter.id,
    fileName: 'Bao-cao-do-an.pdf',
    pages: 20,
    createdAt: new Date(Date.now() - 1000 * 60 * 60 * 2), // 2h trước
    status: 'completed',
    options: { duplex: true, color: false, paperSize: 'A4' },
  },
  {
    id: createId('job'),
    userId: studentUser.id,
    printerId: demoPrinter.id,
    fileName: 'Bai-tap-lon.docx',
    pages: 15,
    createdAt: new Date(Date.now() - 1000 * 60 * 30), // 30 phút trước
    status: 'pending',
    options: { duplex: false, color: true, paperSize: 'A4' },
  },
];
jobs.push(...demoJobs);*/

// ====== AUTH MIDDLEWARE ======
interface AuthPayload {
  userId: string;
  role: Role;
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

function authRequired(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Missing or invalid Authorization header' });
  }
  const token = authHeader.slice('Bearer '.length);
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as AuthPayload;
    req.auth = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

function requireRole(role: Role) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth || req.auth.role !== role) {
      return res.status(403).json({ message: 'Forbidden' });
    }
    return next();
  };
}

// ====== ROUTES: AUTH ======
/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Đăng nhập, trả về JWT token
 *     tags:
 *       - Auth
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               username:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Đăng nhập thành công
 */
app.post('/auth/login', (req: Request, res: Response) => {
  const { username, password } = req.body as { username?: string; password?: string };
  if (!username || !password) {
    return res.status(400).json({ message: 'username và password là bắt buộc' });
  }
  const user = users.find((u) => u.username === username);
  if (!user || user.passwordHash !== hashPassword(password)) {
    return res.status(401).json({ message: 'Sai tài khoản hoặc mật khẩu' });
  }
  const payload: AuthPayload = { userId: user.id, role: user.role };
  const token = jwt.sign(payload, JWT_SECRET, { expiresIn: '8h' });
  // Không trả passwordHash
  return res.json({
    token,
    user: { id: user.id, username: user.username, role: user.role, balancePages: user.balancePages },
  });
});

// ====== ROUTES: STUDENT (KHÁCH HÀNG) ======
// Đăng ký job in
app.post('/print-jobs', authRequired, requireRole('student'), (req: Request, res: Response) => {
  const { printerId, fileName, pages, options } = req.body as {
    printerId?: string;
    fileName?: string;
    pages?: number;
    options?: { duplex?: boolean; color?: boolean; paperSize?: 'A4' | 'A3' };
  };

  if (!printerId || !fileName || !pages || pages <= 0) {
    return res.status(400).json({ message: 'Thiếu thông tin job in' });
  }

  const printer = printers.find((p) => p.id === printerId && p.isActive);
  if (!printer) {
    return res.status(400).json({ message: 'Máy in không hợp lệ hoặc không hoạt động' });
  }

  const user = users.find((u) => u.id === req.auth!.userId);
  if (!user) {
    return res.status(401).json({ message: 'User không tồn tại' });
  }

  if (user.balancePages < pages) {
    return res.status(400).json({ message: 'Không đủ số trang để in' });
  }

  const job: PrintJob = {
    id: createId('job'),
    userId: user.id,
    printerId,
    fileName,
    pages,
    createdAt: new Date(),
    status: 'pending',
    options: {
      duplex: options?.duplex ?? false,
      color: options?.color ?? false,
      paperSize: options?.paperSize ?? 'A4',
    },
  };
  jobs.push(job);
  user.balancePages -= pages;

  return res.status(201).json(job);
});

// Mua thêm trang
app.post('/purchase-pages', authRequired, requireRole('student'), (req: Request, res: Response) => {
  const { pages } = req.body as { pages?: number };
  if (!pages || pages <= 0) {
    return res.status(400).json({ message: 'Số trang mua không hợp lệ' });
  }
  const user = users.find((u) => u.id === req.auth!.userId);
  if (!user) return res.status(401).json({ message: 'User không tồn tại' });

  user.balancePages += pages;
  // Ở đây có thể ghi log lịch sử mua, tính tiền,...
  return res.json({ balancePages: user.balancePages });
});

// Xem lịch sử job in
app.get('/print-jobs/history', authRequired, requireRole('student'), (req: Request, res: Response) => {
  const userId = req.auth!.userId;
  const history = jobs.filter((j) => j.userId === userId);
  return res.json(history);
});

// Hủy job trước khi in
app.post('/print-jobs/:id/cancel', authRequired, requireRole('student'), (req: Request, res: Response) => {
  const jobId = req.params.id;
  const userId = req.auth!.userId;

  const job = jobs.find((j) => j.id === jobId && j.userId === userId);
  if (!job) {
    return res.status(404).json({ message: 'Không tìm thấy job' });
  }
  if (job.status !== 'pending') {
    return res.status(400).json({ message: 'Chỉ được hủy job ở trạng thái pending' });
  }

  job.status = 'cancelled';
  // Hoàn trang lại cho user
  const user = users.find((u) => u.id === userId);
  if (user) {
    user.balancePages += job.pages;
  }

  return res.json(job);
});

// SSE: realtime cập nhật job trước khi in (stub)
app.get('/print-jobs/:id/stream', authRequired, requireRole('student'), (req: Request, res: Response) => {
  const jobId = req.params.id;
  const job = jobs.find((j) => j.id === jobId && j.userId === req.auth!.userId);
  if (!job) {
    return res.status(404).json({ message: 'Job không tồn tại' });
  }

  // Thiết lập SSE
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Gửi trạng thái hiện tại
  res.write(`data: ${JSON.stringify(job)}\n\n`);

  // Demo: không có cơ chế push thật từ CUPS, FE có thể poll lại REST để lấy thông tin mới
});

// ====== ROUTES: ADMIN ======
// Quản lý tham số
app.get('/admin/params', authRequired, requireRole('admin'), (_req: Request, res: Response) => {
  return res.json(params);
});

app.put('/admin/params', authRequired, requireRole('admin'), (req: Request, res: Response) => {
  const { a3PerA4, allowPdf, allowDocx } = req.body as Partial<PrintParams>;
  if (a3PerA4 !== undefined) {
    if (a3PerA4 <= 0) return res.status(400).json({ message: 'a3PerA4 phải > 0' });
    params.a3PerA4 = a3PerA4;
  }
  if (allowPdf !== undefined) params.allowPdf = allowPdf;
  if (allowDocx !== undefined) params.allowDocx = allowDocx;
  return res.json(params);
});

// Quản lý máy in
app.get('/admin/printers', authRequired, requireRole('admin'), (_req: Request, res: Response) => {
  return res.json(printers);
});

app.post('/admin/printers', authRequired, requireRole('admin'), (req: Request, res: Response) => {
  const { name, location, ipAddress, isActive } = req.body as Partial<Printer>;
  if (!name || !location || !ipAddress) {
    return res.status(400).json({ message: 'Thiếu thông tin máy in' });
  }
  const printer: Printer = {
    id: createId('printer'),
    name,
    location,
    ipAddress,
    isActive: isActive ?? true,
  };
  printers.push(printer);
  return res.status(201).json(printer);
});

app.put('/admin/printers/:id', authRequired, requireRole('admin'), (req: Request, res: Response) => {
  const printerId = req.params.id;
  const printer = printers.find((p) => p.id === printerId);
  if (!printer) return res.status(404).json({ message: 'Không tìm thấy máy in' });

  const { name, location, ipAddress, isActive } = req.body as Partial<Printer>;
  if (name !== undefined) printer.name = name;
  if (location !== undefined) printer.location = location;
  if (ipAddress !== undefined) printer.ipAddress = ipAddress;
  if (isActive !== undefined) printer.isActive = isActive;

  return res.json(printer);
});

// Map vị trí máy in trong khuôn viên trường (dữ liệu đơn giản, FE vẽ map)
app.get('/printers/map', authRequired, (_req: Request, res: Response) => {
  // Có thể bổ sung toạ độ sau này (lat, lng)
  return res.json(
    printers.map((p) => ({
      id: p.id,
      name: p.name,
      location: p.location,
    })),
  );
});

// ====== TÍCH HỢP CUPS (STUB) ======
// Trong thực tế sẽ gọi IPP tới CUPS server (container khác), ở đây chỉ stub
app.post('/admin/printers/:id/test-print', authRequired, requireRole('admin'), (req: Request, res: Response) => {
  const printerId = req.params.id;
  const printer = printers.find((p) => p.id === printerId);
  if (!printer) return res.status(404).json({ message: 'Không tìm thấy máy in' });

  // TODO: Gửi lệnh IPP tới CUPS server qua HTTP
  // Ví dụ: gọi http://cups:631/ipp/print với body phù hợp
  return res.json({ message: 'Đã gửi lệnh test print (stub, chưa gọi CUPS thật)', printer });
});

// ====== SWAGGER ======
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BE-HCMSIU-SSPS API',
      version: '1.0.0',
      description: `API Server đang chạy tại port ${PORT}`,
    },
    servers: [{ url: `http://localhost:${PORT}`, description: `Server port ${PORT}` }],
  },
  apis: ['./src/index.ts', './src/routes/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Health check endpoint
app.get('/health', async (req: Request, res: Response) => {
  const dbStatus = await testConnection();
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Khởi động server và kết nối database
async function startServer() {
  try {
    // Khởi động server trước
    app.listen(PORT, () => {
      console.log(`[server]: Server is running at http://localhost:${PORT}`);
      console.log(`[swagger]: Docs available at http://localhost:${PORT}/api-docs`);
      console.log(`[health]: Health check available at http://localhost:${PORT}/health`);
    });

    // Kết nối database (không block server start)
    try {
      await connectDB();
      await testConnection();
    } catch (dbError) {
      console.error('[server]: Database connection failed, but server is running:', dbError);
      console.log('[server]: API endpoints will return 500 if database is not available');
    }
  } catch (error) {
    console.error('[server]: Failed to start server:', error);
    process.exit(1);
  }
}

// Xử lý graceful shutdown
process.on('SIGINT', async () => {
  console.log('\n[server]: Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

process.on('SIGTERM', async () => {
  console.log('\n[server]: Shutting down gracefully...');
  await closeDB();
  process.exit(0);
});

startServer();
