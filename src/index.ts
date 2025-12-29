import express, { type Request, type Response, type NextFunction } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import { Router } from 'express';
import * as dotenv from 'dotenv';
import { connectDB, testConnection, closeDB } from './config/database.js';
import adminPrinterRoutes from './routes/admin/printerRoutes.js';
import adminDashboardRoutes from './routes/admin/dashboardRoutes.js';
import adminMapRoutes from './routes/admin/mapRoutes.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { authRequired, requireRole } from './middleware/auth.js';
import userRouter from './routes/user.js';
import documentRoutes from './routes/documents.js';
import printJobRoutes from './routes/printJobs.js';
import * as publicPrinterRoutes from './routes/printers.js';
import studentRoutes from './routes/students.js';
import paymentRoutes from './routes/payment.js';
import historyRoutes from './routes/history.js';
import multer from 'multer';
import configRoutes from './routes/config.routes.js';
import adminConfigRoutes from './routes/admin/configRoutes.js';
import * as mapController from './controllers/map.controller.js';

dotenv.config();

// ====== CẤU HÌNH CƠ BẢN ======
const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS for Frontend
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      return callback(null, true);
    }

    const allowedOrigins: string[] = [];

    // Hardcode production and development origins
    allowedOrigins.push('https://ssps.acdm.site');
    allowedOrigins.push('https://api.acdm.site');
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://localhost:3001');

    // Add custom frontend URL from environment if provided (for flexibility)
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl) {
      const urls = frontendUrl.includes(',')
        ? frontendUrl.split(',').map(url => url.trim())
        : [frontendUrl];
      urls.forEach(url => {
        if (!allowedOrigins.includes(url)) {
          allowedOrigins.push(url);
        }
        // Tự động thêm https nếu có http (hoặc ngược lại) để hỗ trợ cả hai
        if (url.startsWith('http://')) {
          const httpsUrl = url.replace('http://', 'https://');
          if (!allowedOrigins.includes(httpsUrl)) {
            allowedOrigins.push(httpsUrl);
          }
        } else if (url.startsWith('https://')) {
          const httpUrl = url.replace('https://', 'http://');
          if (!allowedOrigins.includes(httpUrl)) {
            allowedOrigins.push(httpUrl);
          }
        }
      });
    }

    // Log allowed origins on startup (only once)
    if (!(global as any).corsOriginsLogged) {
      console.log(`[cors]: CORS configured - allowing origins:`, allowedOrigins.join(', '));
      (global as any).corsOriginsLogged = true;
    }

    // Check if origin is in allowed list
    if (allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    // Reject other origins
    console.warn(`[CORS] Blocked origin: ${origin}. Allowed origins:`, allowedOrigins.join(', '));
    callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'X-Requested-With', 'x-student-id', 'Authorization'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

app.use(cors(corsOptions));
console.log('[cors]: CORS configured - allowing localhost:3000 and FRONTEND_URL');

app.use(express.json());
app.use(cookieParser());

// Request logging middleware (for debugging webhook) - Đặt SAU express.json() để body đã được parse
app.use((req: Request, res: Response, next: NextFunction) => {
  if (req.path.includes('/sepay-webhook')) {
    console.log('[Request]', {
      method: req.method,
      path: req.path,
      url: req.url,
      headers: {
        authorization: req.headers.authorization ? 'Present' : 'Missing',
        'content-type': req.headers['content-type'],
        origin: req.headers.origin,
        'user-agent': req.headers['user-agent'],
      },
      body: req.body,
    });
  }
  next();
});

// Configure Swagger using PORT from environment
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BE-HCMSIU-SSPS API',
      version: '1.0.0',
      description: 'API cho hệ thống dịch vụ in ấn thông minh tại HCMIU',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
    components: {
      schemas: {
        Printer: {
          type: 'object',
          properties: {
            PrinterID: {
              type: 'string',
              format: 'uuid',
              description: 'ID duy nhất của máy in',
            },
            Name: {
              type: 'string',
              description: 'Tên máy in',
              example: 'Máy in H6-101',
            },
            Brand: {
              type: 'string',
              nullable: true,
              description: 'Thương hiệu máy in',
              example: 'HP',
            },
            Model: {
              type: 'string',
              nullable: true,
              description: 'Model máy in',
              example: 'LaserJet Pro',
            },
            Description: {
              type: 'string',
              nullable: true,
              description: 'Mô tả máy in',
            },
            Status: {
              type: 'string',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE', 'ERROR'],
              description: 'Trạng thái máy in',
              example: 'AVAILABLE',
            },
            IPAddress: {
              type: 'string',
              nullable: true,
              description: 'Địa chỉ IP của máy in',
              example: '192.168.1.100',
            },
            CUPSPrinterName: {
              type: 'string',
              nullable: true,
              description: 'Tên máy in trong CUPS',
              example: 'printer-h6-101',
            },
            LocationID: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID vị trí đặt máy in',
            },
            IsActive: {
              type: 'boolean',
              description: 'Trạng thái hoạt động',
              example: true,
            },
            CreatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Thời gian tạo',
            },
            UpdatedAt: {
              type: 'string',
              format: 'date-time',
              description: 'Thời gian cập nhật cuối',
            },
          },
        },
        CreatePrinterDto: {
          type: 'object',
          required: ['Name'],
          properties: {
            Name: {
              type: 'string',
              description: 'Tên máy in (bắt buộc)',
              example: 'Máy in H6-101',
            },
            Brand: {
              type: 'string',
              description: 'Thương hiệu máy in',
              example: 'HP',
            },
            Model: {
              type: 'string',
              description: 'Model máy in',
              example: 'LaserJet Pro',
            },
            Description: {
              type: 'string',
              description: 'Mô tả máy in',
            },
            Status: {
              type: 'string',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE', 'ERROR'],
              description: 'Trạng thái máy in (mặc định: OFFLINE)',
              example: 'OFFLINE',
            },
            IPAddress: {
              type: 'string',
              description: 'Địa chỉ IP của máy in',
              example: '192.168.1.100',
            },
            CUPSPrinterName: {
              type: 'string',
              description: 'Tên máy in trong CUPS',
              example: 'printer-h6-101',
            },
            LocationID: {
              type: 'string',
              format: 'uuid',
              description: 'ID vị trí đặt máy in',
            },
            IsActive: {
              type: 'boolean',
              description: 'Trạng thái hoạt động (mặc định: true)',
              example: true,
            },
          },
        },
        UpdatePrinterDto: {
          type: 'object',
          properties: {
            Name: {
              type: 'string',
              description: 'Tên máy in',
            },
            Brand: {
              type: 'string',
              description: 'Thương hiệu máy in',
            },
            Model: {
              type: 'string',
              description: 'Model máy in',
            },
            Description: {
              type: 'string',
              description: 'Mô tả máy in',
            },
            Status: {
              type: 'string',
              enum: ['AVAILABLE', 'BUSY', 'OFFLINE', 'MAINTENANCE', 'ERROR'],
              description: 'Trạng thái máy in',
            },
            IPAddress: {
              type: 'string',
              description: 'Địa chỉ IP của máy in',
            },
            CUPSPrinterName: {
              type: 'string',
              description: 'Tên máy in trong CUPS',
            },
            LocationID: {
              type: 'string',
              format: 'uuid',
              nullable: true,
              description: 'ID vị trí đặt máy in',
            },
            IsActive: {
              type: 'boolean',
              description: 'Trạng thái hoạt động',
            },
          },
        },
        Pagination: {
          type: 'object',
          properties: {
            page: {
              type: 'integer',
              description: 'Số trang hiện tại',
              example: 1,
            },
            limit: {
              type: 'integer',
              description: 'Số lượng items mỗi trang',
              example: 10,
            },
            total: {
              type: 'integer',
              description: 'Tổng số items',
              example: 50,
            },
            totalPages: {
              type: 'integer',
              description: 'Tổng số trang',
              example: 5,
            },
          },
        },
        Error: {
          type: 'object',
          properties: {
            error: {
              type: 'string',
              description: 'Thông báo lỗi',
            },
            message: {
              type: 'string',
              description: 'Chi tiết lỗi',
            },
          },
        },
      },
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: ['./src/index.ts', './src/routes/**/*.ts', './src/controllers/**/*.ts'],
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ====== API ROUTES ======
// Admin routes
app.use('/api/admin/printers', adminPrinterRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/map', adminMapRoutes);
app.use('/api/admin/users', authRequired, requireRole('ADMIN'), userRouter);
app.use('/api/admin/configs', authRequired, requireRole('ADMIN'), adminConfigRoutes);

// Auth routes
app.use('/api/auth', authRoutes);

// Documents routes
app.use('/api/documents', documentRoutes);

// Print Jobs routes
app.use('/api/print-jobs', printJobRoutes);

// Public Printers routes
const publicPrinterRouter = Router();
publicPrinterRouter.get('/available', publicPrinterRoutes.getAvailablePrinters);
app.use('/api/printers', publicPrinterRouter);

// Public Map routes (for students)
app.get('/api/printers/map', mapController.getPublicPrintersWithLocations);

// Students routes
app.use('/api/student', studentRoutes);

// Payment routes
app.use('/api/payment', paymentRoutes);

// History routes
app.use('/api/history', historyRoutes);

// Config routes (public)
app.use('/api/config', configRoutes);

// Health check endpoint
/**
 * @swagger
 * /health:
 *   get:
 *     summary: Health check endpoint
 *     tags: [Health]
 *     responses:
 *       200:
 *         description: Server is healthy
 *       503:
 *         description: Server is unhealthy
 */
app.get('/health', async (req: Request, res: Response) => {
  const dbStatus = await testConnection();
  res.status(dbStatus ? 200 : 503).json({
    status: dbStatus ? 'healthy' : 'unhealthy',
    database: dbStatus ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString(),
  });
});

// Error Handler Middleware (must be placed after all routes)
app.use(errorHandler);

// ====== SERVER STARTUP ======
async function startServer() {
  try {
    // Check JWT secrets configuration
    const { checkJwtSecrets } = await import('./utils/jwt.util.js');
    const jwtConfig = checkJwtSecrets();
    if (!jwtConfig.accessSecret || !jwtConfig.refreshSecret) {
      console.error('[server]: ❌ JWT secrets are not properly configured!');
      console.error('[server]: Run: npm run update-jwt-secrets');
      process.exit(1);
    }
    console.log('[server]: ✅ JWT secrets configured');

    // Connect to database
    await connectDB();
    await testConnection();

    // Start server
    app.listen(PORT, () => {
      console.log(`[server]: Server is running at http://localhost:${PORT}`);
      console.log(`[swagger]: Docs available at http://localhost:${PORT}/api-docs`);
      console.log(`[health]: Health check available at http://localhost:${PORT}/health`);
    });
  } catch (error) {
    console.error('[server]: Failed to start server:', error);
    process.exit(1);
  }
}

// Handle graceful shutdown
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
