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
import adminConfigRoutes from './routes/admin/configRoutes.js';
import * as adminController from './controllers/admin.controller.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';
import { authRequired, requireAdmin, blockStudentFromAdmin } from './middleware/auth.js';
import userRouter from './routes/user.js';
import documentRoutes from './routes/documents.js';
import printJobRoutes from './routes/printJobs.js';
import * as publicPrinterRoutes from './routes/printers.js';
import studentRoutes from './routes/students.js';
import * as mapController from './controllers/map.controller.js';
import paymentRoutes from './routes/payment.js';
import multer from 'multer';

dotenv.config();

// ====== CẤU HÌNH CƠ BẢN ======
const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS for Frontend
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps, Postman, etc.)
    if (!origin) {
      console.log('[CORS] Request with no origin, allowing...');
      return callback(null, true);
    }

    console.log(`[CORS] Checking origin: ${origin}`);

    const allowedOrigins: string[] = [];

    // Always allow localhost for development (various ports)
    allowedOrigins.push('http://localhost:3000');
    allowedOrigins.push('http://127.0.0.1:3000');
    allowedOrigins.push('http://localhost:3001');
    allowedOrigins.push('http://127.0.0.1:3001');

    // Add custom frontend URL if provided
    const frontendUrl = process.env.FRONTEND_URL;
    if (frontendUrl) {
      const urls = frontendUrl.includes(',')
        ? frontendUrl.split(',').map(url => url.trim())
        : [frontendUrl.trim()];
      urls.forEach(url => {
        if (url && !allowedOrigins.includes(url)) {
          allowedOrigins.push(url);
          // Also add without trailing slash
          if (url.endsWith('/')) {
            allowedOrigins.push(url.slice(0, -1));
          } else {
            allowedOrigins.push(url + '/');
          }
        }
      });
    }

    // Normalize origin (remove trailing slash for comparison)
    const normalizedOrigin = origin.endsWith('/') ? origin.slice(0, -1) : origin;

    // Check if origin is in allowed list (exact match or normalized)
    if (allowedOrigins.includes(origin) || allowedOrigins.includes(normalizedOrigin)) {
      console.log(`[CORS] Origin allowed: ${origin}`);
      return callback(null, true);
    }

    // In development, allow all localhost origins
    if (process.env.NODE_ENV !== 'production') {
      if (origin.startsWith('http://localhost:') || origin.startsWith('http://127.0.0.1:')) {
        console.log(`[CORS] Development mode: allowing localhost origin: ${origin}`);
        return callback(null, true);
      }
    }

    // Reject other origins
    console.warn(`[CORS] Blocked origin: ${origin}`);
    console.warn(`[CORS] Allowed origins: ${allowedOrigins.join(', ')}`);
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

// ====== CORE PRINTING SERVICE ROUTES ======
// Note: Routes are defined in their respective route files and mounted below

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
// Public config route (for upload limits - no auth required)
app.get('/api/config/upload-limits', adminController.getUploadLimits);

// Admin routes
app.use('/api/admin/printers', adminPrinterRoutes);
app.use('/api/admin/dashboard', adminDashboardRoutes);
app.use('/api/admin/map', adminMapRoutes);
app.use('/api/admin/users', authRequired, blockStudentFromAdmin, requireAdmin, userRouter);
app.use('/api/admin/configs', adminConfigRoutes);

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
