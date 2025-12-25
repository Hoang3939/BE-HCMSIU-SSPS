import express, { type Request, type Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as dotenv from 'dotenv';
import { connectDB, testConnection, closeDB } from './config/database.js';
import printerRoutes from './routes/admin/printerRoutes.js';
import authRoutes from './routes/auth.routes.js';
import { errorHandler } from './middleware/errorHandler.middleware.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Configure CORS for Frontend
const getAllowedOrigins = (): string | string[] => {
  const frontendUrl = process.env.FRONTEND_URL;
  if (frontendUrl) {
    // Support multiple origins separated by comma
    return frontendUrl.includes(',') ? frontendUrl.split(',').map(url => url.trim()) : frontendUrl;
  }
  // Default for development: Next.js usually runs on port 3000
  return 'http://localhost:3000';
};

const corsOptions = {
  origin: getAllowedOrigins(),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  exposedHeaders: ['Content-Range', 'X-Content-Range'],
};

app.use(cors(corsOptions));
console.log(`[cors]: Allowed origins: ${Array.isArray(corsOptions.origin) ? corsOptions.origin.join(', ') : corsOptions.origin}`);
app.use(express.json());
app.use(cookieParser());

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

// API Routes
app.use('/api/admin/printers', printerRoutes);
app.use('/api/auth', authRoutes);

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

// Start server and connect to database
async function startServer() {
  try {
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