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