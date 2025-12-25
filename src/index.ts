import express, { type Request, type Response } from 'express';
import cors from 'cors';
import swaggerJsDoc from 'swagger-jsdoc';
import swaggerUi from 'swagger-ui-express';
import * as dotenv from 'dotenv';
import { connectDB, testConnection, closeDB } from './config/database.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Cập nhật Swagger dùng PORT từ môi trường
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'BE-HCMSIU-SSPS API',
      version: '1.0.0',
    },
    servers: [{ url: `http://localhost:${PORT}` }],
  },
  apis: ['./src/index.ts'],
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
    // Kết nối database
    await connectDB();
    await testConnection();

    // Khởi động server
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